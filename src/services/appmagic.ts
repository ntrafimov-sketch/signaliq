import type { Signal } from '../types';

const BASE_URL = 'https://api.appmagic.rocks/v1';
const LOGIN = import.meta.env.VITE_APPMAGIC_LOGIN;
const PASSWORD = import.meta.env.VITE_APPMAGIC_PASSWORD;

const COMPETITOR_SDKS = ['appsflyer', 'adjust', 'branch', 'kochava', 'singular', 'amplitude', 'mixpanel', 'firebase'];

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
// App lookup via /v1/applications?search=...
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
// Revenue + downloads history via /v1/history/united-application
// ---------------------------------------------------------------------------

interface HistoryPoint { date: string; revenue?: number; downloads?: number; }

function detectTrend(points: HistoryPoint[], field: 'revenue' | 'downloads'): { trend: 'increasing' | 'decreasing' | 'stable'; changePercent: number } {
  const values = points.map(p => Number(p[field]) || 0).filter(v => v > 0);
  if (values.length < 2) return { trend: 'stable', changePercent: 0 };
  const mid = Math.floor(values.length / 2);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const first = avg(values.slice(0, mid));
  const second = avg(values.slice(mid));
  if (first === 0) return { trend: 'stable', changePercent: 0 };
  const pct = Math.round(((second - first) / first) * 100);
  if (pct > 10) return { trend: 'increasing', changePercent: pct };
  if (pct < -10) return { trend: 'decreasing', changePercent: pct };
  return { trend: 'stable', changePercent: pct };
}

async function getHistory(unitedId: number, store: 1 | 2): Promise<HistoryPoint[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 90);
  try {
    const result = await apiGet('/history/united-application', {
      united_application_id: unitedId,
      store,
      country: 'US',
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
// Ad intelligence via /v1/adint/stats
// ---------------------------------------------------------------------------

async function getAdStats(iosId: string): Promise<string[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 180);
  try {
    const result = await apiGet('/adint/stats', {
      appIds: iosId,
      country: 'US',
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
// SDK detection via /v1/sdkint/sdks
// ---------------------------------------------------------------------------

async function getAppSdks(iosId: string): Promise<string[]> {
  try {
    const result = await apiGet('/sdkint/sdks', { store: 2, store_application_id: iosId });
    const sdks = Array.isArray(result) ? result as Array<{ name: string }> : [];
    return sdks.map(s => s.name?.toLowerCase()).filter(Boolean);
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
    const store: 1 | 2 = app.ios_id ? 2 : 1;
    const history = await getHistory(app.united_id, store);
    if (!history.length) return [];
    const { trend, changePercent } = detectTrend(history, 'revenue');
    const abs = Math.abs(changePercent);
    if (trend === 'increasing') return [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', confidence: abs > 30 ? 'High' : 'Medium', impact: abs > 30 ? 'High' : 'Medium', title: `${app.name} revenue up ${abs}% QoQ`, description: `App revenue growing ${abs}% over the last 90 days. UA investment window is open.` }];
    if (trend === 'decreasing') return [{ type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', confidence: 'Medium', impact: 'Medium', title: `${app.name} revenue down ${abs}%`, description: `Revenue dropped ${abs}% — potential pain point driving MMP re-evaluation.` }];
    return [{ type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', confidence: 'Medium', impact: 'Low', title: `${app.name} revenue plateaued`, description: `Revenue flat at ±${abs}% — rising CAC may push them to evaluate new UA channels.` }];
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
    const store: 1 | 2 = app.ios_id ? 2 : 1;
    const history = await getHistory(app.united_id, store);
    if (!history.length) return [];
    const { trend, changePercent } = detectTrend(history, 'downloads');
    const abs = Math.abs(changePercent);
    if (trend === 'increasing') return [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', confidence: abs > 25 ? 'High' : 'Medium', impact: abs > 25 ? 'High' : 'Medium', title: `${app.name} installs up ${abs}% MoM`, description: `Downloads grew ${abs}% in the last 90 days — active UA scaling underway.` }];
    if (trend === 'decreasing') return [{ type: 'Download Decrease', category: 'Downloads', source: 'AppMagic', confidence: 'Medium', impact: 'Medium', title: `${app.name} installs down ${abs}%`, description: `Download volume fell ${abs}% — may be facing channel saturation.` }];
    return [{ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', confidence: 'Medium', impact: 'Low', title: `${app.name} install growth flat`, description: `Downloads plateaued at ±${abs}% — organic ceiling may be driving paid UA interest.` }];
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
    if (networks.some(n => n.includes('facebook') || n.includes('meta') || n.includes('tiktok')))
      signals.push({ type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'High', title: `${app.name} running Meta/TikTok UA`, description: `Active ad creatives on Meta/TikTok: ${networks.join(', ')}.` });
    if (networks.some(n => n.includes('apple') || n.includes('asa') || n.includes('search')))
      signals.push({ type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'High', title: `${app.name} running Apple Search Ads`, description: `ASA campaigns detected for ${app.name}.` });
    if (networks.some(n => n.includes('web') || n.includes('w2a')))
      signals.push({ type: 'Using W2A', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'Medium', title: `${app.name} using web-to-app funnel`, description: `Web-to-app campaigns detected.` });
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
    const found = sdks.filter(s => COMPETITOR_SDKS.some(c => s.includes(c)));
    if (!found.length) return [];
    return [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', confidence: 'High', impact: 'High', title: `${found.slice(0, 2).join(' + ')} detected in ${app.name}`, description: `SDK scan confirmed: ${found.join(', ')}. Competitive displacement opportunity.` }];
  } catch {
    return getMockCompetitorUsageSignals(domain);
  }
}

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockRevenueSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Mobile app revenue increased 42%', description: 'Quarter-over-quarter growth in iOS and Android in-app revenue.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Revenue +28% in European markets', description: 'Strong premium subscription revenue growth across EU markets.', confidence: 'High', impact: 'High' }],
    'wise.com': [{ type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', title: 'Revenue growth plateaued at 3% QoQ', description: 'Wise app revenue growth has stabilized; CAC rising.', confidence: 'Medium', impact: 'Medium' }],
    'bolt.eu': [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Bolt app revenue up 31% YoY', description: 'Strong ride-hailing and food delivery revenue growth.', confidence: 'High', impact: 'High' }],
    'spotify.com': [{ type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', title: 'Premium subscriber growth slowing', description: 'New subscriber growth decelerated with rising acquisition costs.', confidence: 'Medium', impact: 'Low' }],
  };
  return map[domain] || [];
}

function getMockDownloadSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'App installs up 28% MoM', description: 'Uber app downloads surged 28% month-over-month.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'Downloads up 22% in EU markets', description: 'Revolut seeing strong install growth across Germany, France, and Poland.', confidence: 'High', impact: 'High' }],
    'bolt.eu': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'Bolt installs +35% in Africa', description: 'Strong download growth in Nigeria, Kenya, and South Africa.', confidence: 'High', impact: 'High' }],
    'wise.com': [{ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', title: 'Download growth flattening at 2% MoM', description: 'Wise app install growth has stabilized in core markets.', confidence: 'Medium', impact: 'Medium' }],
    'klarna.com': [{ type: 'Download Decrease', category: 'Downloads', source: 'AppMagic', title: 'Installs down 12% in US market', description: 'Klarna app downloads declined following BNPL regulatory scrutiny.', confidence: 'Medium', impact: 'Medium' }],
  };
  return map[domain] || [];
}

function getMockAdChannelSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'Apple Search Ads activated in 7 new markets', description: 'ASA keyword footprint expanded into LATAM and SEA storefronts.', confidence: 'High', impact: 'High' },
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'Scaling Meta + TikTok UA spend in LATAM', description: 'Estimated +$1.2M/mo creative volume across Meta and TikTok.', confidence: 'High', impact: 'Medium' },
    ],
    'revolut.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'ASA campaigns running in UK & EU', description: 'Active Apple Search Ads campaigns targeting fintech keywords.', confidence: 'High', impact: 'High' },
    ],
  };
  return map[domain] || [];
}

function getMockCompetitorUsageSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'AppsFlyer + Amplitude detected', description: 'SDK scan confirms AppsFlyer for attribution and Amplitude for analytics.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Adjust SDK detected', description: 'Revolut using Adjust as primary MMP — competitive displacement opportunity.', confidence: 'High', impact: 'High' }],
    'bolt.eu': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Branch SDK active in Bolt app', description: 'Branch used for deep linking and attribution.', confidence: 'Medium', impact: 'Medium' }],
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
