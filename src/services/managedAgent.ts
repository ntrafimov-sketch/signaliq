import Anthropic from '@anthropic-ai/sdk';
import type { Signal } from '../types';
import { getHiringSignals, getSocialSignals } from './amplemarket';
import { getWebsiteVisitSignals, getCompetitorResearchSignals } from './demandbase';
import { getRevenueSignals, getDownloadSignals, getAdChannelSignals, getCompetitorUsageSignals } from './appmagic';
import { getContentDownloadSignals, getWebinarSignals } from './hubspot';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const AGENT_ID = import.meta.env.VITE_ANTHROPIC_AGENT_ID;
const AGENT_VERSION = parseInt(import.meta.env.VITE_ANTHROPIC_AGENT_VERSION || '1', 10);
const ENVIRONMENT_ID = import.meta.env.VITE_ANTHROPIC_ENVIRONMENT_ID;

export interface AgentEnrichmentResult {
  signals: Signal[];
  reasoning: string;
  duration: number;
}

export function isAgentConfigured(): boolean {
  return !!(API_KEY && AGENT_ID && ENVIRONMENT_ID);
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
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not configured');
  if (!AGENT_ID) throw new Error('VITE_ANTHROPIC_AGENT_ID not configured. Run: node scripts/create-agent.mjs');
  if (!ENVIRONMENT_ID) throw new Error('VITE_ANTHROPIC_ENVIRONMENT_ID not configured. Run: node scripts/create-agent.mjs');

  const client = new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const allSignals: Signal[] = [];

  onProgress?.(`Starting session for ${account.company_name}...`);

  const session = await client.beta.sessions.create({
    agent: { type: 'agent', id: AGENT_ID, version: AGENT_VERSION },
    environment_id: ENVIRONMENT_ID,
    title: `Enrich: ${account.company_name}`,
  });

  const userText = `Enrich buying signals for: ${account.company_name} (domain: ${account.domain}, industry: ${account.industry || 'Unknown'}). Call all 10 connector tools now.`;

  // Open stream and send message concurrently so no events are missed
  const stream = client.beta.sessions.events.stream(session.id);

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
      onProgress?.(`Calling ${event.name.replace(/_/g, ' ')} for ${account.company_name}...`);
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
