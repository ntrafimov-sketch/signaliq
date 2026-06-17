import type { Signal, Account, Person } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TorpedoEntry = { type: string; data: any; notes?: string; store?: string; summary?: any };

function genId(prefix = 'sig') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];

export function importTorpedoJson(
  entries: TorpedoEntry[],
  accountId: string,
  companyName: string
): Partial<Account> {
  const today = new Date().toISOString().split('T')[0];
  const signals: Signal[] = [];
  const updates: Partial<Account> = {};

  for (const entry of entries) {
    switch (entry.type) {
      case 'company_intel': {
        const d = entry.data;
        updates.description = d.description || d.business_model || d.name;
        updates.hq = d.hq || '';
        updates.employees = typeof d.headcount === 'number' ? d.headcount
          : parseInt(String(d.headcount || '0').replace(/\D.*/, '')) || 0;
        updates.industry = d.industry || '';
        updates.revenue = d.funding || (d.total_funding_usd
          ? `$${(d.total_funding_usd / 1_000_000).toFixed(0)}M raised` : '');
        updates.status = d.amplemarket_account_status?.includes('customer') ? 'Customer' : (d.stage || 'Private');
        updates.founded = d.founded ? String(d.founded) : (d.latest_round?.date?.slice(0, 4) || '');
        if (d.funding || d.latest_round) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Revenue Increase', category: 'Revenue', source: 'Research',
            date: today, confidence: 'High', impact: 'High',
            title: `Funding: ${d.funding || `$${(d.latest_round.amount_usd / 1_000_000).toFixed(0)}M`}`,
            description: d.description || '',
          });
        }
        break;
      }

      case 'revenue_history': {
        const points: { month?: string; date?: string; revenue: number; downloads: number; note?: string }[] =
          entry.data.filter((p: { note?: string }) => !p.note?.includes('Partial'));
        if (points.length > 0) {
          const lastRev = points[points.length - 1].revenue;
          updates.lastMonthRevenue = lastRev >= 1_000_000
            ? `$${(lastRev / 1_000_000).toFixed(1)}M/mo`
            : lastRev >= 1_000
            ? `$${Math.round(lastRev / 1_000)}K/mo`
            : `$${Math.round(lastRev)}/mo`;
        }
        if (points.length >= 4) {
          const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
          const recent = avg(points.slice(-3).map(p => p.revenue));
          const prior = avg(points.slice(-6, -3).map(p => p.revenue));
          const pct = prior > 0 ? Math.round(((recent - prior) / prior) * 100) : 0;
          const abs = Math.abs(pct);
          const type = pct > 10 ? 'Revenue Increase' : pct < -10 ? 'Revenue Decrease' : 'Revenue Plateau';
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type, category: 'Revenue', source: 'AppMagic',
            date: today, confidence: 'High', impact: abs > 20 ? 'High' : 'Medium',
            title: type === 'Revenue Plateau'
              ? `iOS revenue plateau ±${abs}% MoM`
              : `iOS revenue ${pct > 0 ? '+' : ''}${pct}% MoM`,
            description: `${entry.store || 'App Store'} (WW). ${entry.notes || ''}`.trim(),
          });

          const dRecent = avg(points.slice(-3).map(p => p.downloads));
          const dPrior = avg(points.slice(-6, -3).map(p => p.downloads));
          const dPct = dPrior > 0 ? Math.round(((dRecent - dPrior) / dPrior) * 100) : 0;
          const dAbs = Math.abs(dPct);
          const dType = dPct > 10 ? 'Download Increase' : dPct < -10 ? 'Download Decrease' : 'Download Plateau';
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: dType, category: 'Downloads', source: 'AppMagic',
            date: today, confidence: 'High', impact: dAbs > 20 ? 'High' : 'Medium',
            title: `iOS installs ${dPct > 0 ? '+' : ''}${dPct}% MoM`,
            description: `Avg last 3 months: ${Math.round(dRecent).toLocaleString()} downloads/mo.`,
          });
        }
        break;
      }

      case 'sdks': {
        const PAYWALL = ['revenuecat', 'superwall', 'purchasely', 'qonversion', 'apphud'];
        const LIFECYCLE = ['braze', 'customer.io', 'customerio', 'clevertap', 'leanplum', 'intercom'];
        const paywall = entry.data.filter((s: { name: string }) => PAYWALL.some(p => s.name.toLowerCase().includes(p)));
        const lifecycle = entry.data.filter((s: { name: string }) => LIFECYCLE.some(l => s.name.toLowerCase().includes(l)));
        if (paywall.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Competitors', category: 'Competitive', source: 'AppMagic',
            date: today, confidence: 'High', impact: 'High',
            title: `Paywall SDK: ${paywall.map((s: { name: string }) => s.name).join(' + ')}`,
            description: `Detected competitor subscription/paywall SDKs: ${paywall.map((s: { name: string }) => s.name).join(', ')}. Direct displacement opportunity.`,
          });
        }
        if (lifecycle.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Competitors', category: 'Competitive', source: 'AppMagic',
            date: today, confidence: 'High', impact: 'Medium',
            title: `Lifecycle: ${lifecycle.map((s: { name: string }) => s.name).join(' + ')}`,
            description: `Lifecycle/CRM SDKs: ${lifecycle.map((s: { name: string }) => s.name).join(', ')}.`,
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
        if (d.contacts_mapped?.length) {
          const recent = (d.contacts_mapped as { name: string; title: string; last_contacted?: string; last_email_sent?: string }[])
            .filter(c => c.last_contacted || c.last_email_sent)
            .sort((a, b) => (b.last_contacted || b.last_email_sent || '').localeCompare(a.last_contacted || a.last_email_sent || ''))
            .slice(0, 5);
          if (recent.length) {
            signals.push({
              id: genId(), accountId, accountName: companyName,
              type: 'Webinar Visited', category: 'Content', source: 'HubSpot',
              date: recent[0].last_contacted || recent[0].last_email_sent || today,
              confidence: 'High', impact: 'Medium',
              title: `${d.contacts_mapped.length} contacts in HubSpot CRM`,
              description: `Recently contacted: ${recent.map(c => `${c.name} (${c.title})`).join(', ')}.`,
            });
          }
        }
        break;
      }

      case 'hubspot_contacts': {
        const contacts = (entry.data || []) as { name: string; email?: string; notes?: string; status?: string }[];
        if (contacts.length) {
          const people: Person[] = contacts.map((c, i) => ({
            id: genId('person'), accountId, name: c.name,
            title: c.status || '', company: companyName,
            department: guessDepartment(c.status || ''),
            location: '', tenure: '', linkedin: '',
            influence: guessInfluence(c.status || '') as 'High' | 'Medium' | 'Low',
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          }));
          updates.people = [...(updates.people || []), ...people];
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Webinar Visited', category: 'Content', source: 'HubSpot',
            date: today, confidence: 'High', impact: 'Medium',
            title: `${contacts.length} contacts in HubSpot`,
            description: entry.summary?.highest_engagement || `${contacts.length} tracked contacts`,
          });
        }
        break;
      }

      case 'hubspot_deals': {
        for (const deal of (entry.data || []) as { name: string; stage: string; amount?: number; closedate?: string; notes?: string }[]) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Content Download', category: 'Content', source: 'HubSpot',
            date: deal.closedate || today, confidence: 'High', impact: 'High',
            title: `Deal: ${deal.name} — ${deal.stage}`,
            description: `${deal.amount ? `$${deal.amount.toLocaleString()} · ` : ''}${deal.notes || ''}`,
          });
        }
        break;
      }

      case 'signals': {
        for (const s of entry.data as { signal: string; implication?: string; relevance?: string; detail?: string }[]) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Post mentioned specific keywords', category: 'Social', source: 'Research',
            date: today, confidence: 'High', impact: 'Medium',
            title: s.signal,
            description: s.implication || s.relevance || s.detail || '',
          });
        }
        break;
      }

      case 'contacts': {
        const people: Person[] = (entry.data as { name: string; title: string; linkedin?: string; email?: string; location?: string }[])
          .map((c, i) => ({
            id: genId('person'), accountId,
            name: c.name, title: c.title, company: companyName,
            department: guessDepartment(c.title),
            location: c.location || '', tenure: '',
            linkedin: c.linkedin || '',
            influence: guessInfluence(c.title) as 'High' | 'Medium' | 'Low',
            avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
          }));
        updates.people = people;
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
            likelyPriorities: top ? (top.detail || top.rationale || '') : '',
            potentialPainPoints: d.caution || (d.cautions as string[] | undefined)?.slice(0, 2).join(' ') || '',
            recommendedAngle: top ? `${top.angle}: ${(top.detail || top.pitch_framing || top.rationale || '').slice(0, 150)}` : '',
          };
        }
        break;
      }
    }
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
  if (t.includes('growth') || t.includes('marketing') || t.includes('ua')) return 'Marketing';
  if (t.includes('design')) return 'Design';
  if (t.includes('finance') || t.includes('revenue')) return 'Finance';
  return 'Operations';
}

function guessInfluence(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('coo') || t.includes('cto') || t.includes('founder') || t.includes('head of') || t.includes('vp') || t.includes('director')) return 'High';
  if (t.includes('lead') || t.includes('senior') || t.includes('manager')) return 'Medium';
  return 'Low';
}
