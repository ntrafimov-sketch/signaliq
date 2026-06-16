import type { Signal } from '../types';
import { getHiringSignals, getSocialSignals } from './amplemarket';
import { getWebsiteVisitSignals, getCompetitorResearchSignals } from './demandbase';
import { getRevenueSignals, getDownloadSignals, getAdChannelSignals, getCompetitorUsageSignals } from './appmagic';
import { getContentDownloadSignals, getWebinarSignals, getHubSpotHistorySignals } from './hubspot';

export interface AgentEnrichmentResult {
  signals: Signal[];
  reasoning: string;
  duration: number;
}

function generateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function enrichDirect(
  account: { id: string; domain: string; company_name: string; industry?: string },
  onProgress?: (message: string) => void
): Promise<AgentEnrichmentResult> {
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const allSignals: Signal[] = [];

  const connectors = [
    { name: 'Revenue (AppMagic)', fn: () => getRevenueSignals(account.domain, account.company_name) },
    { name: 'Downloads (AppMagic)', fn: () => getDownloadSignals(account.domain, account.company_name) },
    { name: 'Ad channels (AppMagic)', fn: () => getAdChannelSignals(account.domain, account.company_name) },
    { name: 'Competitor SDKs (AppMagic)', fn: () => getCompetitorUsageSignals(account.domain, account.company_name) },
    { name: 'Hiring (Amplemarket)', fn: () => getHiringSignals(account.domain) },
    { name: 'Social (Amplemarket)', fn: () => getSocialSignals(account.domain) },
    { name: 'Website visits (Demandbase)', fn: () => getWebsiteVisitSignals(account.domain) },
    { name: 'Competitor research (Demandbase)', fn: () => getCompetitorResearchSignals(account.domain) },
    { name: 'Content downloads (HubSpot)', fn: () => getContentDownloadSignals(account.domain) },
    { name: 'Webinars (HubSpot)', fn: () => getWebinarSignals(account.domain) },
    { name: 'CRM history (HubSpot)', fn: () => getHubSpotHistorySignals(account.domain) },
  ];

  for (const connector of connectors) {
    onProgress?.(`Calling ${connector.name}...`);
    try {
      const partials = await connector.fn();
      const signals: Signal[] = partials.map(partial => ({
        id: generateId(),
        accountId: account.id,
        accountName: account.company_name,
        date: today,
        confidence: 'Medium' as const,
        impact: 'Medium' as const,
        ...partial,
      } as Signal));
      allSignals.push(...signals);
    } catch {
      // skip failed connector
    }
  }

  return {
    signals: allSignals,
    reasoning: `Enriched ${account.company_name} with ${allSignals.length} signals from 11 connectors.`,
    duration: (Date.now() - startTime) / 1000,
  };
}
