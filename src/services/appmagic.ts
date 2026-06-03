import type { Signal } from '../types';

const API_KEY = import.meta.env.VITE_APPMAGIC_API_KEY;
const BASE_URL = 'https://api.appmagic.rocks/v1';

export interface AppMagicAppData {
  appId: string;
  appName: string;
  bundleId: string;
  publisher: string;
  category: string;
  revenue: {
    monthly: number;
    quarterly: number;
    yearly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  };
  downloads: {
    monthly: number;
    quarterly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  };
  adChannels?: {
    asa: boolean;
    meta: boolean;
    tiktok: boolean;
    w2a: boolean;
  };
  topCompetitors?: string[];
  markets: string[];
}

async function fetchAppMagic(path: string, options: RequestInit = {}) {
  if (!API_KEY) throw new Error('AppMagic API key not configured');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`AppMagic API error: ${response.status}`);
  return response.json();
}

export async function getAppDataByPublisher(publisherDomain: string): Promise<AppMagicAppData[]> {
  if (!API_KEY) return getMockAppData(publisherDomain);
  try {
    const data = await fetchAppMagic(`/apps/publisher?domain=${encodeURIComponent(publisherDomain)}`);
    return data.apps || [];
  } catch {
    return [];
  }
}

// Revenue Increase / Decrease / Plateau
export async function getRevenueSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockRevenueSignals(domain);
  try {
    const data = await fetchAppMagic(`/signals/revenue?domain=${encodeURIComponent(domain)}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

// Using ASA / Using Meta/TT / Using W2A
export async function getAdChannelSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockAdChannelSignals(domain);
  try {
    const data = await fetchAppMagic(`/signals/ad-channels?domain=${encodeURIComponent(domain)}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

// Using Competitors
export async function getCompetitorUsageSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockCompetitorUsageSignals(domain);
  try {
    const data = await fetchAppMagic(`/signals/competitors?domain=${encodeURIComponent(domain)}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

export async function testConnection(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    await fetchAppMagic('/status');
    return true;
  } catch {
    return false;
  }
}

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockAppData(domain: string): AppMagicAppData[] {
  const map: Record<string, AppMagicAppData[]> = {
    'uber.com': [{
      appId: 'app-uber', appName: 'Uber - Request a ride',
      bundleId: 'com.ubercab.UberClient', publisher: 'Uber Technologies',
      category: 'Travel',
      revenue: { monthly: 285000000, quarterly: 855000000, yearly: 3200000000, trend: 'increasing', changePercent: 42 },
      downloads: { monthly: 4200000, quarterly: 11800000, trend: 'increasing', changePercent: 28 },
      adChannels: { asa: true, meta: true, tiktok: true, w2a: true },
      topCompetitors: ['AppsFlyer', 'Adjust', 'Branch'],
      markets: ['US', 'UK', 'AU', 'FR', 'DE', 'BR', 'IN'],
    }],
    'revolut.com': [{
      appId: 'app-revolut', appName: 'Revolut: Send, Save & Spend',
      bundleId: 'com.revolut.revolut', publisher: 'Revolut Ltd',
      category: 'Finance',
      revenue: { monthly: 89000000, quarterly: 267000000, yearly: 920000000, trend: 'increasing', changePercent: 28 },
      downloads: { monthly: 1800000, quarterly: 5200000, trend: 'increasing', changePercent: 22 },
      adChannels: { asa: true, meta: true, tiktok: false, w2a: true },
      topCompetitors: ['AppsFlyer', 'Adjust'],
      markets: ['UK', 'FR', 'DE', 'ES', 'PL', 'IE'],
    }],
  };
  return map[domain] || [];
}

function getMockRevenueSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Mobile app revenue increased 42%', description: 'Quarter-over-quarter growth in iOS and Android in-app revenue across primary markets.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Revenue +28% in European markets', description: 'Strong premium subscription revenue growth across EU markets driven by premium tier adoption.', confidence: 'High', impact: 'High' },
    ],
    'wise.com': [
      { type: 'Revenue Plateau', category: 'Revenue', source: 'AppMagic', title: 'Revenue growth plateaued at 3% QoQ', description: 'Wise app revenue growth has stabilized after strong expansion period; CAC rising.', confidence: 'Medium', impact: 'Medium' },
    ],
    'bolt.eu': [
      { type: 'Revenue Increase', category: 'Revenue', source: 'AppMagic', title: 'Bolt app revenue up 31% YoY', description: 'Strong ride-hailing and food delivery revenue growth across European markets.', confidence: 'High', impact: 'High' },
    ],
    'spotify.com': [
      { type: 'Revenue Decrease', category: 'Revenue', source: 'AppMagic', title: 'Premium subscriber growth slowing', description: 'New subscriber growth decelerated with rising acquisition costs in saturated markets.', confidence: 'Medium', impact: 'Low' },
    ],
  };
  return map[domain] || [];
}

function getMockAdChannelSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'Apple Search Ads activated in 7 new markets', description: 'ASA keyword footprint expanded into LATAM and SEA storefronts over the past 14 days.', confidence: 'High', impact: 'High' },
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'Scaling Meta + TikTok UA spend in LATAM', description: 'Estimated +$1.2M/mo creative volume across Meta and TikTok targeting Mexico and Brazil.', confidence: 'High', impact: 'Medium' },
      { type: 'Using W2A', category: 'Ad Spend', source: 'AppMagic', title: 'Web-to-app funnel deployed for rider acquisition', description: 'New W2A campaign driving traffic from Uber.com to app installs across 4 markets.', confidence: 'Medium', impact: 'Medium' },
    ],
    'revolut.com': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'ASA campaigns running in UK & EU', description: 'Active Apple Search Ads campaigns targeting fintech keywords across 6 European markets.', confidence: 'High', impact: 'High' },
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'Meta UA scaling for premium acquisition', description: 'Heavy Meta spend on premium subscriber acquisition campaigns.', confidence: 'Medium', impact: 'High' },
    ],
    'bolt.eu': [
      { type: 'Using ASA', category: 'Ad Spend', source: 'AppMagic', title: 'ASA campaigns active in 5 markets', description: 'Bolt running Apple Search Ads for both ride-hailing and food delivery apps.', confidence: 'High', impact: 'Medium' },
    ],
    'klarna.com': [
      { type: 'Using Meta/TT', category: 'Ad Spend', source: 'AppMagic', title: 'TikTok ads driving BNPL installs', description: 'Klarna using TikTok for Gen Z-targeted buy-now-pay-later app campaigns.', confidence: 'Medium', impact: 'Medium' },
    ],
  };
  return map[domain] || [];
}

function getMockCompetitorUsageSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Detected AppsFlyer + Amplitude in production', description: 'SDK scan confirms AppsFlyer for attribution and Amplitude for product analytics across iOS and Android.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Adjust SDK detected across all app versions', description: 'Revolut using Adjust as primary MMP — competitive displacement opportunity.', confidence: 'High', impact: 'High' },
    ],
    'bolt.eu': [
      { type: 'Using Competitors', category: 'Competitive', source: 'AppMagic', title: 'Branch SDK active in Bolt app', description: 'Branch used for deep linking and attribution across Bolt ride and food apps.', confidence: 'Medium', impact: 'Medium' },
    ],
  };
  return map[domain] || [];
}
