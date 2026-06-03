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
  if (!API_KEY) throw new Error('Demandbase API key not configured');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`Demandbase API error: ${response.status}`);
  return response.json();
}

export async function getAccountIntelligence(domain: string): Promise<DemandbaseAccount | null> {
  if (!API_KEY) return getMockAccountIntel(domain);
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

// Was on our website (web analytics / IP identification)
export async function getWebsiteVisitSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockWebsiteSignals(domain);
  try {
    const data = await fetchDemandbase(`/signals/website?domain=${encodeURIComponent(domain)}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

// Competitor Research (intent data)
export async function getCompetitorResearchSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockCompetitorResearchSignals(domain);
  try {
    const data = await fetchDemandbase(`/signals/intent?domain=${encodeURIComponent(domain)}`);
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

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockAccountIntel(domain: string): DemandbaseAccount | null {
  const map: Record<string, DemandbaseAccount> = {
    'uber.com': { id: 'db-uber', domain: 'uber.com', company_name: 'Uber', industry: 'Transportation', employee_count: 32800, revenue: 37200000000, intent_score: 92, topics: ['mobile attribution', 'MMP', 'user acquisition', 'app marketing'] },
    'revolut.com': { id: 'db-revolut', domain: 'revolut.com', company_name: 'Revolut', industry: 'Financial Services', employee_count: 9800, revenue: 2200000000, intent_score: 88, topics: ['mobile attribution', 'fintech marketing', 'growth hacking'] },
  };
  return map[domain] || null;
}

function getMockWebsiteSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Was on our website', category: 'Website', source: 'Demandbase', title: '3 visits to pricing page from Uber IPs', description: 'Anonymous sessions from Uber corporate IP ranges viewed pricing and the mobile attribution case study.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Was on our website', category: 'Website', source: 'Demandbase', title: 'Revolut team visited integration docs', description: '2 sessions from Revolut IP ranges spent 8+ minutes on SDK integration documentation.', confidence: 'High', impact: 'Medium' },
    ],
    'bolt.eu': [
      { type: 'Was on our website', category: 'Website', source: 'Demandbase', title: 'Bolt visited pricing & comparison pages', description: 'IP identified as Bolt HQ visited pricing page and competitor comparison guide.', confidence: 'Medium', impact: 'High' },
    ],
  };
  return map[domain] || [];
}

function getMockCompetitorResearchSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Competitor Research', category: 'Competitive', source: 'Demandbase', title: 'High intent on MMP evaluation topics', description: 'Uber employees showing strong intent signals around MMP comparison and mobile attribution evaluation pages.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Competitor Research', category: 'Competitive', source: 'Demandbase', title: 'Researching attribution alternatives', description: 'Revolut team consuming content around mobile attribution platforms and switching guides.', confidence: 'Medium', impact: 'High' },
    ],
    'klarna.com': [
      { type: 'Competitor Research', category: 'Competitive', source: 'Demandbase', title: 'Intent spike on MMP comparison content', description: 'Klarna showing 3x intent increase on mobile measurement and attribution vendor comparison topics.', confidence: 'Medium', impact: 'Medium' },
    ],
  };
  return map[domain] || [];
}
