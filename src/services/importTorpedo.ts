import type { Signal, Account, Person, CareerEntry } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TorpedoEntry = { type: string; data: any; notes?: string; store?: string; summary?: any };

function genId(prefix = 'sig') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${Math.round(n)}`;
}

// Normalize revenue_history data — handles both flat array and {store, records:[]} formats
function extractPoints(data: unknown): { date: string; revenue?: number; downloads?: number }[] {
  if (Array.isArray(data)) return data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  if (d && Array.isArray(d.records)) return d.records;
  return [];
}

export function importTorpedoJson(
  entries: TorpedoEntry[],
  accountId: string,
  companyName: string
): Partial<Account> {
  const today = new Date().toISOString().split('T')[0];
  const signals: Signal[] = [];
  const updates: Partial<Account> = {};
  // Accumulate revenue across stores for MTR and charts
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
        updates.employees = typeof d.headcount === 'number' ? d.headcount
          : parseInt(String(d.headcount || '0').replace(/\D.*/, '')) || 0;
        updates.industry = d.industry || '';
        updates.revenue = d.funding || (d.total_funding_usd
          ? `${fmt(d.total_funding_usd)} raised` : '');
        updates.status = d.amplemarket_account_status?.includes('customer') ? 'Customer' : (d.stage || 'Private');
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

      case 'revenue_history': {
        const store: string = entry.data?.store || entry.store || 'ios';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const points = extractPoints(entry.data).filter((p: any) => !p.note?.includes('Partial'));
        // Accumulate chart data
        for (const p of points) {
          const existing = revByDate.get(p.date) ?? { ios: 0, android: 0 };
          if (store === 'ios') existing.ios = p.revenue || 0;
          else existing.android = p.revenue || 0;
          revByDate.set(p.date, existing);
        }
        if (points.length > 0) {
          const lastRev = (points[points.length - 1].revenue as number) || 0;
          if (lastRev > 0) mtrByStore[store] = lastRev;
        }
        if (points.length >= 4) {
          const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
          const revs = points.map((p: { revenue?: number }) => p.revenue || 0);
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
        break;
      }

      case 'download_history': {
        const store: string = entry.data?.store || 'ios';
        const points = extractPoints(entry.data);
        // Accumulate chart data
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
        const paywall = sdkList.filter(s => PAYWALL.some(p => s.name.toLowerCase().includes(p)));
        const lifecycle = sdkList.filter(s => LIFECYCLE.some(l => s.name.toLowerCase().includes(l)));
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
        updates.adIntelligence = {
          activeChannels: d.active_channels || [],
          primaryChannels: d.primary_channels || [],
          creativeFormats: d.creative_formats || [],
          spendTrend: d.spend_trend || '',
          uaSophistication: ui.ua_sophistication || '',
          asaPresent: ui.asa_present || false,
          mmpGap: ui.mmp_gap || '',
          paywallTension: ui.paywall_tension || '',
        };
        const channels = (d.active_channels || []).join(', ');
        if (channels) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Meta/TT', category: 'Ad Spend', source: 'Research',
            date: today, confidence: 'High', impact: 'High',
            title: `Active on ${d.channel_count || d.active_channels?.length || '?'} UA channels: ${channels}`,
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
        // HubSpot contacts with title support
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
        // Content timeline — all items
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
        for (const s of entry.data as { signal: string; implication?: string; relevance?: string; detail?: string; why_now?: string }[]) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Post mentioned specific keywords', category: 'Social', source: 'Research',
            date: today, confidence: 'High', impact: 'Medium',
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
        }[]).map((c, i) => {
          const title = c.title || c.overview?.current_title || '';
          const email = c.email || c.overview?.email || undefined;
          const location = c.location || c.overview?.location || '';
          const linkedin = c.linkedin || c.linkedin_url || '';
          const bio = c.overview?.bio;
          return {
            id: genId('person'), accountId,
            name: c.name, title, company: companyName,
            department: guessDepartment(title),
            location, tenure: '', linkedin, email, bio,
            source: 'amplemarket' as const,
            influence: guessInfluence(title) as 'High' | 'Medium' | 'Low',
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
            careerTrack: c.career_track,
          };
        });
        updates.people = [...(updates.people || []), ...people];
        break;
      }

      case 'strategy': {
        const d = entry.data;
        if (d.situation_summary) updates.whyMatters = d.situation_summary;
        const angles = (d.angles || []) as { angle: string; detail?: string; rationale?: string; pitch_framing?: string }[];
        if (angles.length) {
          updates.whyKeywords = angles.map(a => a.angle.split(' ').slice(0, 3).join(' '));
        }
        if (angles.length || d.situation_summary) {
          const top = angles[0];
          updates.opportunitySummary = {
            businessTrigger: d.situation_summary || '',
            likelyPriorities: top ? (top.rationale || top.detail || '') : '',
            potentialPainPoints: d.caution || (d.cautions as string[] | undefined)?.slice(0, 2).join(' ') || '',
            recommendedAngle: top ? `${top.angle}: ${(top.rationale || top.detail || top.pitch_framing || '').slice(0, 200)}` : '',
          };
        }
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
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('coo') || t.includes('founder') || t.includes('president')) return 'Leadership';
  if (t.includes('cto') || t.includes('engineer') || t.includes('tech')) return 'Engineering';
  if (t.includes('product') || t.includes('pm')) return 'Product';
  if (t.includes('growth') || t.includes('marketing') || t.includes('ua') || t.includes('acquisition') || t.includes('monetis')) return 'Marketing';
  if (t.includes('design')) return 'Design';
  if (t.includes('finance') || t.includes('cfo') || t.includes('revenue')) return 'Finance';
  return 'Operations';
}

function guessInfluence(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('coo') || t.includes('cto') || t.includes('cpo') || t.includes('cdo') || t.includes('cfo') || t.includes('founder') || t.includes('head of') || t.includes('vp') || t.includes('director')) return 'High';
  if (t.includes('lead') || t.includes('senior') || t.includes('manager')) return 'Medium';
  return 'Low';
}
