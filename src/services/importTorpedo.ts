import type { Signal, Account, Person, CareerEntry } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TorpedoEntry = { type: string; data: any; notes?: string; store?: string; summary?: any };

function genId(prefix = 'sig') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];

const HIRING_RE = /\b(hir(ing|ed?)|recruit|job posting|open role|new (gm|cto|cpo|vp|director)|leadership (gap|vacuum)|building.*team|expanding.*team|head of.*role)\b/i;

function isHiringSignal(text: string): boolean {
  return HIRING_RE.test(text);
}

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${Math.round(n)}`;
}

export function importTorpedoJson(
  entries: TorpedoEntry[],
  accountId: string,
  companyName: string
): Partial<Account> {
  const today = new Date().toISOString().split('T')[0];
  const signals: Signal[] = [];
  const updates: Partial<Account> = {};
  const mtrByStore: Record<string, number> = {};
  const revByDate = new Map<string, { ios: number; android: number }>();
  const dlByDate = new Map<string, { ios: number; android: number }>();

  for (const entry of entries) {
    if (!entry || !entry.type || entry.data === undefined) continue;
    switch (entry.type) {

      case 'company_intel': {
        const d = entry.data;
        updates.description = d.description || d.business_model || d.name;
        updates.hq = d.hq || d.location || '';
        // employees: prefer numeric field, fallback to parsing string
        updates.employees = typeof d.employees === 'number' ? d.employees
          : typeof d.headcount === 'number' ? d.headcount
          : parseInt(String(d.employees || d.headcount || '0').replace(/\D.*/, '')) || 0;
        updates.industry = d.industry || '';
        // revenue: prefer actual revenue fields over funding
        updates.revenue = d.actual_revenue_fy2024 || d.estimated_revenue || d.funding
          || (d.total_funding_usd ? `${fmt(d.total_funding_usd)} raised` : '');
        // status: prefer company type
        updates.status = d.type || (d.amplemarket_account_status?.includes('customer') ? 'Customer' : (d.stage || 'Private'));
        updates.founded = d.founded ? String(d.founded) : (d.latest_round?.date?.slice(0, 4) || '');
        if (d.total_funding_usd || d.funding || d.latest_round) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Revenue Increase', category: 'Revenue', source: 'Research',
            date: d.latest_funding_date || d.latest_round?.date || today,
            confidence: 'High', impact: 'High',
            title: `Funding: ${d.funding || fmt(d.total_funding_usd || 0)} raised · ${d.latest_funding_stage || d.latest_round?.stage || ''}`.trim().replace(/ · $/, ''),
            description: d.description || '',
          });
        }
        break;
      }

      case 'investments': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rounds = Array.isArray(entry.data) ? entry.data : [];
        updates.investmentHistory = rounds.map((r: any) => ({
          round: r.round || r.stage || 'Investment',
          amount: r.amount_usd ? fmt(r.amount_usd) : (r.amount || ''),
          investors: Array.isArray(r.investors) ? r.investors : (r.lead_investor ? [r.lead_investor] : []),
          date: r.date || '',
        }));
        break;
      }

      case 'revenue_history': {
        // New format: flat array with store field per record
        // Old format: entry.store + flat array without store field
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData: any[] = Array.isArray(entry.data) ? entry.data : [];
        const entryStore: string = entry.store || '';

        // Group by store
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byStore: Record<string, any[]> = {};
        for (const p of rawData) {
          const store = p.store || entryStore || 'ios';
          if (!byStore[store]) byStore[store] = [];
          byStore[store].push(p);
        }

        for (const [store, points] of Object.entries(byStore)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const filtered = points.filter((p: any) => !p.note?.includes('Partial'));
          for (const p of filtered) {
            const existing = revByDate.get(p.date) ?? { ios: 0, android: 0 };
            if (store === 'ios') existing.ios = p.revenue || 0;
            else existing.android = p.revenue || 0;
            revByDate.set(p.date, existing);
          }
          if (filtered.length > 0) {
            const lastRev = (filtered[filtered.length - 1].revenue as number) || 0;
            if (lastRev > 0) mtrByStore[store] = lastRev;
          }
          if (filtered.length >= 4) {
            const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
            const revs = filtered.map((p: { revenue?: number }) => p.revenue || 0);
            const recent = avg(revs.slice(-3));
            const prior = avg(revs.slice(-6, -3));
            const pct = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : 0;
            const abs = Math.abs(pct);
            const type = pct > 10 ? 'Revenue Increase' : pct < -10 ? 'Revenue Decrease' : 'Revenue Plateau';
            signals.push({
              id: genId(), accountId, accountName: companyName,
              type, category: 'Revenue', source: 'AppMagic',
              date: today, confidence: 'High', impact: abs > 20 ? 'High' : 'Medium',
              title: type === 'Revenue Plateau'
                ? `${store.toUpperCase()} revenue plateau ±${abs}% MoM`
                : `${store.toUpperCase()} revenue ${pct > 0 ? '+' : ''}${pct}% MoM`,
              description: `Last month: ${fmt(revs[revs.length - 1])}`,
            });
          }
        }
        break;
      }

      case 'download_history': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData: any[] = Array.isArray(entry.data) ? entry.data : [];
        const entryStore: string = entry.store || '';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const byStore: Record<string, any[]> = {};
        for (const p of rawData) {
          const store = p.store || entryStore || 'ios';
          if (!byStore[store]) byStore[store] = [];
          byStore[store].push(p);
        }

        for (const [store, points] of Object.entries(byStore)) {
          for (const p of points) {
            const existing = dlByDate.get(p.date) ?? { ios: 0, android: 0 };
            if (store === 'ios') existing.ios = p.downloads || 0;
            else existing.android = p.downloads || 0;
            dlByDate.set(p.date, existing);
          }
          if (points.length >= 4) {
            const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
            const vals = points.map((p: { downloads?: number }) => p.downloads || 0);
            const recent = avg(vals.slice(-3));
            const prior = avg(vals.slice(-6, -3));
            const pct = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : 0;
            const abs = Math.abs(pct);
            const type = pct > 10 ? 'Download Increase' : pct < -10 ? 'Download Decrease' : 'Download Plateau';
            signals.push({
              id: genId(), accountId, accountName: companyName,
              type, category: 'Downloads', source: 'AppMagic',
              date: today, confidence: 'High', impact: abs > 20 ? 'High' : 'Medium',
              title: `${store.toUpperCase()} installs ${pct > 0 ? '+' : ''}${pct}% MoM`,
              description: `Avg last 3 months: ${Math.round(recent).toLocaleString()} downloads/mo.`,
            });
          }
        }
        break;
      }

      case 'org_chart': {
        const d = entry.data;
        const STANDARD = ['c_level', 'vp_director', 'manager_ic', 'unknown'];
        // If already in standard format — use as-is
        if (STANDARD.some(k => d[k])) {
          updates.orgChart = d;
        } else {
          // Flatten all arrays from any key structure into standard buckets by title
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allPeople: any[] = Object.values(d).flat();
          const c_level: typeof allPeople = [];
          const vp_director: typeof allPeople = [];
          const manager_ic: typeof allPeople = [];
          const unknown: typeof allPeople = [];
          for (const p of allPeople) {
            const t = (p.title || '').toLowerCase();
            if (t.includes('ceo') || t.includes('coo') || t.includes('cto') || t.includes('cpo') || t.includes('cfo') || t.includes('svp') || t.includes('evp') || t.includes('chief') || t.includes('founder')) {
              c_level.push(p);
            } else if (t.includes('vp') || t.includes('vice president') || t.includes('director') || t.includes('head of') || t.includes('gm') || t.includes('general manager') || t.includes('president')) {
              vp_director.push(p);
            } else if (t.includes('manager') || t.includes('lead') || t.includes('senior') || t.includes('engineer') || t.includes('analyst') || t.includes('specialist') || t.includes('designer') || t.includes('pm') || t.includes('product')) {
              manager_ic.push(p);
            } else {
              unknown.push(p);
            }
          }
          updates.orgChart = { c_level, vp_director, manager_ic, unknown };
        }
        break;
      }

      case 'products': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updates.products = (Array.isArray(entry.data) ? entry.data : []).map((p: any) => ({
          app_name: p.app_name || p.name || '',
          platform: p.platform || 'both',
          has_in_app_purchases: p.has_in_app_purchases ?? null,
          store_url_ios: p.store_url_ios || p.store_id_ios ? `https://apps.apple.com/app/id${p.store_id_ios}` : undefined,
          store_url_android: p.store_url_android,
          description: p.description,
        }));
        break;
      }

      case 'sdks': {
        const PAYWALL = ['revenuecat', 'superwall', 'purchasely', 'qonversion', 'apphud'];
        const LIFECYCLE = ['braze', 'customer.io', 'customerio', 'clevertap', 'leanplum', 'intercom'];
        const sdkList: { name: string }[] = Array.isArray(entry.data)
          ? entry.data
          : [
              ...((entry.data.ios || []) as { name: string }[]),
              ...((entry.data.android || []) as { name: string }[]),
            ].filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i);
        const paywall = sdkList.filter(s => s.name && PAYWALL.some(p => s.name.toLowerCase().includes(p)));
        const lifecycle = sdkList.filter(s => s.name && LIFECYCLE.some(l => s.name.toLowerCase().includes(l)));
        if (paywall.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Competitors', category: 'Competitive', source: 'AppMagic',
            date: today, confidence: 'High', impact: 'High',
            title: `Paywall SDK: ${paywall.map(s => s.name).join(' + ')}`,
            description: `Detected competitor SDKs: ${paywall.map(s => s.name).join(', ')}. Direct displacement opportunity.`,
          });
        }
        if (lifecycle.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Competitors', category: 'Competitive', source: 'AppMagic',
            date: today, confidence: 'High', impact: 'Medium',
            title: `Lifecycle: ${lifecycle.map(s => s.name).join(' + ')}`,
            description: `Lifecycle/CRM SDKs: ${lifecycle.map(s => s.name).join(', ')}.`,
          });
        }
        break;
      }

      case 'ad_intelligence': {
        const d = entry.data;
        const ui = d.ua_interpretation || {};

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsePlatform = (p: any) => p ? ({
          activeChannels: p.active_channels || [],
          primaryChannels: p.primary_channels || [],
          // rows may have { channel, impressions } or { channel, score } — normalise to score
          impressionsByChannel: (p.impressions_by_channel || []).map((r: any) => ({
            channel: r.channel,
            score: r.score ?? r.impressions ?? 0,
          })),
          topGeos: p.top_geos || [],
          totalImpressionsScore: p.total_impressions_score ?? p.total_impressions ?? 0,
        }) : undefined;

        // Support both flat format (old) and per-platform format (ios/android keys)
        const hasPerPlatform = d.ios || d.android;
        updates.adIntelligence = {
          activeChannels: d.active_channels || d.ios?.active_channels || d.android?.active_channels || [],
          primaryChannels: d.primary_channels || d.ios?.primary_channels || [],
          creativeFormats: d.creative_formats || [],
          spendTrend: d.spend_trend || '',
          uaSophistication: ui.ua_sophistication || '',
          asaPresent: ui.asa_present || false,
          mmpGap: ui.mmp_gap || '',
          paywallTension: ui.paywall_tension || '',
          ios: hasPerPlatform ? parsePlatform(d.ios) : parsePlatform(d),
          android: parsePlatform(d.android),
        };

        const allChannels = [...(d.ios?.active_channels || d.active_channels || []), ...(d.android?.active_channels || [])];
        const uniqueChannels = [...new Set(allChannels)];
        if (uniqueChannels.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Meta/TT', category: 'Ad Spend', source: 'Research',
            date: today, confidence: 'High', impact: 'High',
            title: `Active on ${uniqueChannels.length} UA channels: ${uniqueChannels.join(', ')}`,
            description: ui.ua_sophistication || '',
          });
        }
        break;
      }

      case 'crm_history': {
        const d = entry.data;
        if (d.deals?.length) {
          for (const deal of d.deals as { name: string; stage: string; amount_usd?: number; created: string; closed?: string; note?: string }[]) {
            signals.push({
              id: genId(), accountId, accountName: companyName,
              type: 'Content Download', category: 'Content', source: 'HubSpot',
              date: deal.closed || deal.created, confidence: 'High', impact: 'High',
              title: `Deal: ${deal.name} — ${deal.stage}`,
              description: `${deal.amount_usd ? `$${deal.amount_usd.toLocaleString()} · ` : ''}Created ${deal.created}${deal.closed ? `, closed ${deal.closed}` : ''}${deal.note ? `. ${deal.note}` : ''}`,
            });
          }
        }
        break;
      }

      case 'hubspot_contacts': {
        const contacts = (entry.data || []) as { name: string; email?: string; title?: string; status?: string }[];
        if (contacts.length) {
          const people: Person[] = contacts.map((c, i) => ({
            id: genId('person'), accountId, name: c.name,
            title: c.title || c.status || '', company: companyName,
            department: guessDepartment(c.title || c.status || ''),
            location: '', tenure: '', linkedin: '',
            email: c.email,
            source: 'hubspot' as const,
            influence: guessInfluence(c.title || c.status || '') as 'High' | 'Medium' | 'Low',
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          }));
          updates.people = [...(updates.people || []), ...people];
        }
        break;
      }

      case 'hubspot_deals': {
        for (const deal of (entry.data || []) as { name?: string; deal_name?: string; dealname?: string; stage: string; amount?: number | null; closedate?: string; closed?: string; createdate?: string; created?: string; note?: string; notes?: string }[]) {
          const name = deal.deal_name || deal.dealname || deal.name || 'Deal';
          const date = deal.closedate || deal.closed || deal.createdate || deal.created || today;
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Content Download', category: 'Content', source: 'HubSpot',
            date, confidence: 'High', impact: 'High',
            title: `Deal: ${name} — ${deal.stage}`,
            description: `${deal.amount ? `$${deal.amount.toLocaleString()} · ` : ''}${deal.note || deal.notes || ''}`,
          });
        }
        break;
      }

      case 'hubspot_company_engagement': {
        const d = entry.data;
        const totals = d.company_totals || {};
        if (totals.contacts_found || totals.total_sessions) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Webinar Visited', category: 'Content', source: 'HubSpot',
            date: totals.last_touch_date || today, confidence: 'High', impact: 'High',
            title: `${totals.contacts_found || 0} contacts · ${totals.total_sessions || 0} sessions · ${totals.total_conversion_events || 0} conversions`,
            description: `First touch: ${totals.first_touch_date || 'unknown'} · Last touch: ${totals.last_touch_date || 'unknown'}`,
          });
        }
        const contacts = (d.contacts_summary || []) as { name: string; email?: string; title?: string; status?: string; conversion_count?: number }[];
        if (contacts.length) {
          const people: Person[] = contacts.map((c, i) => ({
            id: genId('person'), accountId, name: c.name,
            title: c.title || c.status || '', company: companyName,
            department: guessDepartment(c.title || c.status || ''),
            location: '', tenure: '', linkedin: '',
            email: c.email,
            source: 'hubspot' as const,
            influence: (c.conversion_count && c.conversion_count > 5 ? 'High' : c.conversion_count && c.conversion_count > 0 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          }));
          updates.people = [...(updates.people || []), ...people];
        }
        const timeline = (d.content_timeline || []) as { date: string; person: string; event: string; source?: string }[];
        for (const item of timeline) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Content Download', category: 'Content', source: 'HubSpot',
            date: item.date, confidence: 'High', impact: 'Medium',
            title: item.event,
            description: `${item.person}${item.source ? ` · ${item.source}` : ''}`,
          });
        }
        break;
      }

      case 'signals': {
        for (const s of entry.data as { signal: string; priority?: string; implication?: string; relevance?: string; detail?: string; why_now?: string }[]) {
          const impact = s.priority === 'HIGH' ? 'High' : s.priority === 'MEDIUM' ? 'Medium' : 'Low';
          const sigText = `${s.signal} ${s.detail || ''} ${s.implication || ''}`;
          const hiring = isHiringSignal(sigText);
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: hiring ? 'Hiring In Relevant Department' : 'Post mentioned specific keywords',
            category: hiring ? 'Hiring' : 'Social',
            source: 'Research',
            date: today, confidence: 'High', impact: impact as 'High' | 'Medium' | 'Low',
            title: s.signal,
            description: s.detail || s.implication || s.relevance || s.why_now || '',
          });
        }
        break;
      }

      case 'contacts': {
        const people: Person[] = (entry.data as {
          name: string;
          title?: string;
          linkedin?: string;
          linkedin_url?: string;
          email?: string;
          location?: string;
          overview?: { current_title?: string; email?: string; location?: string; bio?: string };
          career_track?: CareerEntry[];
          what_to_pitch?: { likely_priorities?: string; recommended_angle?: string };
          linkedin_posts?: {
            posts?: Array<{ date: string; url?: string; content: string; likes?: number; comments?: number }> | null;
          };
        }[]).map((c, i) => {
          const title = c.title || c.overview?.current_title || '';
          const email = c.email || c.overview?.email || undefined;
          const location = c.location || c.overview?.location || '';
          const linkedin = c.linkedin || c.linkedin_url || '';
          const bio = c.overview?.bio;

          // Map linkedin_posts.posts → recentPosts
          const rawPosts = c.linkedin_posts?.posts;
          const recentPosts = Array.isArray(rawPosts) ? rawPosts.map(p => ({
            date: p.date,
            platform: 'LinkedIn',
            content: p.content,
            url: p.url,
          })) : undefined;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wtp = c.what_to_pitch as any;
          const whatToPitch = wtp ? {
            likelyPriorities: wtp.likely_priorities || wtp.likelyPriorities,
            recommendedAngle: wtp.recommended_angle || wtp.recommendedAngle,
            painPoints: wtp.pain_points || wtp.painPoints,
          } : undefined;

          return {
            id: genId('person'), accountId,
            name: c.name, title, company: companyName,
            department: guessDepartment(title),
            location, tenure: '', linkedin, email, bio,
            source: 'amplemarket' as const,
            influence: guessInfluence(title) as 'High' | 'Medium' | 'Low',
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
            careerTrack: c.career_track,
            recentPosts,
            whatToPitch,
          };
        });
        updates.people = [...(updates.people || []), ...people];
        break;
      }

      case 'news': {
        updates.news = (entry.data as {
          headline?: string;
          title?: string;
          date: string;
          source?: string;
          summary?: string;
          url?: string;
        }[]).map(item => ({
          date: item.date,
          title: item.headline || item.title || '',
          source: item.source,
          url: item.url,
          summary: item.summary,
        }));
        break;
      }

      case 'paywall_analysis': {
        const d = entry.data;
        // Build key_observations from screen_inventory + executive_summary
        const keyObs: string[] = [];
        if (d.executive_summary) keyObs.push(d.executive_summary);
        if (Array.isArray(d.screen_inventory)) keyObs.push(...d.screen_inventory.slice(0, 5));

        // Opportunities from recommendations array
        const opportunities: string[] = Array.isArray(d.recommendations)
          ? d.recommendations.map((r: { priority?: string; recommendation?: string; rationale?: string }) =>
              `[${r.priority || 'MED'}] ${r.recommendation || ''}${r.rationale ? ` — ${r.rationale.slice(0, 120)}` : ''}`
            )
          : [];

        // Monetization stack from torpedo_strategy_connection or screen_inventory hints
        const monetizationStack: string[] = [];
        if (d.app_name) monetizationStack.push(d.app_name);
        if (d.screen_type) monetizationStack.push(d.screen_type);

        updates.paywallAnalysis = {
          paywall_type: d.screen_type || d.paywall_type || '',
          key_observations: keyObs,
          monetization_stack: monetizationStack,
          opportunities,
        };
        break;
      }

      case 'strategy': {
        const d = entry.data;
        // whyMatters from account_status + icp_fit + timing_quality
        const whyParts = [];
        if (d.icp_fit) whyParts.push(`ICP Fit: ${d.icp_fit}`);
        if (d.timing_quality) whyParts.push(`Timing: ${d.timing_quality}`);
        if (d.account_status) whyParts.push(d.account_status);
        if (d.situation_summary) whyParts.push(d.situation_summary);
        if (whyParts.length) updates.whyMatters = whyParts.join(' · ');

        const angles = (d.angles || []) as { angle: string; strength?: string; detail?: string; rationale?: string; pitch_framing?: string; hook?: string }[];
        if (angles.length) {
          updates.whyKeywords = angles.map(a => a.angle.split(' ').slice(0, 4).join(' '));
        }

        const top = angles[0];
        const second = angles[1];
        updates.opportunitySummary = {
          businessTrigger: top ? (top.angle || '') : (d.situation_summary || ''),
          likelyPriorities: top ? (top.rationale || top.detail || top.hook || '') : '',
          potentialPainPoints: second ? (second.rationale || second.detail || second.hook || '') : (d.caution || ''),
          recommendedAngle: d.recommended_sequence || (top ? `${top.angle}: ${(top.hook || top.rationale || top.pitch_framing || '').slice(0, 300)}` : ''),
        };
        break;
      }
    }
  }

  // Save chart time-series
  if (revByDate.size > 0) {
    updates.revenueHistory = Array.from(revByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }
  if (dlByDate.size > 0) {
    updates.downloadHistory = Array.from(dlByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }

  // Sum MTR across all stores
  const totalMTR = Object.values(mtrByStore).reduce((a, b) => a + b, 0);
  if (totalMTR > 0) {
    updates.lastMonthRevenue = `${fmt(totalMTR)}/mo`;
  }

  // Deduplicate people: amplemarket/contacts takes priority over hubspot
  if (updates.people && updates.people.length > 0) {
    // Sort so amplemarket comes before hubspot
    const sorted = [...updates.people].sort((a, b) => {
      if (a.source === 'amplemarket' && b.source !== 'amplemarket') return -1;
      if (a.source !== 'amplemarket' && b.source === 'amplemarket') return 1;
      return 0;
    });
    const seen = new Set<string>();
    updates.people = sorted.filter(p => {
      const key = (p.name || '').toLowerCase().trim();
      if (!key) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const highImpact = signals.filter(s => s.impact === 'High').length;
  const score = Math.min(100, Math.round(40 + highImpact * 8 + signals.length * 2));
  const scoreLabel = score >= 75 ? 'Hot' : score >= 50 ? 'Warm' : 'Cold';

  return {
    ...updates,
    signals,
    score,
    scoreLabel: scoreLabel as Account['scoreLabel'],
    enrichmentStatus: 'done',
    lastUpdated: today,
  };
}

function guessDepartment(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('ceo') || t.includes('coo') || t.includes('founder') || t.includes('president')) return 'Leadership';
  if (t.includes('cto') || t.includes('engineer') || t.includes('tech')) return 'Engineering';
  if (t.includes('product') || t.includes('pm')) return 'Product';
  if (t.includes('growth') || t.includes('marketing') || t.includes('ua') || t.includes('acquisition') || t.includes('monetis')) return 'Marketing';
  if (t.includes('design')) return 'Design';
  if (t.includes('finance') || t.includes('cfo') || t.includes('revenue')) return 'Finance';
  return 'Operations';
}

function guessInfluence(title: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('ceo') || t.includes('coo') || t.includes('cto') || t.includes('cpo') || t.includes('cdo') || t.includes('cfo') || t.includes('founder') || t.includes('head of') || t.includes('vp') || t.includes('director')) return 'High';
  if (t.includes('lead') || t.includes('senior') || t.includes('manager')) return 'Medium';
  return 'Low';
}
