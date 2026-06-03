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

export interface HubSpotWebVisit {
  contactId: string;
  contactEmail: string;
  pageUrl: string;
  visitDate: string;
  sessionDuration: number;
}

async function fetchHubSpot(path: string, options: RequestInit = {}) {
  if (!API_KEY) {
    throw new Error('HubSpot API key not configured');
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
    throw new Error(`HubSpot API error: ${response.status}`);
  }
  return response.json();
}

export async function getContactsByDomain(domain: string): Promise<HubSpotContact[]> {
  if (!API_KEY) {
    return [];
  }
  try {
    const data = await fetchHubSpot(`/crm/v3/objects/contacts/search`, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'CONTAINS_TOKEN',
            value: `*@${domain}`,
          }],
        }],
      }),
    });
    return data.results || [];
  } catch {
    return [];
  }
}

export async function getCompanyByDomain(domain: string): Promise<HubSpotCompany | null> {
  if (!API_KEY) {
    return null;
  }
  try {
    const data = await fetchHubSpot(`/crm/v3/objects/companies/search`, {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'domain',
            operator: 'EQ',
            value: domain,
          }],
        }],
      }),
    });
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

export async function getWebsiteVisitSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) {
    const mockSignals: Record<string, Partial<Signal>[]> = {
      'uber.com': [
        {
          type: 'Was on our website',
          category: 'Website',
          source: 'HubSpot',
          title: 'Multiple Uber Employees Visited Pricing Page',
          description: '4 employees from uber.com visited the pricing and integrations page in the last 7 days',
          confidence: 'High',
          impact: 'High',
        },
      ],
      'revolut.com': [
        {
          type: 'Was on our website',
          category: 'Website',
          source: 'HubSpot',
          title: 'Website Visits from Revolut Team',
          description: '3 Revolut employees visited our platform pages this week',
          confidence: 'High',
          impact: 'Medium',
        },
      ],
    };
    return mockSignals[domain] || [];
  }
  try {
    // In real implementation, would query HubSpot analytics API
    // using PORTAL_ID for tracking data
    void PORTAL_ID; // used for tracking in production
    const data = await fetchHubSpot(`/analytics/v2/reports/website-traffic?domain=${domain}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

export async function getContentDownloadSignals(domain: string): Promise<Partial<Signal>[]> {
  if (!API_KEY) {
    const mockSignals: Record<string, Partial<Signal>[]> = {
      'uber.com': [
        {
          type: 'Content Download',
          category: 'Content',
          source: 'HubSpot',
          title: 'Downloaded Mobile Attribution Guide',
          description: 'An Uber employee downloaded our comprehensive guide on mobile attribution best practices',
          confidence: 'High',
          impact: 'Medium',
        },
        {
          type: 'Webinar Visited',
          category: 'Content',
          source: 'HubSpot',
          title: 'Attended UA Optimization Webinar',
          description: '2 Uber employees attended our webinar on user acquisition optimization strategies',
          confidence: 'High',
          impact: 'Low',
        },
      ],
    };
    return mockSignals[domain] || [];
  }
  try {
    const data = await fetchHubSpot(`/marketing/v3/forms/submissions?domain=${domain}`);
    return data.signals || [];
  } catch {
    return [];
  }
}

export async function syncAccountToCRM(accountData: {
  name: string;
  domain: string;
  industry: string;
  employees: number;
}): Promise<string | null> {
  if (!API_KEY) {
    console.log('Mock: Syncing account to HubSpot CRM', accountData);
    return `mock-hubspot-id-${Date.now()}`;
  }
  try {
    const data = await fetchHubSpot('/crm/v3/objects/companies', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          name: accountData.name,
          domain: accountData.domain,
          industry: accountData.industry,
          numberofemployees: accountData.employees.toString(),
        },
      }),
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
