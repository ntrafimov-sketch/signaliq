import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, MapPin, Users, Globe, Download, RefreshCw,
  ChevronDown, ChevronRight, Zap, Calendar
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { SignalCategoryBadge, ConfidenceBadge } from '../components/SignalBadge';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accounts } = useStore();
  const account = accounts.find(a => a.id === id);
  const [expandedDept, setExpandedDept] = useState<string | null>('Engineering');

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Account not found.</p>
        <Button onClick={() => navigate('/accounts')} className="mt-4">Back to Accounts</Button>
      </div>
    );
  }

  const scoreTierVariant = { Hot: 'hot', Warm: 'warm', Cold: 'cold' } as const;

  return (
    <div className="space-y-5">
      {/* Back */}
      <Link to="/accounts" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Accounts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <Avatar name={account.company_name} size="xl" />
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-semibold text-slate-900">{account.company_name}</h1>
              <Badge variant={scoreTierVariant[account.scoreLabel]}>
                {account.scoreLabel} · {account.score}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm text-slate-500">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{account.industry}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{account.country}</span>
              {account.employees > 0 && (
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{account.employees.toLocaleString()} employees</span>
              )}
              <a href={`https://${account.domain}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600">
                <Globe className="w-3.5 h-3.5" />{account.domain}
              </a>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-bold text-slate-900">{account.score}<span className="text-base font-normal text-slate-400">/100</span></div>
          <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">Account Score</div>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" size="sm">
              <Download className="w-3.5 h-3.5" />
              Export research
            </Button>
            <Button variant="primary" size="sm">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh signals
            </Button>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">FIT Score</span>
          <div className="flex items-center gap-1.5 text-sm text-slate-600">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="font-medium">{account.signals.length} signals</span>
            <span className="text-slate-400">· last 14 days</span>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all"
            style={{
              width: `${account.score}%`,
              background: account.score >= 80
                ? 'linear-gradient(90deg, #f97316, #ef4444)'
                : account.score >= 60
                ? 'linear-gradient(90deg, #f59e0b, #f97316)'
                : 'linear-gradient(90deg, #60a5fa, #6366f1)',
            }}
          />
        </div>
      </div>

      {/* Three column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Company overview */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Company Overview</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{account.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Founded', value: account.founded },
                  { label: 'HQ', value: account.hq },
                  { label: 'Revenue', value: account.revenue },
                  { label: 'Status', value: account.status },
                ].map(item => (
                  <div key={item.label}>
                    <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                    <p className="text-sm text-slate-700 font-medium mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Signals Timeline */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Signals Timeline</h2>
            </CardHeader>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {account.signals.map(signal => (
                <div key={signal.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <SignalCategoryBadge category={signal.category} />
                    <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <span>via {signal.source}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800">{signal.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{signal.description}</p>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <ConfidenceBadge level={signal.confidence} label="Confidence" />
                    <ConfidenceBadge level={signal.impact} label="Impact" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Center column */}
        <div className="space-y-4">
          {/* Why this account */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Why This Account Matters</h2>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 leading-relaxed">{account.whyMatters}</p>
              {(account.whyKeywords ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(account.whyKeywords ?? []).map(kw => (
                    <span key={kw} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full text-xs font-medium">{kw}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Opportunity Summary */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Opportunity Summary</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Business Trigger', text: account.opportunitySummary?.businessTrigger ?? '', highlight: false },
                { label: 'Likely Priorities', text: account.opportunitySummary?.likelyPriorities ?? '', highlight: false },
                { label: 'Potential Pain Points', text: account.opportunitySummary?.potentialPainPoints ?? '', highlight: false },
                { label: 'Recommended Angle', text: account.opportunitySummary?.recommendedAngle ?? '', highlight: true },
              ].map(item => (
                <div key={item.label} className={cn(
                  'rounded-lg p-3 text-sm',
                  item.highlight ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-slate-100'
                )}>
                  <p className={cn('font-semibold mb-1 text-xs uppercase tracking-wide', item.highlight ? 'text-indigo-700' : 'text-slate-500')}>
                    {item.label}
                  </p>
                  <p className={cn('leading-relaxed', item.highlight ? 'text-indigo-800' : 'text-slate-700')}>
                    {item.text || 'No data available.'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Relevant People */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Relevant People</h2>
                <span className="text-xs text-slate-400">Buying committee</span>
              </div>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {(account as any).people ? (
                (account as any).people.map((person: any) => (
                  <Link
                    key={person.id}
                    to={`/accounts/${account.id}/people/${person.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <Avatar name={person.name} size="sm" color={person.avatarColor} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-800">{person.name}</p>
                        <InfluenceBadge level={person.influence} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">{person.title}</p>
                      <p className="text-xs text-slate-400">{person.department}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 mt-1 flex-shrink-0" />
                  </Link>
                ))
              ) : (
                <div className="px-5 py-6 text-center text-sm text-slate-400">No contacts found</div>
              )}
            </div>
          </Card>

          {/* Department Intelligence */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Department Intelligence</h2>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {(account.departmentIntel ?? []).map(dept => (
                <div key={dept.name}>
                  <button
                    onClick={() => setExpandedDept(expandedDept === dept.name ? null : dept.name)}
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {dept.name}
                    {expandedDept === dept.name
                      ? <ChevronDown className="w-4 h-4 text-slate-400" />
                      : <ChevronRight className="w-4 h-4 text-slate-400" />
                    }
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
        </div>
      </div>
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
          <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
            <span className="text-slate-300 mt-0.5">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
