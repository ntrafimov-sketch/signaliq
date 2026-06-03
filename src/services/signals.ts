import type { Signal } from '../types';
import { getAdSpendSignals } from './amplemarket';
import { getCompetitiveSignals, getIntentData } from './demandbase';
import { getRevenueSignals } from './appmagic';
import { getWebsiteVisitSignals, getContentDownloadSignals } from './hubspot';
import { mockSignals } from '../data/mockData';

export interface EnrichmentResult {
  signals: Signal[];
  enrichedAt: string;
  duration: number;
  sources: string[];
}

function generateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getAccountSignals(domain: string, accountId: string, accountName: string): Promise<Signal[]> {
  // Check if we have mock data for this account
  const existingSignals = mockSignals.filter(s => s.accountId === accountId);
  if (existingSignals.length > 0) {
    return existingSignals;
  }

  // Otherwise fetch from APIs
  const allSignals: Signal[] = [];
  const today = new Date().toISOString().split('T')[0];

  try {
    const [adSpend, competitive, revenue, webVisits, contentDownloads] = await Promise.allSettled([
      getAdSpendSignals(domain),
      getCompetitiveSignals(domain),
      getRevenueSignals(domain),
      getWebsiteVisitSignals(domain),
      getContentDownloadSignals(domain),
    ]);

    const partialSignals: Partial<Signal>[] = [
      ...(adSpend.status === 'fulfilled' ? adSpend.value : []),
      ...(competitive.status === 'fulfilled' ? competitive.value : []),
      ...(revenue.status === 'fulfilled' ? revenue.value : []),
      ...(webVisits.status === 'fulfilled' ? webVisits.value : []),
      ...(contentDownloads.status === 'fulfilled' ? contentDownloads.value : []),
    ];

    for (const partial of partialSignals) {
      allSignals.push({
        id: generateId(),
        accountId,
        accountName,
        date: today,
        confidence: 'Medium',
        impact: 'Medium',
        ...partial,
      } as Signal);
    }
  } catch (error) {
    console.error('Error fetching signals:', error);
  }

  return allSignals;
}

export async function enrichAccounts(
  accounts: Array<{ id: string; domain: string; company_name: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const allSignals: Signal[] = [];
  const sources = new Set<string>();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    onProgress?.(i + 1, accounts.length);

    const signals = await getAccountSignals(account.domain, account.id, account.company_name);
    allSignals.push(...signals);

    signals.forEach(s => sources.add(s.source));

    // Small delay to avoid rate limiting
    if (i < accounts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const duration = (Date.now() - startTime) / 1000;

  return {
    signals: allSignals,
    enrichedAt: new Date().toISOString(),
    duration,
    sources: Array.from(sources),
  };
}

export async function getIntentScore(domain: string): Promise<number> {
  const intentData = await getIntentData(domain);
  return intentData?.intent_score ?? 50;
}

export function categorizeSignal(signalType: string): Signal['category'] {
  const categoryMap: Record<string, Signal['category']> = {
    'Revenue Increase': 'Revenue',
    'Revenue Decrease': 'Revenue',
    'Revenue Plateau': 'Revenue',
    'Hiring In Relevant Department': 'Hiring',
    'High Season': 'Seasonality',
    'Using ASA': 'Ad Spend',
    'Using Meta/TT': 'Ad Spend',
    'Using W2A': 'Ad Spend',
    'Was on our website': 'Website',
    'Post from market leaders': 'Social',
    'Post mentioned specific keywords': 'Social',
    'Using Competitors': 'Competitive',
    'Competitor Research': 'Competitive',
    'Content Download': 'Content',
    'Webinar Visited': 'Content',
  };
  return categoryMap[signalType] || 'Website';
}

export function calculateAccountScore(signals: Signal[]): number {
  if (signals.length === 0) return 0;

  let score = 0;
  const weights: Record<string, number> = {
    'Revenue Increase': 15,
    'Revenue Decrease': 5,
    'Revenue Plateau': 8,
    'Hiring In Relevant Department': 12,
    'High Season': 8,
    'Using ASA': 10,
    'Using Meta/TT': 10,
    'Using W2A': 8,
    'Was on our website': 12,
    'Post from market leaders': 6,
    'Post mentioned specific keywords': 7,
    'Using Competitors': 10,
    'Competitor Research': 12,
    'Content Download': 8,
    'Webinar Visited': 9,
  };

  for (const signal of signals) {
    const weight = weights[signal.type] || 5;
    const confidenceMultiplier = signal.confidence === 'High' ? 1.0 : signal.confidence === 'Medium' ? 0.7 : 0.4;
    const impactMultiplier = signal.impact === 'High' ? 1.0 : signal.impact === 'Medium' ? 0.7 : 0.4;
    score += weight * confidenceMultiplier * impactMultiplier;
  }

  return Math.min(100, Math.round(score));
}
