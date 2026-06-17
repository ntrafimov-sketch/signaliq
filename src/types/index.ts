export type ScoreLabel = 'Hot' | 'Warm' | 'Cold';
export type EnrichmentStatus = 'pending' | 'enriching' | 'done' | 'error';

export type SignalType =
  | 'Revenue Increase'
  | 'Revenue Decrease'
  | 'Revenue Plateau'
  | 'Download Increase'
  | 'Download Decrease'
  | 'Download Plateau'
  | 'Hiring In Relevant Department'
  | 'High Season'
  | 'Using ASA'
  | 'Using Meta/TT'
  | 'Using W2A'
  | 'Was on our website'
  | 'Post from market leaders'
  | 'Post mentioned specific keywords'
  | 'Using Competitors'
  | 'Competitor Research'
  | 'Content Download'
  | 'Webinar Visited';

export type SignalCategory =
  | 'Revenue'
  | 'Downloads'
  | 'Hiring'
  | 'Seasonality'
  | 'Ad Spend'
  | 'Website'
  | 'Social'
  | 'Competitive'
  | 'Content';

export interface Signal {
  id: string;
  type: SignalType;
  category: SignalCategory;
  accountId: string;
  accountName: string;
  source: string;
  date: string;
  title: string;
  description: string;
  confidence: 'High' | 'Medium' | 'Low';
  impact: 'High' | 'Medium' | 'Low';
}

export interface Account {
  id: string;
  company_name: string;
  domain: string;
  industry: string;
  country: string;
  employees: number;
  score: number;
  scoreLabel: ScoreLabel;
  signals: Signal[];
  lastUpdated: string;
  description: string;
  founded: string;
  hq: string;
  revenue: string;
  lastMonthRevenue?: string;
  status: string;
  logoColor: string;
  enrichmentStatus?: EnrichmentStatus;
  people?: Person[];
  whyMatters?: string;
  whyKeywords?: string[];
  opportunitySummary?: {
    businessTrigger: string;
    likelyPriorities: string;
    potentialPainPoints: string;
    recommendedAngle: string;
  };
  departmentIntel?: DepartmentIntelligence[];
}

export interface Person {
  id: string;
  accountId: string;
  name: string;
  title: string;
  company: string;
  department: string;
  location: string;
  tenure: string;
  linkedin: string;
  influence: 'High' | 'Medium' | 'Low';
  avatarColor: string;
}

export interface OutreachMessage {
  id: string;
  type: 'Email' | 'LinkedIn' | 'Follow-up';
  style: string;
  subject?: string;
  body: string;
  basedOn: string[];
}

export interface DepartmentIntelligence {
  name: string;
  goals: string[];
  challenges: string[];
  messagingRecommendations: string[];
}

export interface ApiKeys {
  amplemarket: string;
  demandbase: string;
  appmagic: string;
  hubspot: string;
  hubspotPortalId: string;
}

export interface List {
  id: string;
  name: string;
  description: string;
  accountCount: number;
  createdAt: string;
  updatedAt: string;
}
