/**
 * Research Agent — calls Claude with tool_use to research an account
 * and returns a torpedo JSON array.
 */

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

const RESEARCH_SYSTEM_PROMPT = `You are a B2B sales research agent for Adapty — a mobile subscription infrastructure platform.

Your job: research a given company and return a structured JSON array in the "torpedo format".

TORPEDO FORMAT (return ONLY this JSON array, no markdown, no explanation):
[
  { "type": "company_intel", "data": { "name": "...", "domain": "...", "hq": "...", "headcount": 0, "industry": "...", "stage": "Series X / Public / Bootstrapped", "valuation": "...", "total_funding_usd": 0, "latest_round": { "type": "...", "amount_usd": 0, "date": "YYYY-MM-DD", "investors": [] }, "business_model": "...", "tech_stack_notable": [], "highlights": [] } },
  { "type": "revenue_history", "data": [{ "date": "YYYY-MM", "revenue": 0, "downloads": 0 }], "store": "App Store (iOS)", "notes": "..." },
  { "type": "sdks", "data": [{ "name": "...", "category": "iap|attribution|analytics|social|auth|ai|framework" }] },
  { "type": "crm_history", "data": { "deals": [], "contacts_mapped": [] } },
  { "type": "signals", "data": [{ "signal": "...", "implication": "..." }] },
  { "type": "contacts", "data": [{ "name": "...", "title": "...", "linkedin": "...", "email": "...", "location": "...", "in_crm": false, "notes": "..." }] },
  { "type": "strategy", "data": { "situation_summary": "...", "angles": [{ "angle": "...", "rationale": "...", "strength": "High|Medium|Low", "contacts": [] }], "recommended_contacts": [{ "name": "...", "title": "...", "priority": 1, "reason": "...", "approach": "..." }], "cautions": [] } }
]

RULES:
- Always call all available tools before synthesizing the final JSON
- For signals and strategy: focus on Adapty's value props (paywall builder, A/B testing, subscription analytics, RevenueCat/Superwall consolidation)
- For contacts: prioritize Growth, Product, and Engineering heads
- Return ONLY the JSON array — no markdown, no prose`;

// Tool definitions for Claude
const TOOLS = [
  {
    name: 'get_app_revenue_and_sdks',
    description: 'Get revenue history, download history, and SDK list for a mobile app using AppMagic API. Returns 12 months of monthly revenue/downloads and detected SDKs.',
    input_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Company domain, e.g. "speak.com"' },
        company_name: { type: 'string', description: 'Company name, e.g. "Speak"' },
      },
      required: ['domain', 'company_name'],
    },
  },
  {
    name: 'get_ad_channels',
    description: 'Get paid advertising channels (Meta, TikTok, ASA, etc.) for a mobile app using AppMagic ad intelligence.',
    input_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
        company_name: { type: 'string' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'get_hubspot_crm',
    description: 'Get HubSpot CRM data for a company: deals, contacts, lifecycle stage.',
    input_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Company domain' },
      },
      required: ['domain'],
    },
  },
  {
    name: 'get_hiring_signals',
    description: 'Get hiring signals and open job positions for a company from Amplemarket.',
    input_schema: {
      type: 'object',
      properties: {
        domain: { type: 'string' },
      },
      required: ['domain'],
    },
  },
];

// Tool implementations — call actual services
async function executeTool(name: string, input: Record<string, string>): Promise<string> {
  try {
    switch (name) {
      case 'get_app_revenue_and_sdks': {
        const { getRevenueSignals, getDownloadSignals, getCompetitorUsageSignals } = await import('./appmagic');
        const [rev, dl, sdk] = await Promise.all([
          getRevenueSignals(input.domain, input.company_name),
          getDownloadSignals(input.domain, input.company_name),
          getCompetitorUsageSignals(input.domain, input.company_name),
        ]);
        return JSON.stringify({ revenue_signals: rev, download_signals: dl, sdk_signals: sdk });
      }

      case 'get_ad_channels': {
        const { getAdChannelSignals } = await import('./appmagic');
        const signals = await getAdChannelSignals(input.domain, input.company_name);
        return JSON.stringify({ ad_signals: signals });
      }

      case 'get_hubspot_crm': {
        const { getContactsByDomain, getCompanyByDomain } = await import('./hubspot');
        const [contacts, company] = await Promise.all([
          getContactsByDomain(input.domain),
          getCompanyByDomain(input.domain),
        ]);
        return JSON.stringify({ contacts, company });
      }

      case 'get_hiring_signals': {
        const { getHiringSignals } = await import('./amplemarket');
        const signals = await getHiringSignals(input.domain);
        return JSON.stringify({ hiring_signals: signals });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

export async function runResearchAgent(
  account: { domain: string; company_name: string; industry?: string },
  onProgress?: (message: string) => void
): Promise<unknown[]> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const messages: Array<{ role: string; content: unknown }> = [
    {
      role: 'user',
      content: `Research this company for Adapty sales team:
- Company: ${account.company_name}
- Domain: ${account.domain}
- Industry: ${account.industry || 'Mobile App'}

Use all available tools to gather data, then return the torpedo JSON.`,
    },
  ];

  // Agentic loop — max 8 rounds
  for (let round = 0; round < 8; round++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-calls': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 4000,
        system: RESEARCH_SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API ${response.status}: ${err}`);
    }

    const data = await response.json();
    messages.push({ role: 'assistant', content: data.content });

    if (data.stop_reason === 'end_turn') {
      // Extract JSON from final text response
      const textBlock = data.content.find((b: { type: string }) => b.type === 'text');
      if (!textBlock) throw new Error('No text in response');
      const match = textBlock.text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON array in response');
      return JSON.parse(match[0]);
    }

    if (data.stop_reason === 'tool_use') {
      const toolUses = data.content.filter((b: { type: string }) => b.type === 'tool_use');
      const toolResults = [];

      for (const tool of toolUses) {
        onProgress?.(`Calling ${tool.name.replace(/_/g, ' ')}...`);
        const result = await executeTool(tool.name, tool.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }
  }

  throw new Error('Research agent did not complete in time');
}
