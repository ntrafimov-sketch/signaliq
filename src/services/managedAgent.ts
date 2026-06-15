import Anthropic from '@anthropic-ai/sdk';
import type { Signal } from '../types';
import { getHiringSignals, getSocialSignals } from './amplemarket';
import { getWebsiteVisitSignals, getCompetitorResearchSignals } from './demandbase';
import { getRevenueSignals, getDownloadSignals, getAdChannelSignals, getCompetitorUsageSignals } from './appmagic';
import { getContentDownloadSignals, getWebinarSignals } from './hubspot';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const STORAGE_KEY = 'signaliq_agent_config';

interface StoredAgentConfig {
  agentId: string;
  agentVersion: number;
  environmentId: string;
}

export interface AgentEnrichmentResult {
  signals: Signal[];
  reasoning: string;
  duration: number;
}

const AGENT_SYSTEM_PROMPT = `You are a B2B sales signal enrichment agent for Adapty — a mobile growth platform. Your job is to gather buying signals for a target account by calling all available connector tools.

For each account, call ALL 10 tools to maximize signal coverage:
1. get_revenue_signals — AppMagic: revenue trends (increase/decrease/plateau)
2. get_download_signals — AppMagic: download trends (increase/decrease/plateau)
3. get_ad_channel_signals — AppMagic: which ad networks (ASA, Meta/TT, W2A) they use
4. get_competitor_usage_signals — AppMagic: competitor SDKs detected in their apps
5. get_hiring_signals — Amplemarket: hiring in growth/marketing/product departments
6. get_social_signals — Amplemarket: LinkedIn posts mentioning relevant keywords
7. get_website_visit_signals — Demandbase: visited Adapty's website recently
8. get_competitor_research_signals — Demandbase: researching Adapty competitors
9. get_content_download_signals — HubSpot: downloaded Adapty content assets
10. get_webinar_signals — HubSpot: attended Adapty webinars

Call all tools in parallel (multiple tool_use blocks in one response). After gathering signals, provide a concise summary of the strongest buying triggers.`;

const CUSTOM_TOOLS: Anthropic.Beta.Agents.BetaAgentCustomToolParam[] = [
  { type: 'custom', name: 'get_revenue_signals', description: 'Get revenue signals from AppMagic', input_schema: { type: 'object', properties: { domain: { type: 'string' }, company_name: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_download_signals', description: 'Get download signals from AppMagic', input_schema: { type: 'object', properties: { domain: { type: 'string' }, company_name: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_ad_channel_signals', description: 'Get ad channel signals from AppMagic', input_schema: { type: 'object', properties: { domain: { type: 'string' }, company_name: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_competitor_usage_signals', description: 'Get competitor SDK usage signals from AppMagic', input_schema: { type: 'object', properties: { domain: { type: 'string' }, company_name: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_hiring_signals', description: 'Get hiring signals from Amplemarket', input_schema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_social_signals', description: 'Get social signals from Amplemarket', input_schema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_website_visit_signals', description: 'Get website visit signals from Demandbase', input_schema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_competitor_research_signals', description: 'Get competitor research signals from Demandbase', input_schema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_content_download_signals', description: 'Get content download signals from HubSpot', input_schema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
  { type: 'custom', name: 'get_webinar_signals', description: 'Get webinar signals from HubSpot', input_schema: { type: 'object', properties: { domain: { type: 'string' } }, required: ['domain'] } },
];

function getClient(): Anthropic {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not configured');
  return new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
}

function loadStoredConfig(): StoredAgentConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: StoredAgentConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearAgentConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function setupAgent(): Promise<StoredAgentConfig> {
  const existing = loadStoredConfig();
  if (existing) return existing;

  const client = getClient();

  const environment = await client.beta.environments.create({
    name: 'signaliq-enrichment',
    config: { type: 'cloud', networking: { type: 'unrestricted' } },
  });

  const agent = await client.beta.agents.create({
    name: 'SignalIQ Enrichment Agent',
    model: 'claude-opus-4-8',
    system: AGENT_SYSTEM_PROMPT,
    tools: CUSTOM_TOOLS,
  });

  const config: StoredAgentConfig = {
    agentId: agent.id,
    agentVersion: agent.version,
    environmentId: environment.id,
  };
  saveConfig(config);
  return config;
}

async function executeTool(name: string, input: { domain: string; company_name?: string }): Promise<Partial<Signal>[]> {
  const { domain, company_name } = input;
  switch (name) {
    case 'get_revenue_signals': return getRevenueSignals(domain, company_name);
    case 'get_download_signals': return getDownloadSignals(domain, company_name);
    case 'get_ad_channel_signals': return getAdChannelSignals(domain, company_name);
    case 'get_competitor_usage_signals': return getCompetitorUsageSignals(domain, company_name);
    case 'get_hiring_signals': return getHiringSignals(domain);
    case 'get_social_signals': return getSocialSignals(domain);
    case 'get_website_visit_signals': return getWebsiteVisitSignals(domain);
    case 'get_competitor_research_signals': return getCompetitorResearchSignals(domain);
    case 'get_content_download_signals': return getContentDownloadSignals(domain);
    case 'get_webinar_signals': return getWebinarSignals(domain);
    default: return [];
  }
}

function generateId(): string {
  return `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function enrichAccountWithManagedAgent(
  account: { id: string; domain: string; company_name: string; industry?: string },
  onProgress?: (message: string) => void
): Promise<AgentEnrichmentResult> {
  const client = getClient();
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const allSignals: Signal[] = [];

  const config = await setupAgent();
  onProgress?.(`Agent ready. Starting enrichment for ${account.company_name}...`);

  const session = await client.beta.sessions.create({
    agent: { type: 'agent', id: config.agentId, version: config.agentVersion },
    environment_id: config.environmentId,
    title: `Enrich: ${account.company_name}`,
  });

  const userText = `Enrich buying signals for: ${account.company_name} (domain: ${account.domain}, industry: ${account.industry || 'Unknown'}). Call all 10 connector tools now.`;

  const stream = client.beta.sessions.events.stream(session.id);

  // Send message concurrently while streaming
  client.beta.sessions.events.send(session.id, {
    events: [{ type: 'user.message', content: [{ type: 'text', text: userText }] }],
  });

  let reasoning = '';

  for await (const event of stream) {
    if (event.type === 'agent.message') {
      for (const block of event.content) {
        if (block.type === 'text' && block.text) {
          reasoning = block.text;
        }
      }
    } else if (event.type === 'agent.custom_tool_use') {
      onProgress?.(`Calling ${event.name} for ${account.company_name}...`);
      const input = event.input as { domain: string; company_name?: string };
      const partials = await executeTool(event.name, input);
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

      await client.beta.sessions.events.send(session.id, {
        events: [{
          type: 'user.custom_tool_result',
          custom_tool_use_id: event.id,
          content: [{ type: 'text', text: JSON.stringify({ signals_found: signals.length, signals: partials }) }],
        }],
      });
    } else if (event.type === 'session.status_idle' || event.type === 'session.status_terminated') {
      break;
    }
  }

  return {
    signals: allSignals,
    reasoning,
    duration: (Date.now() - startTime) / 1000,
  };
}
