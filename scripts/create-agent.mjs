/**
 * One-time setup script. Run once, paste the output IDs into .env.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/create-agent.mjs
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

Call all tools in parallel (multiple tool_use blocks in one response). After gathering signals, provide a concise summary of the strongest buying triggers found.`;

const CUSTOM_TOOLS = [
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

console.log('Creating environment...');
const environment = await client.beta.environments.create({
  name: 'signaliq-enrichment',
  config: { type: 'cloud', networking: { type: 'unrestricted' } },
});

console.log('Creating agent...');
const agent = await client.beta.agents.create({
  name: 'SignalIQ Enrichment Agent',
  model: 'claude-opus-4-8',
  system: AGENT_SYSTEM_PROMPT,
  tools: CUSTOM_TOOLS,
});

console.log('\n✅ Done! Add these to your .env file:\n');
console.log(`VITE_ANTHROPIC_AGENT_ID=${agent.id}`);
console.log(`VITE_ANTHROPIC_AGENT_VERSION=${agent.version}`);
console.log(`VITE_ANTHROPIC_ENVIRONMENT_ID=${environment.id}`);
