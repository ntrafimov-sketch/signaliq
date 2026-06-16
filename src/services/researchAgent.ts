const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM_PROMPT = `You are a B2B sales research agent for Adapty — a mobile subscription infrastructure platform.

ADAPTY PRODUCT:
- Paywall builder with A/B testing (no-code, ship without app releases)
- Subscription analytics (LTV, trial conversion, churn cohorts)
- Competitor to: RevenueCat, Superwall, Purchasely, Qonversion, Apphud
- Also competes with lifecycle tools: Braze, Customer.io, CleverTap
- Key differentiators: 1-day integration, 16,000+ app benchmarks, Adapty Autopilot (AI optimization)

YOUR JOB: Research the given company and return a torpedo JSON array.

RETURN ONLY this JSON array — no markdown, no explanation:
[
  {
    "type": "company_intel",
    "data": {
      "name": "string",
      "domain": "string",
      "hq": "string",
      "headcount": 0,
      "industry": "string",
      "stage": "Series X / Public / Bootstrapped",
      "valuation": "string or null",
      "total_funding_usd": 0,
      "latest_round": { "type": "string", "amount_usd": 0, "date": "YYYY-MM-DD", "investors": [] },
      "business_model": "string",
      "tech_stack_notable": ["RevenueCat", "AppsFlyer", "..."],
      "highlights": ["string"]
    }
  },
  {
    "type": "sdks",
    "data": [{ "name": "string", "category": "iap|attribution|analytics|social|auth|ai" }]
  },
  {
    "type": "signals",
    "data": [{ "signal": "string", "implication": "string — why relevant for Adapty" }]
  },
  {
    "type": "contacts",
    "data": [
      {
        "name": "string",
        "title": "string",
        "linkedin": "string or null",
        "location": "string",
        "notes": "string — why relevant for Adapty outreach"
      }
    ]
  },
  {
    "type": "strategy",
    "data": {
      "situation_summary": "string — 2-3 sentences on why this account matters for Adapty now",
      "angles": [
        { "angle": "string", "rationale": "string", "strength": "High|Medium|Low", "contacts": ["name (title)"] }
      ],
      "recommended_contacts": [
        { "name": "string", "title": "string", "priority": 1, "reason": "string", "approach": "string" }
      ],
      "cautions": ["string"]
    }
  }
]

Focus on: subscription/paywall stack, growth team, funding stage, competitor SDK usage, expansion signals.`;

export async function runResearchAgent(
  account: { domain: string; company_name: string; industry?: string },
  onProgress?: (message: string) => void
): Promise<unknown[]> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  onProgress?.('Research Agent is analyzing the account...');

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
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Research this company:\n- Name: ${account.company_name}\n- Domain: ${account.domain}\n- Industry: ${account.industry || 'Mobile App'}`,
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Research agent returned unexpected format');

  onProgress?.('Processing research results...');
  return JSON.parse(match[0]);
}
