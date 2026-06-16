import type { Signal } from '../types';

const BASE_URL = 'https://api.appmagic.rocks/v1';
const LOGIN = import.meta.env.VITE_APPMAGIC_LOGIN;
const PASSWORD = import.meta.env.VITE_APPMAGIC_PASSWORD;

// Adapty-specific competitors: subscription/paywall SDKs + lifecycle tools
const PAYWALL_SDKS = ['revenuecat', 'superwall', 'purchasely', 'qonversion', 'apphud'];
const LIFECYCLE_SDKS = ['braze', 'customer.io', 'customerio', 'clevertap', 'leanplum', 'airship', 'iterable'];
const ALL_COMPETITOR_SDKS = [...PAYWALL_SDKS, ...LIFECYCLE_SDKS];

function authHeader(): string {
  return 'Basic ' + btoa(`${LOGIN}:${PASSWORD}`);
}

const hasCredentials = () => !!(LOGIN && PASSWORD);

async function apiGet(path: string, params?: Record<string, string | number | undefined>): Promise<unknown> {
  let url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  if (params) {
    const filtered = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    if (filtered.length) url += '?' + new URLSearchParams(filtered.map(([k, v]) => [k, String(v)])).toString();
  }
  const res = await fetch(url, { headers: { Authorization: authHeader(), Accept: 'application/json' } });
  if (!res.ok) throw new Error(`AppMagic ${res.status}: ${path}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// App lookup
// ---------------------------------------------------------------------------

interface AppRecord {
  united_id: number;
  ios_id: string | null;
  android_id: string | null;
  name: string;
  publisher: string;
}

async function findApps(companyName: string, domain: string): Promise<AppRecord[]> {
  const queries = [
    domain.replace(/\.(com|io|app|co|net|org)$/, ''),
    companyName.split(' ')[0],
  ];

  for (const q of queries) {
    try {
      const result = await apiGet('/applications', { search: q, limit: 5 }) as unknown;
      const items = Array.isArray(result) ? result : ((result as Record<string, unknown>)?.data as unknown[] ?? []);
      if (!items.length) continue;

      return items.map((r: unknown) => {
        const item = r as Record<string, unknown>;
        const storeIds = (item['store_ids'] as Record<string, string>) || {};
        return {
          united_id: item['id'] as number,
          ios_id: storeIds['2'] || storeIds['ios'] || null,
          android_id: storeIds['1'] || storeIds['android'] || null,
          name: item['name'] as string,
          publisher: (item['publisher_name'] as string) || '',
        };
      }).filter(a => a.united_id);
    } catch {
      continue;
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Revenue + downloads history — 12 months, MoM trend
// ---------------------------------------------------------------------------

interface HistoryPoint { date: string; revenue?: number; downloads?: number; }

function detectMoMTrend(points: HistoryPoint[], field: 'revenue' | 'downloads'): { trend: 'increasing' | 'decreasing' | 'stable'; changePercent: number } {
  const values = points.map(p => Number(p[field]) || 0);
  if (values.length < 4) return { trend: 'stable', changePercent: 0 };
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  // Compare last 3 months vs prior 3 months
  const recent = avg(values.slice(-3));
  const prior = avg(values.slice(-6, -3));
  if (prior === 0) return { trend: 'stable', changePercent: 0 };
  const pct = Math.round(((recent - prior) / prior) * 100);
  if (pct > 10) return { trend: 'increasing', changePercent: pct };
  if (pct < -10) return { trend: 'decreasing', changePercent: pct };
  return { trend: 'stable', changePercent: pct };
}

async function getHistory(unitedId: number, store: 1 | 2): Promise<HistoryPoint[]> {
  const today = new Date();
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - 1);
  try {
    const result = await apiGet('/history/united-application', {
      united_application_id: unitedId,
      store,
      country: 'WW',
      date_from: from.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0],
      aggregation: 'monthly',
    });
    return Array.isArray(result) ? result as HistoryPoint[] : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Ad intelligence
// ---------------------------------------------------------------------------

async function getAdStats(iosId: string): Promise<string[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 180);
  try {
    const result = await apiGet('/adint/stats', {
      appIds: iosId,
      country: 'WW',
      dateFrom: from.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
      aggregation: 'month',
    }) as Record<string, unknown>;

    const sources = (result?.ad_sources as Array<{ adSource: string }>) || [];
    return sources.map(s => s.adSource?.toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// SDK detection
// ---------------------------------------------------------------------------

interface SdkItem { name: string; category?: string; }

async function getAppSdks(iosId: string): Promise<SdkItem[]> {
  try {
    const result = await apiGet('/sdkint/sdks', { store: 2, store_application_id: iosId });
    return Array.isArray(result) ? result as SdkItem[] : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Exported signal functions
// ---------------------------------------------------------------------------

export async function getRevenueSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockRevenueSignals(domain);
  try {
    const apps = await findApps(companyName || domain, domain);
    if (!apps.length) return [];
    const app = apps[0];
    const signals: Partial<Signal>[] = [];

    const stores: Array<{ store: 1 | 2; label: string; hasId: boolean }> = [
      { store: 2, label: 'iOS', hasId: !!app.ios_id },
      { store: 1, label: 'Android', hasId: !!app.android_id },
    ];

    for (const { store, label, hasId } of stores) {
      if (!hasId && store === 1 && !app.android_id) continue;
      if (!hasId && store === 2 && !app.ios_id) continue;
      const history = await getHistory(app.united_id, store);
      if (!history.length) continue;
      const { trend, changePercent } = detectMoMTrend(history, 'revenue');
      const abs = Math.abs(changePercent);
      if (trend === 'increasing')
        signals.push({ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', confidence: abs > 30 ? 'High' : 'Medium', impact: abs > 30 ? 'High' : 'Medium', title: `${app.name} ${label} revenue +${abs}% MoM`, description: `${label} revenue grew ${abs}% (last 3 months vs prior 3 months). Active UA scaling window.` });
      else if (trend === 'decreasing')
        signals.push({ type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', confidence: 'Medium', impact: 'Medium', title: `${app.name} ${label} revenue −${abs}% MoM`, description: `${label} revenue dropped ${abs}% — potential pain point driving monetization re-evaluation.` });
      else
        signals.push({ type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', confidence: 'Medium', impact: 'Low', title: `${app.name} ${label} revenue plateau (±${abs}%)`, description: `${label} revenue flat over last 6 months — rising CAC may push new channel evaluation.` });
    }
    return signals;
  } catch {
    return getMockRevenueSignals(domain);
  }
}

export async function getDownloadSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockDownloadSignals(domain);
  try {
    const apps = await findApps(companyName || domain, domain);
    if (!apps.length) return [];
    const app = apps[0];
    const signals: Partial<Signal>[] = [];

    const stores: Array<{ store: 1 | 2; label: string; hasId: boolean }> = [
      { store: 2, label: 'iOS', hasId: !!app.ios_id },
      { store: 1, label: 'Android', hasId: !!app.android_id },
    ];

    for (const { store, label, hasId } of stores) {
      if (!hasId && store === 1 && !app.android_id) continue;
      if (!hasId && store === 2 && !app.ios_id) continue;
      const history = await getHistory(app.united_id, store);
      if (!history.length) continue;
      const { trend, changePercent } = detectMoMTrend(history, 'downloads');
      const abs = Math.abs(changePercent);
      if (trend === 'increasing')
        signals.push({ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', confidence: abs > 25 ? 'High' : 'Medium', impact: abs > 25 ? 'High' : 'Medium', title: `${app.name} ${label} installs +${abs}% MoM`, description: `${label} downloads grew ${abs}% (last 3 months vs prior 3 months).` });
      else if (trend === 'decreasing')
        signals.push({ type: 'Download Decrease', category: 'Downloads', source: 'AppMagic', confidence: 'Medium', impact: 'Medium', title: `${app.name} ${label} installs −${abs}% MoM`, description: `${label} downloads fell ${abs}% — channel saturation or seasonality.` });
      else
        signals.push({ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', confidence: 'Medium', impact: 'Low', title: `${app.name} ${label} install growth flat (±${abs}%)`, description: `${label} downloads plateaued — organic ceiling may be driving paid UA interest.` });
    }
    return signals;
  } catch {
    return getMockDownloadSignals(domain);
  }
}

export async function getAdChannelSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockAdChannelSignals(domain);
  try {
    const apps = await findApps(companyName || domain, domain);
    if (!apps.length) return [];
    const app = apps[0];
    if (!app.ios_id) return [];
    const networks = await getAdStats(app.ios_id);
    const signals: Partial<Signal>[] = [];

    const hasMeta = networks.some(n => n.includes('facebook') || n.includes('meta'));
    const hasTT = networks.some(n => n.includes('tiktok'));
    const hasASA = networks.some(n => n.includes('apple') || n.includes('asa') || n.includes('search ads') || n.includes('searchads'));
    const hasW2A = networks.some(n => n.includes('web') || n.includes('w2a'));

    if (hasMeta || hasTT) {
      const channels = [hasMeta && 'Meta', hasTT && 'TikTok'].filter(Boolean).join(' + ');
      signals.push({ type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'High', title: `${app.name} running ${channels} UA`, description: `Active ad creatives detected on ${channels}. Networks found: ${networks.slice(0, 5).join(', ')}.` });
    }
    if (hasASA)
      signals.push({ type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'High', title: `${app.name} running Apple Search Ads`, description: `ASA campaigns active — keyword bidding on iOS App Store.` });
    if (hasW2A)
      signals.push({ type: 'Using W2A', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'Medium', title: `${app.name} using web-to-app funnel`, description: `Web-to-app campaigns detected — complex attribution setup.` });
    return signals;
  } catch {
    return getMockAdChannelSignals(domain);
  }
}

export async function getCompetitorUsageSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockCompetitorUsageSignals(domain);
  try {
    const apps = await findApps(companyName || domain, domain);
    if (!apps.length) return [];
    const app = apps[0];
    if (!app.ios_id) return [];
    const sdks = await getAppSdks(app.ios_id);
    const sdkNames = sdks.map(s => s.name?.toLowerCase()).filter(Boolean);

    const foundPaywall = sdkNames.filter(s => PAYWALL_SDKS.some(c => s.includes(c)));
    const foundLifecycle = sdkNames.filter(s => LIFECYCLE_SDKS.some(c => s.includes(c)));
    const allFound = [...new Set([...foundPaywall, ...foundLifecycle])];

    if (!allFound.length) return [];

    const signals: Partial<Signal>[] = [];
    if (foundPaywall.length)
      signals.push({ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', confidence: 'High', impact: 'High', title: `Paywall SDK: ${foundPaywall.slice(0, 2).join(', ')} in ${app.name}`, description: `Detected competitor paywall/subscription SDKs: ${foundPaywall.join(', ')}. Direct displacement opportunity.` });
    if (foundLifecycle.length)
      signals.push({ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', confidence: 'High', impact: 'Medium', title: `Lifecycle tool: ${foundLifecycle.slice(0, 2).join(', ')} in ${app.name}`, description: `Lifecycle/CRM SDKs detected: ${foundLifecycle.join(', ')}.` });
    return signals;
  } catch {
    return getMockCompetitorUsageSignals(domain);
  }
}

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockRevenueSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'iOS revenue +42% MoM', description: 'iOS revenue grew 42% (last 3 months vs prior 3).', confidence: 'High', impact: 'High' },
      { type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Android revenue +31% MoM', description: 'Android revenue grew 31% over the same period.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'iOS revenue +28% MoM', description: 'Strong premium subscription revenue growth on iOS.', confidence: 'High', impact: 'High' },
    ],
    'wise.com': [{ type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', title: 'iOS revenue plateau ±3%', description: 'Wise app revenue stabilized; CAC rising.', confidence: 'Medium', impact: 'Medium' }],
    'spotify.com': [{ type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', title: 'iOS revenue −12% MoM', description: 'New subscriber growth decelerated with rising acquisition costs.', confidence: 'Medium', impact: 'Medium' }],
  };
  return map[domain] || [];
}

function getMockDownloadSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'iOS installs +28% MoM', description: 'iOS downloads surged 28% month-over-month.', confidence: 'High', impact: 'High' },
      { type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'Android installs +19% MoM', description: 'Android install growth strong in LATAM.', confidence: 'High', impact: 'Medium' },
    ],
    'revolut.com': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'iOS installs +22% MoM', description: 'Strong install growth across EU markets.', confidence: 'High', impact: 'High' }],
    'wise.com': [{ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', title: 'iOS install growth flat ±2%', description: 'Wise install growth stabilized in core markets.', confidence: 'Medium', impact: 'Medium' }],
    'klarna.com': [{ type: 'Download Decrease', category: 'Downloads', source: 'AppMagic', title: 'iOS installs −12% MoM', description: 'Downloads declined following regulatory scrutiny.', confidence: 'Medium', impact: 'Medium' }],
  };
  return map[domain] || [];
}

function getMockAdChannelSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'Apple Search Ads active in 7 markets', description: 'ASA keyword footprint expanded into LATAM and SEA storefronts.', confidence: 'High', impact: 'High' },
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'Scaling Meta + TikTok UA', description: 'Active creatives on Meta and TikTok.', confidence: 'High', impact: 'Medium' },
    ],
    'revolut.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'ASA campaigns running in UK & EU', description: 'Active Apple Search Ads targeting fintech keywords.', confidence: 'High', impact: 'High' },
    ],
  };
  return map[domain] || [];
}

function getMockCompetitorUsageSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'RevenueCat detected in app', description: 'RevenueCat SDK confirmed — direct displacement opportunity.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Braze + Qonversion detected', description: 'Lifecycle (Braze) and paywall (Qonversion) SDKs found.', confidence: 'High', impact: 'High' }],
    'bolt.eu': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Apphud SDK active', description: 'Apphud used for subscription management.', confidence: 'Medium', impact: 'Medium' }],
  };
  return map[domain] || [];
}

export interface AppMagicAppData {
  appId: string; appName: string; bundleId: string; publisher: string; category: string;
  revenue: { monthly: number; quarterly: number; yearly: number; trend: string; changePercent: number };
  downloads: { monthly: number; quarterly: number; trend: string; changePercent: number };
  adChannels?: { asa: boolean; meta: boolean; tiktok: boolean; w2a: boolean };
  topCompetitors?: string[];
  markets: string[];
}

export async function getAppDataByPublisher(_domain: string): Promise<AppMagicAppData[]> { return []; }
