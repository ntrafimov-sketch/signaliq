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

// Hiring In Relevant Department
export async function getHiringSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockHiringSignals(domain);
  try {
    const data = await fetchAmplemarket(`/signals/hiring?domain=${encodeURIComponent(domain)}`);
    return data?.signals ?? [];
  } catch {
    return [];
  }
}

// Post from market leaders / Post mentioned specific keywords
export async function getSocialSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockSocialSignals(domain);
  try {
    const data = await fetchAmplemarket(`/signals/social?domain=${encodeURIComponent(domain)}`);
    return data?.signals ?? [];
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

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockPerson(email: string): AmplemarketPerson {
  return {
    id: `mock-${email}`,
    firstName: 'John', lastName: 'Doe',
    title: 'Head of Growth', email,
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

function getMockHiringSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Hiring In Relevant Department', category: 'Hiring', source: 'Amplemarket', title: 'Hiring 18 mobile engineers', description: 'Active roles across iOS, Android, and platform infrastructure on the careers site.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Hiring In Relevant Department', category: 'Hiring', source: 'Amplemarket', title: 'Hiring 12 growth & UA specialists', description: 'Multiple open roles for user acquisition and growth marketing across European markets.', confidence: 'High', impact: 'High' },
    ],
    'bolt.eu': [
      { type: 'Hiring In Relevant Department', category: 'Hiring', source: 'Amplemarket', title: 'Hiring mobile marketing manager', description: 'Open role for mobile marketing manager to own app growth strategy.', confidence: 'Medium', impact: 'Medium' },
    ],
    'klarna.com': [
      { type: 'Hiring In Relevant Department', category: 'Hiring', source: 'Amplemarket', title: 'Hiring performance marketing lead', description: 'Klarna seeking senior performance marketer to own paid UA across iOS and Android.', confidence: 'High', impact: 'Medium' },
    ],
  };
  return map[domain] || [];
}

function getMockSocialSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Post from market leaders', category: 'Social', source: 'Amplemarket', title: 'Uber VP posted on mobile growth', description: 'Sarah Johnson (VP Engineering) shared post on scaling mobile infrastructure for LATAM expansion.', confidence: 'Medium', impact: 'Medium' },
      { type: 'Post mentioned specific keywords', category: 'Social', source: 'Amplemarket', title: 'Post mentioned "attribution" and "MMP"', description: 'Uber growth team LinkedIn post discussed attribution challenges at scale — high buying intent keywords.', confidence: 'High', impact: 'High' },
    ],
    'revolut.com': [
      { type: 'Post mentioned specific keywords', category: 'Social', source: 'Amplemarket', title: 'Post mentioned "mobile attribution stack"', description: 'Revolut Head of Growth posted about evaluating their mobile attribution stack for accuracy.', confidence: 'High', impact: 'High' },
    ],
    'wise.com': [
      { type: 'Post from market leaders', category: 'Social', source: 'Amplemarket', title: 'Wise CMO posted on fintech user acquisition', description: 'CMO shared insights on CAC optimization challenges in mature fintech markets.', confidence: 'Medium', impact: 'Low' },
    ],
  };
  return map[domain] || [];
}
