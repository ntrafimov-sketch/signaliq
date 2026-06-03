import type { Signal } from '../types';

const API_KEY = import.meta.env.VITE_DEMANDBASE_API_KEY;
const BASE_URL = 'https://api.demandbase.com/v3';

export interface DemandbaseAccount {
  id: string;
  domain: string;
  company_name: string;
  industry: string;
  employee_count: number;
  revenue: number;
  intent_score: number;
  topics: string[];
}

export interface DemandbaseIntentData {
  domain: string;
  intent_score: number;
  trending_topics: string[];
  competitor_research: string[];
  buying_stage: 'awareness' | 'consideration' | 'decision';
}

async function fetchDemandbase(path: string, options: RequestInit = {}) {
  if (!API_KEY) {
    throw new Error('Demandbase API key not configured');
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Demandbase API error: ${response.status}`);
  }
  return response.json();
}

export async function getAccountIntelligence(domain: string): Promise<DemandbaseAccount | null> {
  if (!API_KEY) {
    const mockData: Record<string, DemandbaseAccount> = {
      'uber.com': {
        id: 'db-uber',
        domain: 'uber.com',
        company_name: 'Uber',
        industry: 'Transportation',
        employee_count: 32800,
        revenue: 37200000000,
        intent_score: 92,
        topics: ['mobile attribution', 'MMP', 'user acquisition', 'app marketing'],
      },
      'revolut.com': {
        id: 'db-revolut',
        domain: 'revolut.com',
        company_name: 'Revolut',
        industry: 'Financial Services',
        employee_count: 9800,
        revenue: 2200000000,
        intent_score: 88,
        topics: ['mobile attribution', 'fintech marketing', 'growth hacking'],
      },
    };
    return mockData[domain] || null;
  }
  try {
    return await fetchDemandbase(`/accounts?domain=${encodeURIComponent(domain)}`);
  } catch {
    return null;
  }
}

export async function getIntentData(domain: string): Promise<DemandbaseIntentData | null> {
  if (!API_KEY) {
    return {
      domain,
      intent_score: Math.floor(Math.random() * 40) + 60,
      trending_topics: ['mobile measurement', 'attribution', 'user acquisition'],
      competitor_research: ['AppsFlyer', 'Adjust', 'Branch'],
      buying_stage: 'consideration',
    };
  }
  try {
    return await fetchDemandbase(`/intent?domain=${encodeURIComponent(domain)}`);
  } catch {
    return null;
  }
}

export async function getCompetitiveSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) {
    const mockSignals: Record<string, Partial<Signal>[]> = {
      'uber.com': [
        {
          type: 'Using Competitors',
          category: 'Competitive',
          source: 'Demandbase',
          title: 'Using Adjust for Attribution',
          description: 'Uber uses Adjust as primary MMP — competitive displacement opportunity',
          confidence: 'High',
          impact: 'Medium',
        },
        {
          type: 'Competitor Research',
          category: 'Competitive',
          source: 'Demandbase',
          title: 'Researching MMP Alternatives',
          description: 'High intent signals for MMP evaluation from Uber employees',
          confidence: 'Medium',
          impact: 'High',
        },
      ],
    };
    return mockSignals[domain] || [];
  }
  try {
    const data = await fetchDemandbase(`/signals/competitive?domain=${encodeURIComponent(domain)}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

export async function testConnection(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    await fetchDemandbase('/status');
    return true;
  } catch {
    return false;
  }
}
