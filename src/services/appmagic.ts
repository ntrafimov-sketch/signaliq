import type { Signal } from '../types';

const BASE_URL = 'https://api.appmagic.rocks/v1';
const LOGIN = import.meta.env.VITE_APPMAGIC_LOGIN;
const PASSWORD = import.meta.env.VITE_APPMAGIC_PASSWORD;

// Store codes: 1=Google Play, 2=iPhone App Store, 3=iPad App Store
const STORES = [1, 2] as const;

// Competitor MMP/analytics SDK names to detect
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
  const res = await fetch(url, { headers: { Authorization: authHeader() } });
  if (!res.ok) throw new Error(`AppMagic ${res.status}: ${path}`);
  return res.json();
}


// ---------------------------------------------------------------------------
// App lookup: find apps for a publisher by domain or company name
// ---------------------------------------------------------------------------

interface AppRecord {
  united_id: number;
  name: string;
  publisher: string;
  store: string;
  store_ids: Record<string, string>;
  revenue_30d: number;
  downloads_30d: number;
  domain: string | null;
}

async function findAppsByDomain(domain: string, companyName: string): Promise<AppRecord[]> {
  // Try searching by domain first, then company name
  const queries = [domain.replace(/\.(com|io|app|co|net|org)$/, ''), companyName.split(' ')[0]];

  for (const query of queries) {
    for (const store of STORES) {
      try {
        const results = await apiGet('/tops/advanced-search', {
          store,
          description: query,
          size: 10,
          sort: 'revenue',
          revenue_from: 0,
          release_date_gte: '2010-01-01',
          release_date_lte: '2030-01-01',
        }) as unknown[];

        if (!Array.isArray(results) || results.length === 0) continue;

        const apps: AppRecord[] = results.map((record: unknown) => {
          const r = record as Record<string, unknown>;
          const app = (r['application'] as Record<string, unknown>) || r;
          const pub = (app['united_publisher'] as Record<string, unknown>) || {};
          const tags = (app['tags'] as Array<{ type: string; name: string }>) || [];
          const domainTag = tags.find(t => t.type === 'domain')?.name || null;
          return {
            united_id: app['id'] as number,
            name: app['name'] as string,
            publisher: (pub['name'] as string) || (app['publisher_name'] as string),
            store: store === 1 ? 'Google Play' : 'App Store',
            store_ids: (app['store_ids'] as Record<string, string>) || {},
            revenue_30d: (app['revenue'] as number) || 0,
            downloads_30d: (app['downloads'] as number) || 0,
            domain: domainTag,
          };
        });

        // Filter: prefer apps whose domain tag matches our domain
        const domainBase = domain.replace(/^www\./, '').toLowerCase();
        const matched = apps.filter(a =>
          (a.domain && a.domain.toLowerCase().includes(domainBase)) ||
          (a.publisher && a.publisher.toLowerCase().includes(companyName.toLowerCase().split(' ')[0]))
        );

        if (matched.length > 0) return matched.slice(0, 3);
        if (apps.length > 0) return apps.slice(0, 2);
      } catch {
        // continue to next query/store
      }
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Revenue history → trend signal
// ---------------------------------------------------------------------------

interface HistoryPoint { date: string; revenue?: number; downloads?: number; }

function detectTrend(points: HistoryPoint[], field: 'revenue' | 'downloads'): { trend: 'increasing' | 'decreasing' | 'stable'; changePercent: number } {
  const values = points.map(p => p[field] || 0).filter(v => v > 0);
  if (values.length < 2) return { trend: 'stable', changePercent: 0 };

  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondHalf = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);

  if (firstHalf === 0) return { trend: 'stable', changePercent: 0 };
  const changePercent = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);

  if (changePercent > 10) return { trend: 'increasing', changePercent };
  if (changePercent < -10) return { trend: 'decreasing', changePercent };
  return { trend: 'stable', changePercent };
}

async function getRevenueHistory(store: number, appId: string): Promise<HistoryPoint[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 90);
  try {
    const result = await apiGet(`/history/applications/${store}/${appId}/revenue`, {
      country: 'WW',
      date_from: from.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0],
    });
    return Array.isArray(result) ? result as HistoryPoint[] : [];
  } catch {
    return [];
  }
}

async function getDownloadsHistory(store: number, appId: string): Promise<HistoryPoint[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 90);
  try {
    const result = await apiGet(`/history/applications/${store}/${appId}/downloads`, {
      country: 'WW',
      date_from: from.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0],
    });
    return Array.isArray(result) ? result as HistoryPoint[] : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// SDK detection → competitor signal
// ---------------------------------------------------------------------------

interface SdkRecord { name: string; category: string; }

async function getAppSdks(store: number, appId: string): Promise<SdkRecord[]> {
  try {
    const result = await apiGet('/sdkint/sdks', { store, store_application_id: appId });
    return Array.isArray(result) ? result as SdkRecord[] : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Ad intelligence → ad channel signals
// ---------------------------------------------------------------------------

interface AdRecord { type: string; ad_network: string; }

async function getAppAds(appIds: string[], _store: number): Promise<AdRecord[]> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  const dateFrom = from.toISOString().split('T')[0];
  const dateTo = today.toISOString().split('T')[0];

  try {
    const url = `https://api.appmagic.rocks/adint/application-ads?${new URLSearchParams({
      appIds: appIds.join(','),
      country: 'WW',
      dateFrom,
      dateTo,
      sort: 'score',
      aggregation: 'month',
      count: '20',
      offset: '0',
    }).toString()}`;
    const result = await apiGet(url);
    return Array.isArray(result) ? result as AdRecord[] : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main exported functions
// ---------------------------------------------------------------------------

export async function getRevenueSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockRevenueSignals(domain);

  try {
    const apps = await findAppsByDomain(domain, companyName || domain);
    if (apps.length === 0) return [];

    const app = apps[0];
    const storeNum = app.store === 'Google Play' ? 1 : 2;
    const appId = Object.values(app.store_ids)[0];
    if (!appId) return [];

    const history = await getRevenueHistory(storeNum, appId);
    if (history.length === 0) return [];

    const { trend, changePercent } = detectTrend(history, 'revenue');
    const absChange = Math.abs(changePercent);

    if (trend === 'increasing') {
      return [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', confidence: absChange > 30 ? 'High' : 'Medium', impact: absChange > 30 ? 'High' : 'Medium', title: `${app.name} revenue up ${absChange}% QoQ`, description: `App revenue growing ${absChange}% over the last 90 days across ${app.store}. UA investment window is open.` }];
    }
    if (trend === 'decreasing') {
      return [{ type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', confidence: 'Medium', impact: 'Medium', title: `${app.name} revenue down ${absChange}%`, description: `App revenue dropped ${absChange}% — potential pain point driving MMP re-evaluation.` }];
    }
    return [{ type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', confidence: 'Medium', impact: 'Low', title: `${app.name} revenue plateaued`, description: `Revenue growth flat at ±${absChange}% — rising CAC may push them to evaluate new UA channels.` }];
  } catch {
    return getMockRevenueSignals(domain);
  }
}

export async function getDownloadSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockDownloadSignals(domain);

  try {
    const apps = await findAppsByDomain(domain, companyName || domain);
    if (apps.length === 0) return [];

    const app = apps[0];
    const storeNum = app.store === 'Google Play' ? 1 : 2;
    const appId = Object.values(app.store_ids)[0];
    if (!appId) return [];

    const history = await getDownloadsHistory(storeNum, appId);
    if (history.length === 0) return [];

    const { trend, changePercent } = detectTrend(history, 'downloads');
    const absChange = Math.abs(changePercent);

    if (trend === 'increasing') {
      return [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', confidence: absChange > 25 ? 'High' : 'Medium', impact: absChange > 25 ? 'High' : 'Medium', title: `${app.name} installs up ${absChange}% MoM`, description: `App downloads grew ${absChange}% in the last 90 days — active UA scaling underway.` }];
    }
    if (trend === 'decreasing') {
      return [{ type: 'Download Decrease', category: 'Downloads', source: 'AppMagic', confidence: 'Medium', impact: 'Medium', title: `${app.name} installs down ${absChange}%`, description: `Download volume fell ${absChange}% — may be optimizing toward quality or facing channel saturation.` }];
    }
    return [{ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', confidence: 'Medium', impact: 'Low', title: `${app.name} install growth flat`, description: `Downloads plateaued at ±${absChange}% — organic ceiling may be driving paid UA interest.` }];
  } catch {
    return getMockDownloadSignals(domain);
  }
}

export async function getAdChannelSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockAdChannelSignals(domain);

  try {
    const apps = await findAppsByDomain(domain, companyName || domain);
    if (apps.length === 0) return [];

    const app = apps[0];
    const storeNum = app.store === 'Google Play' ? 1 : 2;
    const appId = Object.values(app.store_ids)[0];
    if (!appId) return [];

    const ads = await getAppAds([appId], storeNum);
    if (ads.length === 0) return [];

    const networks = new Set(ads.map(a => a.ad_network?.toLowerCase()));
    const hasW2A = ads.some(a => a.type?.toLowerCase().includes('web2app'));
    const signals: Partial<Signal>[] = [];

    if (networks.has('facebook') || networks.has('meta')) {
      signals.push({ type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'High', title: `${app.name} running Meta/TikTok UA`, description: `Active ad creatives detected on Meta/TikTok networks for ${app.name}.` });
    }
    if (networks.has('admob') || networks.has('applovin') || networks.has('unity')) {
      signals.push({ type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'Medium', title: `${app.name} running in-app ad campaigns`, description: `Ad creatives detected on ${Array.from(networks).join(', ')} for ${app.name}.` });
    }
    if (hasW2A) {
      signals.push({ type: 'Using W2A', category: 'Ad Spend', source: 'AppMagic', confidence: 'High', impact: 'Medium', title: `${app.name} using web-to-app funnel`, description: `Web-to-app ad creatives detected — driving web traffic to app installs.` });
    }

    return signals;
  } catch {
    return getMockAdChannelSignals(domain);
  }
}

export async function getCompetitorUsageSignals(domain: string, companyName = ''): Promise<Partial<Signal>[]> {
  if (!hasCredentials()) return getMockCompetitorUsageSignals(domain);

  try {
    const apps = await findAppsByDomain(domain, companyName || domain);
    if (apps.length === 0) return [];

    const app = apps[0];
    const storeNum = app.store === 'Google Play' ? 1 : 2;
    const appId = Object.values(app.store_ids)[0];
    if (!appId) return [];

    const sdks = await getAppSdks(storeNum, appId);
    const foundCompetitors = sdks
      .filter(s => COMPETITOR_SDKS.some(c => s.name?.toLowerCase().includes(c)))
      .map(s => s.name);

    if (foundCompetitors.length === 0) return [];

    return [{
      type: 'Using Competitors',
      category: 'Competitive',
      source: 'AppMagic',
      confidence: 'High',
      impact: 'High',
      title: `${foundCompetitors.slice(0, 2).join(' + ')} detected in ${app.name}`,
      description: `SDK scan confirmed: ${foundCompetitors.join(', ')} installed in ${app.name}. Competitive displacement opportunity.`,
    }];
  } catch {
    return getMockCompetitorUsageSignals(domain);
  }
}

export async function testConnection(): Promise<boolean> {
  if (!hasCredentials()) return false;
  try {
    await apiGet('/tops/advanced-search', { store: 2, description: 'test', size: 1, sort: 'revenue', revenue_from: 0, release_date_gte: '2010-01-01', release_date_lte: '2030-01-01' });
    return true;
  } catch {
    return false;
  }
}

// ── Mock fallbacks (used when credentials absent) ─────────────────────────

function getMockRevenueSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Mobile app revenue increased 42%', description: 'Quarter-over-quarter growth in iOS and Android in-app revenue across primary markets.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Revenue +28% in European markets', description: 'Strong premium subscription revenue growth across EU markets.', confidence: 'High', impact: 'High' }],
    'wise.com': [{ type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', title: 'Revenue growth plateaued at 3% QoQ', description: 'Wise app revenue growth has stabilized; CAC rising.', confidence: 'Medium', impact: 'Medium' }],
    'bolt.eu': [{ type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Bolt app revenue up 31% YoY', description: 'Strong ride-hailing and food delivery revenue growth.', confidence: 'High', impact: 'High' }],
    'spotify.com': [{ type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', title: 'Premium subscriber growth slowing', description: 'New subscriber growth decelerated with rising acquisition costs.', confidence: 'Medium', impact: 'Low' }],
  };
  return map[domain] || [];
}

function getMockDownloadSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'App installs up 28% MoM', description: 'Uber app downloads surged 28% month-over-month driven by LATAM expansion.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'Downloads up 22% in EU markets', description: 'Revolut seeing strong install growth across Germany, France, and Poland.', confidence: 'High', impact: 'High' }],
    'bolt.eu': [{ type: 'Download Increase', category: 'Downloads', source: 'AppMagic', title: 'Bolt installs +35% in Africa', description: 'Strong download growth in Nigeria, Kenya, and South Africa.', confidence: 'High', impact: 'High' }],
    'wise.com': [{ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', title: 'Download growth flattening at 2% MoM', description: 'Wise app install growth has stabilized in core markets.', confidence: 'Medium', impact: 'Medium' }],
    'klarna.com': [{ type: 'Download Decrease', category: 'Downloads', source: 'AppMagic', title: 'Installs down 12% in US market', description: 'Klarna app downloads declined following BNPL regulatory scrutiny.', confidence: 'Medium', impact: 'Medium' }],
    'spotify.com': [{ type: 'Download Plateau', category: 'Downloads', source: 'AppMagic', title: 'Spotify installs flat in mature markets', description: 'Market saturation driving focus to retention over acquisition.', confidence: 'High', impact: 'Low' }],
  };
  return map[domain] || [];
}

function getMockAdChannelSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'Apple Search Ads activated in 7 new markets', description: 'ASA keyword footprint expanded into LATAM and SEA storefronts.', confidence: 'High', impact: 'High' },
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'Scaling Meta + TikTok UA spend in LATAM', description: 'Estimated +$1.2M/mo creative volume across Meta and TikTok.', confidence: 'High', impact: 'Medium' },
      { type: 'Using W2A', category: 'Ad Spend', source: 'AppMagic', title: 'Web-to-app funnel deployed for rider acquisition', description: 'New W2A campaign driving traffic from Uber.com to app installs.', confidence: 'Medium', impact: 'Medium' },
    ],
    'revolut.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'ASA campaigns running in UK & EU', description: 'Active Apple Search Ads campaigns targeting fintech keywords.', confidence: 'High', impact: 'High' },
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'Meta UA scaling for premium acquisition', description: 'Heavy Meta spend on premium subscriber acquisition campaigns.', confidence: 'Medium', impact: 'High' },
    ],
  };
  return map[domain] || [];
}

function getMockCompetitorUsageSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'AppsFlyer + Amplitude detected in production', description: 'SDK scan confirms AppsFlyer for attribution and Amplitude for analytics.', confidence: 'High', impact: 'High' }],
    'revolut.com': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Adjust SDK detected across all app versions', description: 'Revolut using Adjust as primary MMP — competitive displacement opportunity.', confidence: 'High', impact: 'High' }],
    'bolt.eu': [{ type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Branch SDK active in Bolt app', description: 'Branch used for deep linking and attribution across Bolt apps.', confidence: 'Medium', impact: 'Medium' }],
  };
  return map[domain] || [];
}

// Legacy export kept for AppMagicAppData type consumers
export interface AppMagicAppData {
  appId: string;
  appName: string;
  bundleId: string;
  publisher: string;
  category: string;
  revenue: { monthly: number; quarterly: number; yearly: number; trend: string; changePercent: number };
  downloads: { monthly: number; quarterly: number; trend: string; changePercent: number };
  adChannels?: { asa: boolean; meta: boolean; tiktok: boolean; w2a: boolean };
  topCompetitors?: string[];
  markets: string[];
}

export async function getAppDataByPublisher(_domain: string): Promise<AppMagicAppData[]> {
  return [];
}
