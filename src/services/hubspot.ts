import type { Signal } from '../types';

const API_KEY = import.meta.env.VITE_HUBSPOT_API_KEY;
const PORTAL_ID = import.meta.env.VITE_HUBSPOT_PORTAL_ID;
const BASE_URL = 'https://api.hubapi.com';

export interface HubSpotContact {
  id: string;
  properties: {
    firstname: string;
    lastname: string;
    email: string;
    jobtitle: string;
    company: string;
    lifecyclestage: string;
    hs_lead_status: string;
  };
}

export interface HubSpotCompany {
  id: string;
  properties: {
    name: string;
    domain: string;
    industry: string;
    numberofemployees: string;
    annualrevenue: string;
    city: string;
    country: string;
  };
}

async function fetchHubSpot(path: string, options: RequestInit = {}) {
  if (!API_KEY) throw new Error('HubSpot API key not configured');
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`HubSpot API error: ${response.status}`);
  return response.json();
}

export async function getContactsByDomain(domain: string): Promise<HubSpotContact[]> {
  if (!API_KEY) return [];
  try {
    const data = await fetchHubSpot(`/crm/v3/objects/contacts/search`, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'CONTAINS_TOKEN', value: `*@${domain}` }] }],
      }),
    });
    return data.results || [];
  } catch {
    return [];
  }
}

export async function getCompanyByDomain(domain: string): Promise<HubSpotCompany | null> {
  if (!API_KEY) return null;
  try {
    const data = await fetchHubSpot(`/crm/v3/objects/companies/search`, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'domain', operator: 'EQ', value: domain }] }],
      }),
    });
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

// Content Download
export async function getContentDownloadSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockContentDownloadSignals(domain);
  try {
    const data = await fetchHubSpot(`/marketing/v3/forms/submissions?domain=${domain}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

// Webinar Visited
export async function getWebinarSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) return getMockWebinarSignals(domain);
  try {
    void PORTAL_ID;
    const data = await fetchHubSpot(`/marketing/v3/events?contactDomain=${domain}&type=webinar`);
    return data.signals || [];
  } catch {
    return [];
  }
}

export async function syncAccountToCRM(accountData: { name: string; domain: string; industry: string; employees: number }): Promise<string | null> {
  if (!API_KEY) {
    console.log('Mock: Syncing account to HubSpot CRM', accountData);
    return `mock-hubspot-id-${Date.now()}`;
  }
  try {
    const data = await fetchHubSpot('/crm/v3/objects/companies', {
      method: 'POST',
      body: JSON.stringify({ properties: { name: accountData.name, domain: accountData.domain, industry: accountData.industry, numberofemployees: accountData.employees.toString() } }),
    });
    return data.id;
  } catch {
    return null;
  }
}

export async function testConnection(): Promise<boolean> {
  if (!API_KEY) return false;
  try {
    await fetchHubSpot('/crm/v3/objects/contacts?limit=1');
    return true;
  } catch {
    return false;
  }
}

// ── Mock fallbacks ────────────────────────────────────────────────────────────

function getMockContentDownloadSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Content Download', category: 'Content', source: 'HubSpot', title: 'Downloaded mobile attribution guide', description: 'An Uber employee downloaded our comprehensive guide on mobile attribution best practices.', confidence: 'High', impact: 'Medium' },
    ],
    'revolut.com': [
      { type: 'Content Download', category: 'Content', source: 'HubSpot', title: 'Downloaded fintech UA playbook', description: 'Revolut growth team member downloaded our user acquisition playbook for fintech apps.', confidence: 'High', impact: 'Medium' },
    ],
    'klarna.com': [
      { type: 'Content Download', category: 'Content', source: 'HubSpot', title: 'Downloaded BNPL attribution guide', description: 'Klarna team downloaded our guide on measuring paid UA for BNPL products.', confidence: 'Medium', impact: 'Medium' },
    ],
  };
  return map[domain] || [];
}

function getMockWebinarSignals(domain: string): Partial<Signal>[] {
  const map: Record<string, Partial<Signal>[]> = {
    'uber.com': [
      { type: 'Webinar Visited', category: 'Content', source: 'HubSpot', title: 'Attended UA optimization webinar', description: '2 Uber employees attended our webinar on user acquisition optimization strategies across iOS and Android.', confidence: 'High', impact: 'Low' },
    ],
    'revolut.com': [
      { type: 'Webinar Visited', category: 'Content', source: 'HubSpot', title: 'Attended mobile measurement summit', description: 'Revolut product manager attended our mobile measurement best practices virtual summit.', confidence: 'Medium', impact: 'Low' },
    ],
  };
  return map[domain] || [];
}
