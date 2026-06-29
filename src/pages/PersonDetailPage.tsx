import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Copy, Send, RefreshCw, Mail,
  Sparkles, Loader2, ChevronRight, Target, Lightbulb, AlertCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { buildSequencePrompt } from '../services/claude';
import { subscribeSequenceResult } from '../services/webhookListener';
import type { CareerEntry, SequenceResult, SequenceStep } from '../types';


function CompanyLogo({ company }: { company: string }) {
  const [stage, setStage] = useState(0);
  const domain = company.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+inc$|\s+llc$|\s+corp$|\s+ltd$/,'')
    .trim()
    .replace(/\s+/g, '') + '.com';
  const srcs = [
    `https://logo.brandfetch.io/${domain}/icon`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  ];
  if (stage < srcs.length) {
    return (
      <img
        src={srcs[stage]}
        alt={company}
        onError={() => setStage(s => s + 1)}
        className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
      {company[0]}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSequenceResult(raw: any): SequenceResult | null {
  if (!raw) return null;

  // Format 3: sequence_structure[] + emails{} + linkedin_touches{}
  if (!raw.sequence && raw.sequence_structure) {
    const emails: Record<string, string> = raw.emails || {};
    const liTouches: Record<string, string> = raw.linkedin_touches || {};
    let emailNum = 0; let dmNum = 0;
    raw.sequence = raw.sequence_structure.map((s: any) => {
      const isEmail = s.type === 'email';
      const ch: 'email' | 'linkedin' = isEmail ? 'email' : 'linkedin';
      const step: SequenceStep = { day: s.day, channel: ch, touch_type: s.type };
      if (isEmail && s.ref) {
        emailNum++;
        step.email_number = emailNum;
        step.body = emails[`${s.ref}_body`];
        step.subject = emails[`${s.ref}_subject`];
      } else if (s.ref) {
        const noteText = liTouches[s.ref] || null;
        if (noteText) { dmNum++; step.dm_number = dmNum; step.script = noteText; }
        step.content = noteText;
      }
      return step;
    });
  }

  const stepsRaw: any[] = raw.sequence || raw.stages || raw.touches || [];
  if (stepsRaw.length === 0) return raw as SequenceResult;

  // Resolve {{ email_N_body | newline_to_br }} template variables from emails{}
  const emailsLookup: Record<string, string> = raw.emails || raw.lead_data || {};
  const hasTemplateVars = stepsRaw.some((s: any) =>
    (s.body && /\{\{\s*\w+/.test(s.body)) || (s.subject && /\{\{\s*\w+/.test(s.subject))
  );
  if (hasTemplateVars && Object.keys(emailsLookup).length > 0) {
    const resolved = stepsRaw.map((s: any) => ({
      ...s,
      body: s.body ? s.body.replace(/\{\{\s*([\w_]+)(?:\s*\|[^}]*)?\}\}/g, (_: string, key: string) => emailsLookup[key] ?? s.body) : s.body,
      subject: s.subject ? s.subject.replace(/\{\{\s*([\w_]+)(?:\s*\|[^}]*)?\}\}/g, (_: string, key: string) => emailsLookup[key] ?? s.subject) : s.subject,
    }));
    return { ...raw, sequence: resolved } as SequenceResult;
  }

  // Already fully normalized?
  if (raw.sequence && !raw.stages && !raw.touches && !raw.sequence_structure) return raw as SequenceResult;

  const leadData: Record<string, string> = raw.lead_data || {};
  let emailNum = 0;
  let dmNum = 0;
  const sequence: SequenceStep[] = stepsRaw.map((s: any) => {
    const ch = (s.channel || '').toLowerCase() as 'email' | 'linkedin';
    if (s.touch_type && (s.body || s.script || s.content !== undefined)) return s as SequenceStep;
    const step: SequenceStep = {
      day: s.day,
      channel: ch,
      touch_type: s.type || s.touch_type || (ch === 'email' ? 'email' : 'linkedin_message'),
    };
    if (ch === 'email') {
      emailNum++;
      step.email_number = emailNum;
      step.body = s.body || (s.body_key ? leadData[s.body_key] : leadData[`email_${emailNum}_body`]);
      step.subject = s.subject || (s.subject_key ? leadData[s.subject_key] : leadData[`email_${emailNum}_subject`]);
    } else {
      const noteText = s.notes || s.note || s.script || null;
      if (noteText) { dmNum++; step.dm_number = dmNum; step.script = noteText; }
      step.content = noteText;
    }
    return step;
  });
  return { ...raw, sequence };
}

export function PersonDetailPage() {
  const { id, personId } = useParams<{ id: string; personId: string }>();
  const navigate = useNavigate();
  const { accounts, updateAccount } = useStore();
  const account = accounts.find(a => a.id === id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const person = (account as any)?.people?.find((p: any) => p.id === personId);
  const [copied, setCopied] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  const [sequenceResult, setSequenceResult] = useState<SequenceResult | null>(() =>
    normalizeSequenceResult(person?.sequenceResult ?? null)
  );

  // Listen for sequence results pushed via Clay → Railway webhook → WebSocket
  useEffect(() => {
    if (!id || !personId) return;
    return subscribeSequenceResult((accountId, pId, result) => {
      if (accountId !== id || pId !== personId) return;
      const sr = normalizeSequenceResult(result)!;
      setSequenceResult(sr);
      setGenerating(false);
      // Use getState() to avoid stale closure on account
      const currentAccount = useStore.getState().accounts.find(a => a.id === id);
      if (currentAccount) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateAccount(id, {
          people: (currentAccount as any).people.map((p: any) =>
            p.id === personId ? { ...p, sequenceResult: sr } : p
          ),
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, personId]);

  if (!account || !person) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Person not found.</p>
        <Button onClick={() => navigate(`/accounts/${id}`)} className="mt-4">Back to Account</Button>
      </div>
    );
  }


  const handleCopy = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(msgId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async () => {
    setGenerateError(null);

    const clayWebhook = import.meta.env.VITE_CLAY_SEQUENCE_WEBHOOK;
    // Torpedo JSON has all company/person data — skill in Clay handles the rest
    const payload = {
      account_id: account.id,
      person_id: person.id,
      person_name: person.name,
      torpedo_json: account.torpedoData ?? [],
    };

    // 1. Try local bridge (python3 bridge.py running on port 7337)
    try {
      const health = await fetch('http://localhost:7337/health', { signal: AbortSignal.timeout(600) });
      if (health.ok) {
        await fetch('http://localhost:7337/sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person, account, signals: account.signals }),
        });
        setGenerating(true); // keep spinner — result comes via WebSocket
        return;
      }
    } catch { /* bridge not running */ }

    // 2. Clay webhook — same pipeline as torpedo research
    if (clayWebhook) {
      try {
        const res = await fetch(clayWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setGenerating(true); // keep spinner — result comes via WebSocket from /api/sequence-result
          return;
        }
      } catch { /* Clay unreachable */ }
    }

    // 3. Fallback: show prompt modal
    setShowPromptModal(true);
  };

  const getPromptText = () => {
    const { system, user } = buildSequencePrompt(account, person, account.signals);
    return `SYSTEM PROMPT:\n${system}\n\n${'─'.repeat(60)}\n\nUSER MESSAGE:\n${user}`;
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(getPromptText()).catch(() => {});
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const handleEmailPrompt = () => {
    const { user } = buildSequencePrompt(account, person, account.signals);
    const subject = encodeURIComponent(`Generate sequence: ${person.name} @ ${account.company_name}`);
    const body = encodeURIComponent(
      `Please generate an outreach sequence using the following context.\n\nPaste the USER MESSAGE below into Claude.ai (claude.ai/new) — the system prompt is built into SignalIQ.\n\n${'─'.repeat(60)}\n\n${user}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const influenceVariant = { High: 'high', Medium: 'medium', Low: 'low' } as const;
  const careerTrack: CareerEntry[] = person.careerTrack ?? [];

  // Use person-specific what_to_pitch if available, fallback to account-level opportunitySummary
  const wtp = person.whatToPitch;
  const opp = account.opportunitySummary;
  const pitchItems = [
    (wtp?.recommendedAngle || opp?.recommendedAngle) && {
      icon: <Target className="w-4 h-4 text-indigo-500" />,
      label: 'Recommended Angle',
      text: wtp?.recommendedAngle || opp?.recommendedAngle || '',
    },
    (wtp?.likelyPriorities || opp?.likelyPriorities) && {
      icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
      label: 'Likely Priorities',
      text: wtp?.likelyPriorities || opp?.likelyPriorities || '',
    },
    (wtp?.painPoints || opp?.potentialPainPoints) && {
      icon: <AlertCircle className="w-4 h-4 text-red-400" />,
      label: 'Pain Points',
      text: wtp?.painPoints || opp?.potentialPainPoints || '',
    },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; text: string }[];

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-400">
        <Link to="/accounts" className="hover:text-slate-600">Companies</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/accounts/${id}`} className="hover:text-slate-600">{account.company_name}</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-700">{person.name}</span>
      </div>

      <Link to={`/accounts/${id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to {account.company_name}
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm shadow-violet-50 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: avatar + name */}
          <div className="flex items-center gap-4">
            <Avatar name={person.name} email={person.email} linkedin={person.linkedin} size="xl" color={person.avatarColor} />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{person.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{person.title} · {account.company_name}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge variant={influenceVariant[person.influence as keyof typeof influenceVariant]}>
                  {person.influence} influence
                </Badge>
                {person.department && <Badge variant="default">{person.department}</Badge>}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0">
            {sequenceResult && (
              <Button variant="secondary" size="sm" onClick={handleGenerate} disabled={generating}>
                <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
                Regenerate
              </Button>
            )}
            <Button
              variant="primary" size="sm"
              onClick={sequenceResult ? () => window.open('https://app.amplemarket.com/sequences', '_blank') : handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating...</>
              ) : sequenceResult ? (
                <><Send className="w-3.5 h-3.5" />Send sequence</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" />Generate Sequence</>
              )}
            </Button>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'Title', value: person.title },
            { label: 'Location', value: person.location },
            { label: 'Email', value: person.email, href: person.email ? `mailto:${person.email}` : undefined },
            { label: 'LinkedIn', value: person.linkedin ? 'View profile' : '—', href: person.linkedin || undefined },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-xs text-gray-400 font-medium mb-0.5">{item.label}</p>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 truncate">
                  {item.label === 'LinkedIn' ? <><ExternalLink className="w-3 h-3 flex-shrink-0" />{item.value}</> : item.value}
                </a>
              ) : (
                <p className="text-sm text-gray-700 font-medium truncate">{item.value || '—'}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{generateError}</div>
      )}

      {/* Bio */}
      {person.bio && (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-600 leading-relaxed">{person.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Two-column: What to Pitch + Past Experience */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* What to Pitch */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">What to Pitch</h2>
            </div>
          </CardHeader>
          {pitchItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No pitch strategy available
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pitchItems.map((item, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    {item.icon}
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{item.label}</p>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Generate sequence CTA if no sequence yet */}
          {!sequenceResult && !generating && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800">
                <Sparkles className="w-4 h-4" />
                Generate personalized outreach sequence
              </button>
            </div>
          )}
        </Card>

        {/* Past Experience */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Past Experience</h2>
          </CardHeader>
          {careerTrack.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">No career data available</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {careerTrack.map((job: CareerEntry, i: number) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <CompanyLogo company={job.company} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{job.company}</p>
                          <p className="text-xs text-gray-400">{job.start} – {job.end} · {job.duration}</p>
                        </div>
                        {i === 0 && (
                          <span className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full flex-shrink-0">Current</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{job.title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recent Posts</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {(!person.recentPosts || person.recentPosts.length === 0) ? (
            <p className="text-sm text-gray-400 text-center py-4">No recent posts yet</p>
          ) : (
            person.recentPosts.map((post: { date: string; platform: string; content: string; url?: string }, i: number) => (
              <div key={i} className="flex items-start gap-3 pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{post.date}</span>
                    <span className="px-2 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 rounded-full text-xs font-medium">{post.platform}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{post.content}</p>
                </div>
                {post.url && (
                  <a href={post.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 text-gray-400 hover:text-violet-600 transition-colors mt-1">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Outreach sequence */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Outreach Sequence</h2>
              {(sequenceResult?.sequence?.length ?? 0) > 0 && (
                <span className="text-xs text-gray-400">{sequenceResult!.sequence.length} steps · {Math.max(...sequenceResult!.sequence.map(s => s.day))} days</span>
              )}
            </div>
            {sequenceResult?.amplemarket_url && (
              <a href={sequenceResult.amplemarket_url} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="sm"><Send className="w-3.5 h-3.5" />Add to Amplemarket</Button>
              </a>
            )}
          </div>
        </CardHeader>

        {generating ? (
          <div className="px-5 py-12 text-center">
            <Loader2 className="w-8 h-8 text-indigo-400 mx-auto mb-3 animate-spin" />
            <p className="text-slate-600 font-medium">Generating sequence — will update automatically…</p>
            <p className="text-slate-400 text-xs mt-1">Running via Clay</p>
          </div>
        ) : sequenceResult ? (
          <div>
            {/* Calculations summary */}
            {sequenceResult.calculations && (
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
                {sequenceResult.calculations.monthly_revenue && (
                  <span>Revenue <span className="font-semibold text-gray-700">${(sequenceResult.calculations.monthly_revenue / 1000).toFixed(0)}K/mo</span></span>
                )}
                {sequenceResult.calculations.monthly_downloads && (
                  <span>Downloads <span className="font-semibold text-gray-700">{(sequenceResult.calculations.monthly_downloads / 1000).toFixed(0)}K/mo</span></span>
                )}
                {sequenceResult.calculations.recoverable_annual_mail && (
                  <span>Mail recovery <span className="font-semibold text-green-600">${(sequenceResult.calculations.recoverable_annual_mail / 1000).toFixed(0)}K/yr</span></span>
                )}
                {sequenceResult.calculations.recoverable_annual_refund && (
                  <span>Refund recovery <span className="font-semibold text-green-600">${(sequenceResult.calculations.recoverable_annual_refund / 1000).toFixed(0)}K/yr</span></span>
                )}
              </div>
            )}
            {/* Steps timeline */}
            <div className="divide-y divide-gray-100">
              {(sequenceResult.sequence ?? []).map((step: SequenceStep, i: number) => {
                const stepId = `step-${i}`;
                const hasContent = step.body || step.script || step.content;
                const isEmail = step.channel === 'email';
                const channelColor = isEmail ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-violet-50 text-violet-600 border-violet-100';
                const touchLabel = step.touch_type.replace(/_/g, ' ');
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-400 w-8 shrink-0">D{step.day}</span>
                        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border shrink-0', channelColor)}>
                          {isEmail ? '✉' : 'in'} {touchLabel}
                          {step.email_number ? ` #${step.email_number}` : ''}
                          {step.dm_number ? ` #${step.dm_number}` : ''}
                        </span>
                        {step.subject && (
                          <span className="text-xs text-gray-500 truncate">"{step.subject}"</span>
                        )}
                      </div>
                      {hasContent && (
                        <Button variant="ghost" size="sm" className="shrink-0"
                          onClick={() => handleCopy(stepId, step.body || step.script || step.content || '')}>
                          <Copy className="w-3.5 h-3.5" />
                          {copied === stepId ? 'Copied!' : 'Copy'}
                        </Button>
                      )}
                    </div>
                    {(step.body || step.script) && (
                      <pre className="mt-2 text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed pl-10">
                        {step.body || step.script}
                      </pre>
                    )}
                    {step.content && (
                      <p className="mt-2 text-sm text-gray-600 italic pl-10">{step.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <CardContent>
            <div className="py-10 text-center">
              <Sparkles className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium mb-1">No outreach sequence yet</p>
              <p className="text-sm text-slate-400 mb-4">
                Generate a personalized sequence for {person.name} based on {account.signals.length} signals
              </p>
              <Button variant="primary" size="sm" onClick={handleGenerate}>
                <Sparkles className="w-3.5 h-3.5" />Generate Sequence
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Prompt export modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Sequence Prompt</h2>
                <p className="text-xs text-gray-400 mt-0.5">Paste into Claude.ai or send via email</p>
              </div>
              <button onClick={() => setShowPromptModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 leading-relaxed">
                {getPromptText()}
              </pre>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <Button variant="primary" size="sm" onClick={handleCopyPrompt} className="flex-1">
                <Copy className="w-3.5 h-3.5" />
                {promptCopied ? 'Copied!' : 'Copy Prompt'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleEmailPrompt} className="flex-1">
                <Mail className="w-3.5 h-3.5" />
                Send via Email
              </Button>
              <a
                href="https://claude.ai/new"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="secondary" size="sm" className="w-full">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Claude.ai
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
