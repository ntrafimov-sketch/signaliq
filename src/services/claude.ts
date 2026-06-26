import type { Signal, Person, Account, OutreachMessage } from '../types';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;
const API_URL = 'https://api.anthropic.com/v1/messages';

export function isClaudeConfigured(): boolean {
  return !!API_KEY;
}

// ---------------------------------------------------------------------------
// Adapty copywriting system prompt
// ---------------------------------------------------------------------------

const ADAPTY_SYSTEM_PROMPT = `You are an expert B2B sales copywriter for Adapty — a mobile subscription infrastructure platform.

ADAPTY PRODUCT:
- Paywall builder with A/B testing (no-code, instant changes without app releases)
- Subscription analytics (LTV, trial conversion, churn cohorts)
- RevenueCat/Superwall/Qonversion competitor — easier migration, better analytics
- Works with iOS, Android, Flutter, React Native, Unity
- Key differentiators: fastest integration (1 day), 16,000+ apps benchmark data, Adapty Autopilot (AI paywall optimization)

VALUE PROPS BY ROLE:
- Growth/UA: "See which ad channels actually drive paying subscribers, not just installs"
- Product: "A/B test paywalls without waiting for app releases — ship experiments in minutes"
- CTO/Engineering: "One SDK replaces 3-4 tools, full revenue data ownership"
- CMO/Marketing: "Benchmark your subscription KPIs against 16,000 apps in your category"

TONE: Direct, outcome-focused. No fluff. Reference specific signals from the account.
Use their company name, recent metrics, and tech stack in every email.
Max 120 words per email body. Subject lines under 8 words.

OUTPUT FORMAT: Return ONLY valid JSON array, no markdown, no explanation:
[
  {
    "type": "Email",
    "style": "Cold · Outcome-led",
    "subject": "...",
    "body": "...",
    "basedOn": ["signal title 1", "signal title 2"]
  },
  {
    "type": "Email",
    "style": "Follow-up 1 · Value add",
    "subject": "...",
    "body": "...",
    "basedOn": ["signal title"]
  },
  {
    "type": "LinkedIn",
    "style": "LinkedIn · Connection request",
    "body": "...",
    "basedOn": ["signal title"]
  },
  {
    "type": "Follow-up",
    "style": "Follow-up 2 · Breakup",
    "subject": "...",
    "body": "...",
    "basedOn": []
  }
]`;

// ---------------------------------------------------------------------------
// Build the prompt (reusable for both direct API call and email export)
// ---------------------------------------------------------------------------

export function buildSequencePrompt(account: Account, person: Person, signals: Signal[]): { system: string; user: string } {
  const topSignals = signals.slice(0, 8).map(s => `- [${s.category}] ${s.title}: ${s.description}`).join('\n');

  const wtp = person.whatToPitch;

  const user = `Generate a 4-message outreach sequence for this prospect.

CONTACT:
- Name: ${person.name}
- Title: ${person.title}
- Department: ${person.department}
- Company: ${account.company_name} (${account.domain})
- Industry: ${account.industry}
- Employees: ${account.employees?.toLocaleString()}
- Influence: ${person.influence}
${person.bio ? `- Bio: ${person.bio}` : ''}
${wtp?.recommendedAngle ? `- Recommended angle: ${wtp.recommendedAngle}` : ''}
${wtp?.likelyPriorities ? `- Likely priorities: ${wtp.likelyPriorities}` : ''}
${wtp?.painPoints ? `- Pain points: ${wtp.painPoints}` : ''}

ACCOUNT SIGNALS (use these to personalize):
${topSignals}

WHY THIS ACCOUNT MATTERS:
${account.whyMatters || 'Mobile app company that could benefit from Adapty subscription infrastructure'}

OPPORTUNITY:
${account.opportunitySummary?.recommendedAngle || 'Subscription optimization and paywall A/B testing'}

Write 4 messages: cold email, follow-up 1, LinkedIn connection request, breakup email.
Reference ${person.name}'s specific role and the signals above.
Sign as [Your name] from Adapty.`;

  return { system: ADAPTY_SYSTEM_PROMPT, user };
}

// ---------------------------------------------------------------------------
// Generate sequence from raw torpedo JSON + person name (primary path)
// ---------------------------------------------------------------------------

export async function generateSequenceFromTorpedo(
  torpedoData: unknown[],
  personName: string
): Promise<OutreachMessage[]> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const userMessage = `Generate a 4-message outreach sequence for ${personName}.

Here is the full account research data:
${JSON.stringify(torpedoData, null, 2)}

Instructions:
- Find ${personName} in the "people" entries — use their title, department, bio, influence
- Use "signals" entries to personalize each message
- Use "strategy" entries for recommended angle and pain points
- Use "company_intel" for company context
- Reference specific signal titles in the basedOn fields
- Sign as [Your name] from Adapty`;

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
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system: ADAPTY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude returned unexpected format');

  const messages: OutreachMessage[] = JSON.parse(match[0]);
  return messages.map((m, i) => ({ ...m, id: `gen-${Date.now()}-${i}` }));
}

// ---------------------------------------------------------------------------
// Generate outreach sequence for a specific person
// ---------------------------------------------------------------------------

export async function generateOutreachSequence(
  account: Account,
  person: Person,
  signals: Signal[]
): Promise<OutreachMessage[]> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set');

  const { system, user: userMessage } = buildSequencePrompt(account, person, signals);

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
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';

  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Claude returned unexpected format');

  const messages: OutreachMessage[] = JSON.parse(match[0]);
  return messages.map((m, i) => ({ ...m, id: `gen-${Date.now()}-${i}` }));
}

