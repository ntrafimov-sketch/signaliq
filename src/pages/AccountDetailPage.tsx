import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Globe, Download, RefreshCw,
  Calendar, MessageSquare, Briefcase, ChevronDown, ChevronRight, ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { SignalCategoryBadge, ConfidenceBadge } from '../components/SignalBadge';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import type { Person, Signal, SignalCategory } from '../types';

type Tab = 'Overview' | 'Signals' | 'People' | 'Deals';

const TABS: Tab[] = ['Overview', 'Signals', 'People', 'Deals'];

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

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accounts } = useStore();
  const account = accounts.find(a => a.id === id);
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [expandedDept, setExpandedDept] = useState<string | null>('Engineering');
  const [signalCategory, setSignalCategory] = useState<SignalCategory | 'All'>('All');

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

  const dealSignals = account.signals.filter((s: Signal) =>
    s.source === 'HubSpot' || s.category === 'Revenue'
  );

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
            <Avatar name={account.company_name} size="xl" />
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
              <Button variant="secondary" size="sm"><RefreshCw className="w-3.5 h-3.5" />Refresh</Button>
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
                  <div key={item.label} className={cn('rounded-lg p-3 text-sm', item.highlight ? 'bg-indigo-50 border border-indigo-100' : 'bg-gray-50 border border-gray-100')}>
                    <p className={cn('font-semibold mb-1 text-xs uppercase tracking-wide', item.highlight ? 'text-indigo-700' : 'text-gray-500')}>{item.label}</p>
                    <p className={cn('leading-relaxed', item.highlight ? 'text-indigo-800' : 'text-gray-700')}>{item.text || 'No data available.'}</p>
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
                    { label: 'Revenue', value: account.revenue },
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

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">HubSpot CRM</h2>
                  </div>
                  <span className="text-xs text-gray-400">{hubspotSignals.length}</span>
                </div>
              </CardHeader>
              {hubspotSignals.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-gray-400">No CRM data</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {hubspotSignals.map((signal: Signal) => (
                    <div key={signal.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{signal.type}</span>
                        <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                          <Calendar className="w-3 h-3" />
                          {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-1">{signal.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{signal.description}</p>
                    </div>
                  ))}
                </div>
              )}
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

      {activeTab === 'People' && (
        <div className="space-y-4">
          {(account.people ?? []).length === 0 ? (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-gray-400">No contacts found</div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(account.people ?? []).map((person: Person) => (
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
                        {person.linkedin && (
                          <a
                            href={person.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="w-3 h-3" />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'Deals' && (
        <div className="space-y-4">
          {dealSignals.length === 0 ? (
            <Card>
              <div className="px-5 py-10 text-center text-sm text-gray-400">No deal signals found</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {dealSignals.map((signal: Signal) => (
                <Card key={signal.id}>
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-blue-500" />
                        <SignalCategoryBadge category={signal.category} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{signal.title}</p>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{signal.description}</p>
                    <p className="text-xs text-gray-400 mt-2">via {signal.source}</p>
                  </div>
                </Card>
              ))}
            </div>
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
