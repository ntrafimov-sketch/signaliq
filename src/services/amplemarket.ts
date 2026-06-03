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
  if (!API_KEY) {
    throw new Error('Amplemarket API key not configured');
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
    throw new Error(`Amplemarket API error: ${response.status}`);
  }
  return response.json();
}

export async function getContactData(email: string): Promise<AmplemarketPerson | null> {
  if (!API_KEY) {
    // Mock fallback
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
  try {
    return await fetchAmplemarket(`/people/search?email=${encodeURIComponent(email)}`);
  } catch {
    return null;
  }
}

export async function getPeopleByDomain(domain: string): Promise<AmplemarketPerson[]> {
  if (!API_KEY) {
    return [];
  }
  try {
    return await fetchAmplemarket(`/people/search?domain=${encodeURIComponent(domain)}`);
  } catch {
    return [];
  }
}

export async function getAdSpendSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) {
    // Mock signals for known domains
    const mockAdSignals: Record<string, Partial<Signal>[]> = {
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
    return mockAdSignals[domain] || [];
  }
  try {
    const data = await fetchAmplemarket(`/signals/ad-spend?domain=${encodeURIComponent(domain)}`);
    return data.signals || [];
  } catch {
    return [];
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

export async function getSequences(): Promise<AmplemarketSequence[]> {
  if (!API_KEY) {
    return [
      { id: 'seq1', name: 'MMP Evaluation Sequence', status: 'active', steps: 5, enrolledCount: 24 },
      { id: 'seq2', name: 'Cold Outreach - Fintech', status: 'active', steps: 4, enrolledCount: 18 },
    ];
  }
  try {
    const data = await fetchAmplemarket('/sequences');
    return data.sequences || [];
  } catch {
    return [];
  }
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
