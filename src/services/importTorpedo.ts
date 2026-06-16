import type { Signal, Account, Person } from '../types';

interface TorpedoCompanyIntel {
  name: string;
  domain: string;
  hq?: string;
  headcount?: number;
  industry?: string;
  stage?: string;
  valuation?: string;
  total_funding_usd?: number;
  latest_round?: { type: string; amount_usd: number; date: string; investors: string[] };
  business_model?: string;
  tech_stack_notable?: string[];
  highlights?: string[];
}

interface TorpedoRevenuePoint {
  date: string;
  revenue: number;
  downloads: number;
  note?: string;
}

interface TorpedoSdk {
  name: string;
  category: string;
}

interface TorpedoCrmHistory {
  deals?: Array<{ id: string; name: string; stage: string; amount_usd: number | null; created: string; closed?: string; note?: string }>;
  contacts_mapped?: Array<{ name: string; title: string; email?: string; last_contacted?: string; last_email_sent?: string }>;
}

interface TorpedoSignal {
  signal: string;
  implication: string;
}

interface TorpedoContact {
  name: string;
  title: string;
  linkedin?: string;
  email?: string;
  location?: string;
  in_crm?: boolean;
  last_contacted?: string;
  notes?: string;
}

interface TorpedoStrategy {
  situation_summary?: string;
  angles?: Array<{ angle: string; rationale: string; strength: string; contacts: string[] }>;
  recommended_contacts?: Array<{ name: string; title: string; priority: number; reason: string; approach: string }>;
  cautions?: string[];
}

type TorpedoEntry =
  | { type: 'company_intel'; data: TorpedoCompanyIntel }
  | { type: 'revenue_history'; data: TorpedoRevenuePoint[]; store?: string; notes?: string }
  | { type: 'sdks'; data: TorpedoSdk[] }
  | { type: 'crm_history'; data: TorpedoCrmHistory }
  | { type: 'signals'; data: TorpedoSignal[] }
  | { type: 'contacts'; data: TorpedoContact[] }
  | { type: 'strategy'; data: TorpedoStrategy };

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
        updates.description = d.business_model || d.name;
        updates.hq = d.hq || '';
        updates.employees = d.headcount || 0;
        updates.industry = d.industry || '';
        updates.revenue = d.total_funding_usd
          ? `$${(d.total_funding_usd / 1_000_000).toFixed(0)}M raised`
          : '';
        updates.status = d.stage || 'Private';
        updates.founded = d.latest_round?.date?.slice(0, 4) || '';
        if (d.highlights?.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Post from market leaders', category: 'Social', source: 'Research',
            date: today, confidence: 'High', impact: 'High',
            title: `${d.name}: ${d.stage || 'growth stage'}`,
            description: d.highlights.slice(0, 3).join(' · '),
          });
        }
        if (d.latest_round) {
          const r = d.latest_round;
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Revenue Increase', category: 'Revenue', source: 'Research',
            date: r.date || today, confidence: 'High', impact: 'High',
            title: `${r.type} — $${(r.amount_usd / 1_000_000).toFixed(0)}M raised`,
            description: `Investors: ${r.investors?.slice(0, 3).join(', ')}. Fresh capital = growth mandate.`,
          });
        }
        break;
      }

      case 'revenue_history': {
        const points = entry.data.filter(p => !p.note?.includes('Partial'));
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

          // Downloads trend
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
        const sdkNames = entry.data.map(s => s.name.toLowerCase());
        const paywall = entry.data.filter(s => PAYWALL.some(p => s.name.toLowerCase().includes(p)));
        const lifecycle = entry.data.filter(s => LIFECYCLE.some(l => s.name.toLowerCase().includes(l)));
        void sdkNames;
        if (paywall.length) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Using Competitors', category: 'Competitive', source: 'AppMagic',
            date: today, confidence: 'High', impact: 'High',
            title: `Paywall SDK: ${paywall.map(s => s.name).join(' + ')}`,
            description: `Detected competitor subscription/paywall SDKs: ${paywall.map(s => s.name).join(', ')}. Direct displacement opportunity.`,
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

      case 'crm_history': {
        const d = entry.data;
        if (d.deals?.length) {
          for (const deal of d.deals) {
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
          const recent = d.contacts_mapped
            .filter(c => c.last_contacted || c.last_email_sent)
            .sort((a, b) => {
              const dateA = a.last_contacted || a.last_email_sent || '';
              const dateB = b.last_contacted || b.last_email_sent || '';
              return dateB.localeCompare(dateA);
            })
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

      case 'signals': {
        for (const s of entry.data) {
          signals.push({
            id: genId(), accountId, accountName: companyName,
            type: 'Post mentioned specific keywords', category: 'Social', source: 'Research',
            date: today, confidence: 'High', impact: 'Medium',
            title: s.signal,
            description: s.implication,
          });
        }
        break;
      }

      case 'contacts': {
        const people: Person[] = entry.data.map((c, i) => ({
          id: genId('person'),
          accountId,
          name: c.name,
          title: c.title,
          company: companyName,
          department: guessDepartment(c.title),
          location: c.location || '',
          tenure: '',
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
        if (d.angles?.length) {
          updates.whyKeywords = d.angles.map(a => a.angle.split(' ').slice(0, 3).join(' '));
        }
        if (d.angles?.length || d.situation_summary) {
          const top = d.angles?.[0];
          updates.opportunitySummary = {
            businessTrigger: d.situation_summary || '',
            likelyPriorities: top ? top.rationale : '',
            potentialPainPoints: d.cautions?.slice(0, 2).join(' ') || '',
            recommendedAngle: top ? `${top.angle}: ${top.rationale.slice(0, 150)}` : '',
          };
        }
        break;
      }
    }
  }

  // Score based on signal count and impact
  const highImpact = signals.filter(s => s.impact === 'High').length;
  const score = Math.min(100, Math.round(40 + highImpact * 8 + signals.length * 2));
  const scoreLabel = score >= 75 ? 'Hot' : score >= 50 ? 'Warm' : 'Cold';

  return {
    ...updates,
    signals,
    score,
    scoreLabel,
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
