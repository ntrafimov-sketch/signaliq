import type { Signal } from '../types';

const API_KEY = import.meta.env.VITE_AMPLEMARKET_API_KEY;
const BASE_URL = 'https://api.amplemarket.com/v1';

export interface AmplemarketPerson {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  company: string;
  linkedinUrl: string;
  location: string;
  department: string;
}

export interface AmplemarketSequence {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  steps: number;
  enrolledCount: number;
}

export interface AmplemarketUser {
  id: string;
  email: string;
  name: string;
  organization: string;
}

async function fetchAmplemarket(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Amplemarket API error ${response.status}: ${body}`);
  }
  return response.json();
}

export function isConfigured(): boolean {
  return !!API_KEY;
}

export async function testConnection(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    await fetchAmplemarket('/me');
    return true;
  } catch {
    return false;
  }
}

export async function getContactData(email: string): Promise<AmplemarketPerson | null> {
  if (!API_KEY) return getMockPerson(email);
  try {
    const data = await fetchAmplemarket(`/people/search?email=${encodeURIComponent(email)}`);
    return data?.people?.[0] ?? data ?? null;
  } catch {
    return null;
  }
}

export async function getPeopleByDomain(domain: string): Promise<AmplemarketPerson[]> {
  if (!API_KEY) return [];
  try {
    const data = await fetchAmplemarket(`/people/search?domain=${encodeURIComponent(domain)}`);
    return data?.people ?? data ?? [];
  } catch {
    return [];
  }
}

export async function getSequences(): Promise<AmplemarketSequence[]> {
  if (!API_KEY) return getMockSequences();
  try {
    const data = await fetchAmplemarket('/sequences');
    return data?.sequences ?? data ?? [];
  } catch {
    return getMockSequences();
  }
}

export async function enrollInSequence(personId: string, sequenceId: string): Promise<boolean> {
  if (!API_KEY) {
    console.log(`Mock: Enrolling person ${personId} in sequence ${sequenceId}`);
    return true;
  }
  try {
    await fetchAmplemarket('/sequences/enroll', {
      method: 'POST',
      body: JSON.stringify({ personId, sequenceId }),
    });
    return true;
  } catch {
    return false;
  }
}

export async function getAdSpendSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockAdSignals(domain);
  try {
    const data = await fetchAmplemarket(`/signals/ad-spend?domain=${encodeURIComponent(domain)}`);
    return data?.signals ?? [];
  } catch {
    return [];
  }
}

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockPerson(email: string): AmplemarketPerson {
  return {
    id: `mock-${email}`,
    firstName: 'John',
    lastName: 'Doe',
    title: 'Head of Growth',
    email,
    company: 'Unknown',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    location: 'San Francisco, CA',
    department: 'Marketing',
  };
}

function getMockSequences(): AmplemarketSequence[] {
  return [
    { id: 'seq1', name: 'MMP Evaluation Sequence', status: 'active', steps: 5, enrolledCount: 24 },
    { id: 'seq2', name: 'Cold Outreach - Fintech', status: 'active', steps: 4, enrolledCount: 18 },
  ];
}

function getMockAdSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      {
        type: 'Using ASA',
        category: 'Ad Spend',
        source: 'Amplemarket',
        title: 'Active Apple Search Ads Campaigns',
        description: 'Running 200+ active ASA campaigns across 15 markets',
        confidence: 'High',
        impact: 'High',
      },
      {
        type: 'Using Meta/TT',
        category: 'Ad Spend',
        source: 'Amplemarket',
        title: 'Heavy Meta & TikTok Spend Detected',
        description: 'Large-scale paid social campaigns on Meta and TikTok',
        confidence: 'Medium',
        impact: 'High',
      },
    ],
  };
  return map[domain] ?? [];
}
