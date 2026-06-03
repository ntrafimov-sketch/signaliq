import type { Signal } from '../types';
import { getHiringSignals, getSocialSignals } from './amplemarket';
import { getWebsiteVisitSignals, getCompetitorResearchSignals } from './demandbase';
import { getRevenueSignals, getDownloadSignals, getAdChannelSignals, getCompetitorUsageSignals } from './appmagic';
import { getContentDownloadSignals, getWebinarSignals } from './hubspot';
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

// High Season: derived from industry + current month, no external API needed
function getHighSeasonSignals(_domain: string, industry: string): Partial<Signal>[] {
  const month = new Date().getMonth(); // 0-based
  const highSeasonIndustries: Record<string, { months: number[]; title: string; description: string }> = {
    'Mobility': { months: [5, 6, 7, 11], title: 'Peak mobility season active', description: 'Summer travel and holiday season driving surge in ride-hailing demand — peak UA investment period.' },
    'Fintech': { months: [0, 1, 9, 10], title: 'High financial activity season', description: 'Q1 and Q4 are peak periods for fintech engagement — tax season and year-end spending drives UA budgets.' },
    'Media': { months: [10, 11], title: 'Q4 content season surge', description: 'Year-end content consumption peaks in Q4 — streaming and media apps ramp UA spend significantly.' },
    'E-commerce': { months: [9, 10, 11], title: 'Holiday shopping season', description: 'Q4 holiday period drives peak e-commerce UA investment and app install campaigns.' },
  };

  const config = highSeasonIndustries[industry];
  if (!config || !config.months.includes(month)) return [];

  return [{
    type: 'High Season',
    category: 'Seasonality',
    source: 'SignalIQ',
    title: config.title,
    description: config.description,
    confidence: 'High',
    impact: 'High',
  }];
}

export async function getAccountSignals(domain: string, accountId: string, accountName: string, industry = ''): Promise<Signal[]> {
  // Return existing mock signals if available
  const existingSignals = mockSignals.filter(s => s.accountId === accountId);
  if (existingSignals.length > 0) return existingSignals;

  const allSignals: Signal[] = [];
  const today = new Date().toISOString().split('T')[0];

  const [revenue, downloads, adChannels, competitorUsage, hiring, social, websiteVisits, competitorResearch, contentDownloads, webinars] =
    await Promise.allSettled([
      getRevenueSignals(domain),           // AppMagic: Revenue Increase/Decrease/Plateau
      getDownloadSignals(domain),           // AppMagic: Download Increase/Decrease/Plateau
      getAdChannelSignals(domain),          // AppMagic: Using ASA / Meta/TT / W2A
      getCompetitorUsageSignals(domain),    // AppMagic: Using Competitors
      getHiringSignals(domain),             // Amplemarket: Hiring In Relevant Department
      getSocialSignals(domain),             // Amplemarket: Post from market leaders / Post mentioned keywords
      getWebsiteVisitSignals(domain),       // Demandbase: Was on our website
      getCompetitorResearchSignals(domain), // Demandbase: Competitor Research
      getContentDownloadSignals(domain),    // HubSpot: Content Download
      getWebinarSignals(domain),            // HubSpot: Webinar Visited
    ]);

  const highSeason = getHighSeasonSignals(domain, industry); // Predefined: High Season

  const partialSignals: Partial<Signal>[] = [
    ...(revenue.status === 'fulfilled' ? revenue.value : []),
    ...(downloads.status === 'fulfilled' ? downloads.value : []),
    ...(adChannels.status === 'fulfilled' ? adChannels.value : []),
    ...(competitorUsage.status === 'fulfilled' ? competitorUsage.value : []),
    ...(hiring.status === 'fulfilled' ? hiring.value : []),
    ...(social.status === 'fulfilled' ? social.value : []),
    ...(websiteVisits.status === 'fulfilled' ? websiteVisits.value : []),
    ...(competitorResearch.status === 'fulfilled' ? competitorResearch.value : []),
    ...(contentDownloads.status === 'fulfilled' ? contentDownloads.value : []),
    ...(webinars.status === 'fulfilled' ? webinars.value : []),
    ...highSeason,
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

  return allSignals;
}

export async function enrichAccounts(
  accounts: Array<{ id: string; domain: string; company_name: string; industry?: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const allSignals: Signal[] = [];
  const sources = new Set<string>();

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    onProgress?.(i + 1, accounts.length);

    const signals = await getAccountSignals(account.domain, account.id, account.company_name, account.industry);
    allSignals.push(...signals);
    signals.forEach(s => sources.add(s.source));

    if (i < accounts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return {
    signals: allSignals,
    enrichedAt: new Date().toISOString(),
    duration: (Date.now() - startTime) / 1000,
    sources: Array.from(sources),
  };
}

export async function getIntentScore(domain: string): Promise<number> {
  const { getIntentData } = await import('./demandbase');
  const intentData = await getIntentData(domain);
  return intentData?.intent_score ?? 50;
}

export function categorizeSignal(signalType: string): Signal['category'] {
  const map: Record<string, Signal['category']> = {
    'Revenue Increase': 'Revenue',
    'Revenue Decrease': 'Revenue',
    'Revenue Plateau': 'Revenue',
    'Download Increase': 'Downloads',
    'Download Decrease': 'Downloads',
    'Download Plateau': 'Downloads',
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
  return map[signalType] || 'Website';
}

export function calculateAccountScore(signals: Signal[]): number {
  if (signals.length === 0) return 0;

  const weights: Record<string, number> = {
    'Revenue Increase': 15,
    'Revenue Decrease': 5,
    'Revenue Plateau': 8,
    'Download Increase': 12,
    'Download Decrease': 4,
    'Download Plateau': 6,
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

  let score = 0;
  for (const signal of signals) {
    const weight = weights[signal.type] || 5;
    const cm = signal.confidence === 'High' ? 1.0 : signal.confidence === 'Medium' ? 0.7 : 0.4;
    const im = signal.impact === 'High' ? 1.0 : signal.impact === 'Medium' ? 0.7 : 0.4;
    score += weight * cm * im;
  }

  return Math.min(100, Math.round(score));
}
