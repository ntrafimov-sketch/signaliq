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
  markets: string[];
}

async function fetchAppMagic(path: string, options: RequestInit = {}) {
  if (!API_KEY) {
    throw new Error('AppMagic API key not configured');
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`AppMagic API error: ${response.status}`);
  }
  return response.json();
}

export async function getAppDataByPublisher(publisherDomain: string): Promise<AppMagicAppData[]> {
  if (!API_KEY) {
    const mockData: Record<string, AppMagicAppData[]> = {
      'uber.com': [
        {
          appId: 'app-uber',
          appName: 'Uber - Request a ride',
          bundleId: 'com.ubercab.UberClient',
          publisher: 'Uber Technologies',
          category: 'Travel',
          revenue: {
            monthly: 285000000,
            quarterly: 855000000,
            yearly: 3200000000,
            trend: 'increasing',
            changePercent: 34,
          },
          downloads: {
            monthly: 4200000,
            quarterly: 11800000,
            trend: 'increasing',
            changePercent: 28,
          },
          markets: ['US', 'UK', 'AU', 'FR', 'DE', 'BR', 'IN'],
        },
      ],
      'revolut.com': [
        {
          appId: 'app-revolut',
          appName: 'Revolut: Send, Save & Spend',
          bundleId: 'com.revolut.revolut',
          publisher: 'Revolut Ltd',
          category: 'Finance',
          revenue: {
            monthly: 89000000,
            quarterly: 267000000,
            yearly: 920000000,
            trend: 'increasing',
            changePercent: 28,
          },
          downloads: {
            monthly: 1800000,
            quarterly: 5200000,
            trend: 'increasing',
            changePercent: 22,
          },
          markets: ['UK', 'FR', 'DE', 'ES', 'PL', 'IE'],
        },
      ],
    };
    return mockData[publisherDomain] || [];
  }
  try {
    const data = await fetchAppMagic(`/apps/publisher?domain=${encodeURIComponent(publisherDomain)}`);
    return data.apps || [];
  } catch {
    return [];
  }
}

export async function getRevenueSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) {
    const mockSignals: Record<string, Partial<Signal>[]> = {
      'uber.com': [
        {
          type: 'Revenue Increase',
          category: 'Revenue',
          source: 'AppMagic',
          title: 'Q4 Revenue Surge +34% YoY',
          description: 'Uber app revenue increased 34% YoY based on in-app purchase data',
          confidence: 'High',
          impact: 'High',
        },
        {
          type: 'Revenue Increase',
          category: 'Revenue',
          source: 'AppMagic',
          title: 'App Downloads Up 28% MoM',
          description: 'Monthly app installs up 28% indicating strong paid UA investment',
          confidence: 'High',
          impact: 'High',
        },
      ],
      'revolut.com': [
        {
          type: 'Revenue Increase',
          category: 'Revenue',
          source: 'AppMagic',
          title: 'Revenue +28% in European Markets',
          description: 'Strong premium subscription revenue growth across EU markets',
          confidence: 'High',
          impact: 'High',
        },
      ],
      'spotify.com': [
        {
          type: 'Revenue Decrease',
          category: 'Revenue',
          source: 'AppMagic',
          title: 'Premium Subscriber Growth Slowing',
          description: 'New subscriber growth decelerated with rising acquisition costs',
          confidence: 'Medium',
          impact: 'Low',
        },
      ],
    };
    return mockSignals[domain] || [];
  }
  try {
    const data = await fetchAppMagic(`/signals/revenue?domain=${encodeURIComponent(domain)}`);
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
