import { useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Download, RefreshCw,
  Calendar, MessageSquare, Briefcase, ChevronDown, ChevronRight, ExternalLink,
  Newspaper, TrendingUp, LayoutGrid
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { MetricChart } from '../components/MetricChart';
import { SignalCategoryBadge, ConfidenceBadge } from '../components/SignalBadge';
import { useStore } from '../store/useStore';
import { importTorpedoJson } from '../services/importTorpedo';
import { cn } from '../lib/utils';
import type { Person, Signal, SignalCategory } from '../types';

type Tab = 'Overview' | 'Signals' | 'News' | 'Paywall' | 'People' | 'HubSpot' | 'Ad Channels';

const TABS: Tab[] = ['Overview', 'Signals', 'News', 'Paywall', 'People', 'HubSpot', 'Ad Channels'];

function ScoreRingLarge({ score, tier }: { score: number; tier: string }) {
  const r = 26, circ = 2 * Math.PI * r;
  const color = tier === 'Hot' ? '#ef4444' : tier === 'Warm' ? '#f59e0b' : '#6366f1';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round" transform="rotate(-90 30 30)" />
        <text x="30" y="35" textAnchor="middle" className="text-sm font-bold" fontSize="14" fontWeight="700" fill="#111827">
          {score > 0 ? score : '–'}
        </text>
      </svg>
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Score</span>
    </div>
  );
}

function ImpactDots({ level }: { level: 'High' | 'Medium' | 'Low' }) {
  const color = level === 'High' ? 'text-red-500' : level === 'Medium' ? 'text-amber-500' : 'text-gray-300';
  const filled = level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
  return (
    <span className={cn('flex items-center gap-0.5', color)}>
      {[1, 2, 3].map(i => (
        <span key={i} className={cn('text-xs', i <= filled ? color : 'text-gray-200')}>●</span>
      ))}
    </span>
  );
}

const SIGNAL_CATEGORIES: Array<SignalCategory | 'All'> = ['All', 'Revenue', 'Competitive', 'Content', 'Social', 'Hiring'];
const AVATAR_PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#10b981'];

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accounts, updateAccount } = useStore();
  const account = accounts.find(a => a.id === id);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [expandedDept, setExpandedDept] = useState<string | null>('Engineering');
  const [signalCategory, setSignalCategory] = useState<SignalCategory | 'All'>('All');
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [peopleView, setPeopleView] = useState<'contacts' | 'org'>('contacts');
  const [jsonPasteError, setJsonPasteError] = useState('');
  const jsonTextareaRef = useRef<HTMLTextAreaElement>(null);

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Account not found.</p>
        <Button onClick={() => navigate('/accounts')} className="mt-4">Back to Accounts</Button>
      </div>
    );
  }

  const hubspotSignals = account.signals.filter((s: Signal) => s.source === 'HubSpot');
  const hiringSignals = account.signals.filter((s: Signal) => s.category === 'Hiring');
  const otherSignals = account.signals.filter((s: Signal) => s.source !== 'HubSpot');

  const filteredSignals = signalCategory === 'All'
    ? otherSignals
    : otherSignals.filter((s: Signal) => s.category === signalCategory);

  const scoreTierVariant = { Hot: 'hot', Warm: 'warm', Cold: 'cold' } as const;


  const byDate = (a: Signal, b: Signal) => new Date(b.date).getTime() - new Date(a.date).getTime();

  const hubspotDeals = account.signals
    .filter((s: Signal) => s.source === 'HubSpot' && s.title.startsWith('Deal:'))
    .sort(byDate);
  const hubspotContent = account.signals
    .filter((s: Signal) => s.source === 'HubSpot' && !s.title.startsWith('Deal:') && s.type !== 'Webinar Visited')
    .sort(byDate);
  const hubspotEngagement = account.signals
    .filter((s: Signal) => s.source === 'HubSpot' && s.type === 'Webinar Visited');
  // Show contacts from research (amplemarket) — if none, show all people
  const researchPeople = (account.people ?? []).filter(p => p.source === 'amplemarket');
  const amplemarketPeople = researchPeople.length > 0 ? researchPeople : (account.people ?? []).filter(p => p.source !== 'hubspot');

  return (
    <div className="space-y-5">
      <Link to="/accounts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Companies
      </Link>

      {/* Header card */}
      <div className="bg-gradient-to-r from-violet-50 to-white p-6 rounded-xl border border-gray-200">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          {/* Left: Company info */}
          <div className="flex items-start gap-4">
            <CompanyLogo domain={account.domain} name={account.company_name} />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{account.company_name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <a
                  href={`https://${account.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {account.domain}
                </a>
                <Badge variant="default">{account.industry}</Badge>
                <Badge variant={scoreTierVariant[account.scoreLabel]}>{account.scoreLabel}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap text-sm text-gray-500">
                {account.employees > 0 && (
                  <span>{account.employees.toLocaleString()} employees</span>
                )}
                {account.founded && <span>Founded {account.founded}</span>}
                {account.hq && <span>📍 {account.hq}</span>}
              </div>
            </div>
          </div>

          {/* Right: Score ring + actions */}
          <div className="flex items-center gap-6 flex-shrink-0">
            <ScoreRingLarge score={account.score} tier={account.scoreLabel} />
            <div className="flex flex-col gap-2">
              <Button variant="secondary" size="sm"><Download className="w-3.5 h-3.5" />Export</Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowJsonPaste(true); setJsonPasteError(''); }}>
                <RefreshCw className="w-3.5 h-3.5" />Paste JSON
              </Button>
            </div>
          </div>
        </div>

        {/* Score tier bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fit Score</span>
            <span className="text-xs text-gray-400">{account.signals.length} signals</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full transition-all" style={{
              width: `${account.score}%`,
              background: account.score >= 80
                ? 'linear-gradient(90deg, #f97316, #ef4444)'
                : account.score >= 60
                ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                : 'linear-gradient(90deg, #60a5fa, #6366f1)',
            }} />
          </div>
        </div>
      </div>

      {/* JSON Paste Modal */}
      {showJsonPaste && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Paste Torpedo JSON</h2>
              <button onClick={() => setShowJsonPaste(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <p className="text-sm text-gray-500">Paste the full JSON array from the research agent to update this account.</p>
            <textarea
              ref={jsonTextareaRef}
              className="w-full h-64 rounded-xl border border-gray-200 p-3 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              placeholder='[{"type":"company_intel","data":{...}}, ...]'
            />
            {jsonPasteError && <p className="text-sm text-red-500">{jsonPasteError}</p>}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowJsonPaste(false)}>Cancel</Button>
              <Button size="sm" onClick={() => {
                try {
                  const raw = jsonTextareaRef.current?.value || '';
                  const parsed = JSON.parse(raw);
                  const arr = Array.isArray(parsed) ? parsed : Object.values(parsed as Record<string, unknown>);
                  const updates = importTorpedoJson(arr as Parameters<typeof importTorpedoJson>[0], account.id, account.company_name);
                  updateAccount(account.id, { ...updates, lastUpdated: 'Just now' });
                  setShowJsonPaste(false);
                  setJsonPasteError('');
                } catch (e) {
                  setJsonPasteError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
                }
              }}>
                Import
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pill tabs */}
      <div className="flex items-center gap-2">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              activeTab === tab
                ? 'bg-black text-white'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left col (col-span-2) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Charts first */}
            {account.revenueHistory && account.revenueHistory.length > 1 && (
              <Card>
                <CardContent>
                  <MetricChart data={account.revenueHistory} type="revenue" title="iOS + Android Revenue" />
                </CardContent>
              </Card>
            )}
            {account.downloadHistory && account.downloadHistory.length > 1 && (
              <Card>
                <CardContent>
                  <MetricChart data={account.downloadHistory} type="downloads" title="iOS + Android Downloads" />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Why This Account Matters</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 leading-relaxed">{account.whyMatters || 'No data available.'}</p>
                {(account.whyKeywords ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(account.whyKeywords ?? []).map(kw => (
                      <span key={kw} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium">{kw}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Opportunity</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Business Trigger', text: account.opportunitySummary?.businessTrigger ?? '', highlight: false },
                  { label: 'Likely Priorities', text: account.opportunitySummary?.likelyPriorities ?? '', highlight: false },
                  { label: 'Pain Points', text: account.opportunitySummary?.potentialPainPoints ?? '', highlight: false },
                  { label: 'Recommended Angle', text: account.opportunitySummary?.recommendedAngle ?? '', highlight: true },
                ].map(item => (
                  <div key={item.label} className={cn('rounded-lg p-3 text-sm', item.highlight ? 'bg-violet-50 border border-violet-100' : 'bg-gray-50 border border-gray-100')}>
                    <p className={cn('font-semibold mb-1 text-xs uppercase tracking-wide', item.highlight ? 'text-violet-700' : 'text-gray-500')}>{item.label}</p>
                    <p className={cn('leading-relaxed', item.highlight ? 'text-violet-800' : 'text-gray-700')}>{item.text || 'No data available.'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>

          {/* Right col */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Company Details</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">{account.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Founded', value: account.founded },
                    { label: 'HQ', value: account.hq },
                    { label: 'Monthly Tracked Revenue', value: account.lastMonthRevenue || '—' },
                    { label: 'Status', value: account.status },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                      <p className="text-sm text-gray-700 font-medium mt-0.5">{item.value || 'N/A'}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Apps card */}
            {account.products && account.products.length > 0 && (
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Apps</h2>
                </CardHeader>
                <CardContent className="space-y-3">
                  {account.products.map((app, i) => (
                    <div key={i} className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{app.app_name}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs capitalize">{app.platform}</span>
                          {app.has_in_app_purchases === true && (
                            <span className="px-2 py-0.5 bg-violet-50 text-violet-600 border border-violet-100 rounded-full text-xs font-medium">IAP</span>
                          )}
                          {app.has_in_app_purchases === false && (
                            <span className="px-2 py-0.5 bg-gray-50 text-gray-400 border border-gray-100 rounded-full text-xs">No IAP</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {app.store_url_ios && (
                          <a href={app.store_url_ios} target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 bg-gray-50 hover:bg-violet-50 text-gray-400 hover:text-violet-600 rounded-lg text-xs transition-colors">
                            iOS
                          </a>
                        )}
                        {app.store_url_android && (
                          <a href={app.store_url_android} target="_blank" rel="noopener noreferrer"
                            className="px-2 py-1 bg-gray-50 hover:bg-violet-50 text-gray-400 hover:text-violet-600 rounded-lg text-xs transition-colors">
                            Android
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Investment card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Investment</h2>
                </div>
              </CardHeader>
              <CardContent>
                {(!account.investmentHistory || account.investmentHistory.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-2">No investment data yet</p>
                ) : (
                  <div className="space-y-4">
                    {account.investmentHistory.map((round, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{round.round}</p>
                          <p className="text-xs text-gray-400">{round.date}</p>
                        </div>
                        <p className="text-sm font-bold text-gray-900">{round.amount}</p>
                        {round.investors.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {round.investors.map((inv, j) => (
                              <span key={j} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{inv}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {activeTab === 'Signals' && (
        <div className="space-y-4">
          {/* Category filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {SIGNAL_CATEGORIES.map(cat => {
              const count = cat === 'All'
                ? otherSignals.length
                : otherSignals.filter((s: Signal) => s.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSignalCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition-colors border',
                    signalCategory === cat
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {cat}
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full font-semibold',
                    signalCategory === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredSignals.length === 0 ? (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-gray-400">No signals in this category</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSignals.map((signal: Signal) => (
                <Card key={signal.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <SignalCategoryBadge category={signal.category} />
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">via {signal.source}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{signal.title}</p>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{signal.description}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <ConfidenceBadge level={signal.confidence} label="Confidence" />
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <ImpactDots level={signal.impact} />
                        <span>{signal.impact} impact</span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'News' && (
        <div className="space-y-4 max-w-3xl">
          {(!account.news || account.news.length === 0) ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Newspaper className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No news data yet</p>
              </CardContent>
            </Card>
          ) : (
            account.news.map((item, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">{item.date}</span>
                        {item.source && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{item.source}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      {item.summary && (
                        <p className="text-sm text-gray-500 leading-relaxed">{item.summary}</p>
                      )}
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 text-gray-400 hover:text-violet-600 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'Paywall' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            {account.paywallScreenshot ? (
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Screenshot</h2>
                </CardHeader>
                <CardContent>
                  <img
                    src={account.paywallScreenshot}
                    alt="Paywall screenshot"
                    className="w-full rounded-xl object-contain bg-gray-50"
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <LayoutGrid className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No paywall screenshot yet — upload one when adding the company</p>
                </CardContent>
              </Card>
            )}
          </div>
          <div className="space-y-4">
            {account.paywallAnalysis ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Paywall Type</h2>
                      <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-semibold">
                        {account.paywallAnalysis.paywall_type}
                      </span>
                    </div>
                  </CardHeader>
                </Card>
                {account.paywallAnalysis.key_observations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Key Observations</h2>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {account.paywallAnalysis.key_observations.map((obs, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>{obs}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {account.paywallAnalysis.monetization_stack.length > 0 && (
                  <Card>
                    <CardHeader>
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Monetization Stack</h2>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {account.paywallAnalysis.monetization_stack.map((item, i) => (
                          <span key={i} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium">{item}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {account.paywallAnalysis.opportunities.length > 0 && (
                  <Card>
                    <CardHeader>
                      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Opportunities</h2>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {account.paywallAnalysis.opportunities.map((opp, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-violet-400 mt-0.5 flex-shrink-0">→</span>{opp}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-sm text-gray-400">No paywall analysis data yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'People' && (
        <div className="space-y-4">
          {/* View toggle */}
          {account.orgChart && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPeopleView('contacts')}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', peopleView === 'contacts' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300')}>
                Contacts
              </button>
              <button onClick={() => setPeopleView('org')}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', peopleView === 'org' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-violet-300')}>
                Org Chart
              </button>
            </div>
          )}

          {/* Org Chart view */}
          {peopleView === 'org' && account.orgChart && (() => {
            const org = account.orgChart!;
            const sections = [
              { label: 'C-Level', people: org.c_level ?? [], color: 'bg-violet-100 text-violet-700 border-violet-200' },
              { label: 'VP / Director', people: org.vp_director ?? [], color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
              { label: 'Manager / IC', people: org.manager_ic ?? [], color: 'bg-gray-50 text-gray-600 border-gray-100' },
              { label: 'Other', people: org.unknown ?? [], color: 'bg-gray-50 text-gray-500 border-gray-100' },
            ].filter(s => s.people.length > 0);

            return (
              <div className="space-y-5">
                {sections.map(section => (
                  <div key={section.label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{section.label}</p>
                    <div className="space-y-2">
                      {section.people.map((p, i) => {
                        const linked = (account.people ?? []).find(person =>
                          person.name.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()) ||
                          p.name.toLowerCase().includes(person.name.split(' ')[0].toLowerCase())
                        );
                        return (
                          <div key={i} className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border', section.color)}>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: AVATAR_PALETTE[i % AVATAR_PALETTE.length] }}>
                              {p.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                            </div>
                            <div className="flex-1 min-w-0">
                              {linked ? (
                                <Link to={`/accounts/${account.id}/people/${linked.id}`}
                                  className="text-sm font-semibold text-gray-900 hover:text-violet-600 transition-colors">
                                  {p.name}
                                </Link>
                              ) : (
                                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                              )}
                              <p className="text-xs text-gray-500 truncate">{p.title}</p>
                            </div>
                            {p.reports_to && (
                              <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                                <span className="hidden sm:inline">→</span>
                                <span className="hidden sm:inline truncate max-w-32">{p.reports_to}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Contacts view */}
          {peopleView === 'contacts' && (amplemarketPeople.length === 0 ? (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-gray-400">No Amplemarket contacts found</div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {amplemarketPeople.map((person: Person) => (
                <Link key={person.id} to={`/accounts/${account.id}/people/${person.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-start gap-3">
                    <Avatar name={person.name} size="md" color={person.avatarColor} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{person.name}</p>
                        <InfluenceBadge level={person.influence} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{person.title}</p>
                      <p className="text-xs text-gray-400">{person.department}</p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {person.email && (
                          <a href={`mailto:${person.email}`}
                            className="text-xs text-gray-500 hover:text-gray-800 truncate max-w-full"
                          >{person.email}</a>
                        )}
                        {person.linkedin && (
                          <a href={person.linkedin} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="w-3 h-3" />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  {person.recentPosts && person.recentPosts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 mb-2">
                        <MessageSquare className="w-3 h-3 text-gray-400" />
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recent Posts</p>
                      </div>
                      <div className="space-y-2">
                        {person.recentPosts.slice(0, 3).map((post, i) => (
                          <div key={i} className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-400">{post.date}</span>
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{post.platform}</span>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2">{post.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'HubSpot' && (
        <div className="space-y-5">
            {hubspotSignals.length === 0 ? (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-gray-400">No HubSpot data available</div>
            </Card>
          ) : null}

          {/* Engagement summary */}
          {hubspotEngagement.length > 0 && (
            <Card>
              <CardContent>
                {hubspotEngagement.map((signal: Signal) => (
                  <div key={signal.id}>
                    <p className="text-sm font-semibold text-gray-900">{signal.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{signal.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Deals */}
          {hubspotDeals.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-500" />
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Deals</h2>
                  </div>
                  <span className="text-xs text-gray-400">{hubspotDeals.length}</span>
                </div>
              </CardHeader>
              <div className="divide-y divide-gray-100">
                {hubspotDeals.map((signal: Signal) => (
                  <div key={signal.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{signal.title}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{signal.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Content Consumption */}
          {hubspotContent.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Content Consumption</h2>
                  </div>
                  <span className="text-xs text-gray-400">{hubspotContent.length}</span>
                </div>
              </CardHeader>
              <div className="divide-y divide-gray-100">
                {hubspotContent.map((signal: Signal) => (
                  <div key={signal.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">{signal.title}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{signal.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'Ad Channels' && (
        <div className="space-y-5">
          {!account.adIntelligence ? (
            <Card><div className="px-5 py-10 text-center text-sm text-gray-400">No ad intelligence data</div></Card>
          ) : (
            <>
              {/* Active channels */}
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Active UA Channels</h2>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {account.adIntelligence.activeChannels.map(ch => (
                      <span key={ch} className={`px-3 py-1 rounded-full text-sm font-medium border ${
                        account.adIntelligence!.primaryChannels.includes(ch)
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                        {account.adIntelligence!.primaryChannels.includes(ch) ? '★ ' : ''}{ch}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Creative Formats</p>
                      <p className="text-sm text-gray-700 mt-0.5">{account.adIntelligence.creativeFormats.join(', ') || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">Spend Trend</p>
                      <p className={`text-sm font-medium mt-0.5 ${account.adIntelligence.spendTrend === 'scaling' ? 'text-green-600' : 'text-gray-700'}`}>
                        {account.adIntelligence.spendTrend || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">ASA Present</p>
                      <p className={`text-sm font-medium mt-0.5 ${account.adIntelligence.asaPresent ? 'text-green-600' : 'text-gray-500'}`}>
                        {account.adIntelligence.asaPresent ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* UA Sophistication */}
              {account.adIntelligence.uaSophistication && (
                <Card>
                  <CardHeader><h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">UA Sophistication</h2></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 leading-relaxed">{account.adIntelligence.uaSophistication}</p>
                  </CardContent>
                </Card>
              )}

              {/* MMP Gap */}
              {account.adIntelligence.mmpGap && (
                <Card>
                  <CardHeader><h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">MMP / Measurement</h2></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 leading-relaxed">{account.adIntelligence.mmpGap}</p>
                  </CardContent>
                </Card>
              )}

              {/* Paywall tension */}
              {account.adIntelligence.paywallTension && (
                <Card>
                  <CardHeader><h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Paywall & Revenue Tension</h2></CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 leading-relaxed">{account.adIntelligence.paywallTension}</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* Department Intelligence (shown in overview, collapsed) */}
      {activeTab === 'Overview' && (account.departmentIntel ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Department Intelligence</h2>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {(account.departmentIntel ?? []).map(dept => (
              <div key={dept.name}>
                <button
                  onClick={() => setExpandedDept(expandedDept === dept.name ? null : dept.name)}
                  className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {dept.name}
                  {expandedDept === dept.name
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                {expandedDept === dept.name && (
                  <div className="px-5 pb-4 space-y-3">
                    <IntelSection label="Goals" items={dept.goals} color="text-green-700" />
                    <IntelSection label="Challenges" items={dept.challenges} color="text-red-700" />
                    <IntelSection label="Messaging Recommendations" items={dept.messagingRecommendations} color="text-indigo-700" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Hiring signals in overview */}
      {activeTab === 'Overview' && hiringSignals.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Job Openings</h2>
              </div>
              <span className="text-xs text-gray-400">{hiringSignals.length}</span>
            </div>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {hiringSignals.map((signal: Signal) => (
              <div key={signal.id} className="px-5 py-3.5">
                <p className="text-sm font-medium text-gray-800">{signal.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{signal.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-400">via {signal.source}</span>
                  <ConfidenceBadge level={signal.confidence} label="Confidence" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function CompanyLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  if (!failed) {
    return (
      <img
        src={`https://logo.clearbit.com/${cleanDomain}`}
        alt={name}
        onError={() => setFailed(true)}
        className="w-14 h-14 rounded-xl object-contain bg-white border border-gray-100 p-1"
      />
    );
  }
  return <Avatar name={name} size="xl" />;
}

function InfluenceBadge({ level }: { level: 'High' | 'Medium' | 'Low' }) {
  const variants = { High: 'high', Medium: 'medium', Low: 'low' } as const;
  return <Badge variant={variants[level]} className="text-xs">{level}</Badge>;
}

function IntelSection({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1.5', color)}>{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
            <span className="text-gray-300 mt-0.5">•</span>{item}
          </li>
        ))}
      </ul>
    </div>
  );
}
