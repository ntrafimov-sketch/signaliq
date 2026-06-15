import Anthropic from '@anthropic-ai/sdk';
import type { Signal } from '../types';
import { getHiringSignals, getSocialSignals } from './amplemarket';
import { getWebsiteVisitSignals, getCompetitorResearchSignals } from './demandbase';
import { getRevenueSignals, getDownloadSignals, getAdChannelSignals, getCompetitorUsageSignals } from './appmagic';
import { getContentDownloadSignals, getWebinarSignals } from './hubspot';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export interface AgentEnrichmentResult {
  signals: Signal[];
  reasoning: string;
  duration: number;
}

const tools: Anthropic.Tool[] = [
  {
    name: 'get_revenue_signals',
    description: 'Get revenue signals (Revenue Increase/Decrease/Plateau) from AppMagic for a company domain.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain e.g. uber.com' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_download_signals',
    description: 'Get app download signals (Download Increase/Decrease/Plateau) from AppMagic for a company domain.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_ad_channel_signals',
    description: 'Get advertising channel signals (Using ASA / Meta/TT / W2A) from AppMagic.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_competitor_usage_signals',
    description: 'Get competitor SDK usage signals from AppMagic.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_hiring_signals',
    description: 'Get hiring signals (Hiring In Relevant Department) from Amplemarket.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_social_signals',
    description: 'Get social signals (Post from market leaders / Post mentioned keywords) from Amplemarket.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_website_visit_signals',
    description: 'Get website visit signals (Was on our website) from Demandbase.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_competitor_research_signals',
    description: 'Get competitor research signals from Demandbase.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_content_download_signals',
    description: 'Get content download signals from HubSpot.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
  {
    name: 'get_webinar_signals',
    description: 'Get webinar visit signals from HubSpot.',
    input_schema: {
      type: 'object',
      properties: { domain: { type: 'string', description: 'Company domain' } },
      required: ['domain'],
    },
  },
];

async function executeTool(name: string, input: { domain: string }): Promise<Partial<Signal>[]> {
  const { domain } = input;
  switch (name) {
    case 'get_revenue_signals': return getRevenueSignals(domain);
    case 'get_download_signals': return getDownloadSignals(domain);
    case 'get_ad_channel_signals': return getAdChannelSignals(domain);
    case 'get_competitor_usage_signals': return getCompetitorUsageSignals(domain);
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

export async function enrichAccountWithAgent(
  account: { id: string; domain: string; company_name: string; industry?: string },
  onProgress?: (message: string) => void
): Promise<AgentEnrichmentResult> {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY not configured');
  }

  const client = new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true });
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const allSignals: Signal[] = [];

  const systemPrompt = `You are a B2B sales signal enrichment agent. Your job is to gather buying signals for a target account by calling the available connector tools.

For each account, call ALL relevant tools to gather comprehensive signal data. Always call all 10 tools to maximize signal coverage:
1. Revenue signals (AppMagic)
2. Download signals (AppMagic)
3. Ad channel signals (AppMagic)
4. Competitor usage signals (AppMagic)
5. Hiring signals (Amplemarket)
6. Social signals (Amplemarket)
7. Website visit signals (Demandbase)
8. Competitor research signals (Demandbase)
9. Content download signals (HubSpot)
10. Webinar signals (HubSpot)

Call all tools in parallel (use multiple tool_use blocks in a single response). After gathering all signals, provide a brief summary of the key buying triggers found.`;

  const userMessage = `Enrich signals for: ${account.company_name} (domain: ${account.domain}, industry: ${account.industry || 'Unknown'}).
Call all 10 connector tools to gather comprehensive buying signals.`;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  let reasoning = '';
  let loopCount = 0;

  while (loopCount < 5) {
    loopCount++;
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      tools,
      messages,
    });

    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');

    if (textBlocks.length > 0) {
      reasoning = textBlocks.map(b => b.text).join('\n');
    }

    if (response.stop_reason === 'end_turn' || toolUseBlocks.length === 0) break;

    onProgress?.(`Calling ${toolUseBlocks.length} connectors for ${account.company_name}...`);

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (toolUse) => {
        const partials = await executeTool(toolUse.name, toolUse.input as { domain: string });
        const signals: Signal[] = partials.map(partial => ({
          id: generateId(),
          accountId: account.id,
          accountName: account.company_name,
          date: today,
          confidence: 'Medium',
          impact: 'Medium',
          ...partial,
        } as Signal));
        allSignals.push(...signals);
        return {
          type: 'tool_result' as const,
          tool_use_id: toolUse.id,
          content: JSON.stringify({ signals_found: signals.length, signals: partials }),
        };
      })
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    signals: allSignals,
    reasoning,
    duration: (Date.now() - startTime) / 1000,
  };
}
