import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Download, Plus, Zap, Building2, Globe, Users, ChevronUp, ChevronDown,
  CheckCircle2, Loader2, LayoutGrid, List, Play, Bot
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { CsvUpload } from '../components/CsvUpload';
import { useStore } from '../store/useStore';
import { enrichAccountWithManagedAgent, isAgentConfigured } from '../services/managedAgent';
import { enrichDirect } from '../services/directEnrich';
import { runResearchAgent } from '../services/researchAgent';
import { importTorpedoJson } from '../services/importTorpedo';
import { isClaudeConfigured } from '../services/claude';
import { connectWebhookListener } from '../services/webhookListener';
import { calculateAccountScore } from '../services/signals';
import type { Account } from '../types';
import { cn } from '../lib/utils';

type SortField = 'company_name' | 'score' | 'employees' | 'signals' | 'lastUpdated';
type SortDir = 'asc' | 'desc';

const scoreOptions = [
  { value: 'all', label: 'All scores' },
  { value: 'Hot', label: '🔴 Hot' },
  { value: 'Warm', label: '🟠 Warm' },
  { value: 'Cold', label: '🔵 Cold' },
];

const industryOptions = [
  { value: 'all', label: 'All industries' },
  { value: 'Fintech', label: 'Fintech' },
  { value: 'Mobility', label: 'Mobility' },
  { value: 'Media', label: 'Media' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'E-commerce', label: 'E-commerce' },
];

const countryOptions = [
  { value: 'all', label: 'All countries' },
  { value: 'United States', label: 'United States' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Estonia', label: 'Estonia' },
  { value: 'Germany', label: 'Germany' },
];

function ScoreBadge({ score, tier }: { score: number; tier: Account['scoreLabel'] }) {
  const variantMap = { Hot: 'hot', Warm: 'warm', Cold: 'cold' } as const;
  return (
    <Badge variant={variantMap[tier]}>
      <span className="font-semibold">{tier}</span>
      <span className="opacity-70">·</span>
      <span>{score}</span>
    </Badge>
  );
}

export function AccountsPage() {
  const { accounts, isUploading, uploadSuccess, setUploadSuccess, updateAccount } = useStore();
  const [search, setSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<SortField>('score');

  // Listen for Clay webhook enrichments
  useEffect(() => {
    const disconnect = connectWebhookListener((accountId, companyName, torpedoData) => {
      const normalizeDomain = (d: string) => d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
      const account = accounts.find(a =>
        a.id === accountId ||
        normalizeDomain(a.domain) === normalizeDomain(accountId) ||
        a.company_name.toLowerCase().trim() === companyName.toLowerCase().trim()
      );
      if (!account) return;
      const updates = importTorpedoJson(torpedoData as Parameters<typeof importTorpedoJson>[0], account.id, account.company_name);
      updateAccount(account.id, { ...updates, lastUpdated: 'Just now' });
    });
    return disconnect;
  }, [accounts, updateAccount]);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [progressMessages, setProgressMessages] = useState<Record<string, string>>({});

  const startEnrichment = useCallback(async (account: Account) => {
    setEnrichingIds(prev => new Set(prev).add(account.id));
    updateAccount(account.id, { enrichmentStatus: 'enriching' });
    try {
      if (isClaudeConfigured()) {
        // Research Agent: Claude with tools → torpedo JSON → import
        setProgressMessages(prev => ({ ...prev, [account.id]: 'Starting Research Agent...' }));
        const torpedoJson = await runResearchAgent(
          { domain: account.domain, company_name: account.company_name, industry: account.industry },
          (msg) => setProgressMessages(prev => ({ ...prev, [account.id]: msg })),
        ) as Parameters<typeof importTorpedoJson>[0];
        const updates = importTorpedoJson(torpedoJson, account.id, account.company_name);
        updateAccount(account.id, { ...updates, lastUpdated: 'Just now' });
      } else if (isAgentConfigured()) {
        const result = await enrichAccountWithManagedAgent(
          { id: account.id, domain: account.domain, company_name: account.company_name, industry: account.industry },
          (msg) => setProgressMessages(prev => ({ ...prev, [account.id]: msg })),
        );
        const score = calculateAccountScore(result.signals);
        const scoreLabel = (score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Cold') as Account['scoreLabel'];
        updateAccount(account.id, { signals: result.signals, score, scoreLabel, enrichmentStatus: 'done', lastUpdated: 'Just now' });
      } else {
        const result = await enrichDirect(
          { id: account.id, domain: account.domain, company_name: account.company_name, industry: account.industry },
          (msg) => setProgressMessages(prev => ({ ...prev, [account.id]: msg })),
        );
        const score = calculateAccountScore(result.signals);
        const scoreLabel = (score >= 80 ? 'Hot' : score >= 60 ? 'Warm' : 'Cold') as Account['scoreLabel'];
        updateAccount(account.id, { signals: result.signals, score, scoreLabel, enrichmentStatus: 'done', lastUpdated: 'Just now' });
      }
    } catch {
      updateAccount(account.id, { enrichmentStatus: 'error' });
    } finally {
      setEnrichingIds(prev => { const s = new Set(prev); s.delete(account.id); return s; });
      setProgressMessages(prev => { const n = { ...prev }; delete n[account.id]; return n; });
    }
  }, [updateAccount]);


  const filtered = accounts
    .filter(a => {
      if (search && !a.company_name.toLowerCase().includes(search.toLowerCase()) && !a.domain.toLowerCase().includes(search.toLowerCase())) return false;
      if (scoreFilter !== 'all' && a.scoreLabel !== scoreFilter) return false;
      if (industryFilter !== 'all' && a.industry !== industryFilter) return false;
      if (countryFilter !== 'all' && a.country !== countryFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortField === 'company_name') { va = a.company_name; vb = b.company_name; }
      else if (sortField === 'score') { va = a.score; vb = b.score; }
      else if (sortField === 'employees') { va = a.employees; vb = b.employees; }
      else if (sortField === 'signals') { va = a.signals.length; vb = b.signals.length; }
      else { va = a.lastUpdated; vb = b.lastUpdated; }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload target accounts and identify the best opportunities based on market signals.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="primary" size="sm">
            <Plus className="w-4 h-4" />
            New list
          </Button>
        </div>
      </div>

      {/* Upload success banner */}
      {uploadSuccess && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Imported {uploadSuccess.count} accounts · Signals enriched in {uploadSuccess.duration.toFixed(1)}s
          </div>
          <button onClick={() => setUploadSuccess(null)} className="text-green-600 hover:text-green-800 text-xs">Dismiss</button>
        </div>
      )}

      {/* Agent not configured warning */}
      {!isAgentConfigured() && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <Bot className="w-4 h-4 flex-shrink-0" />
          Agent not configured. Run <code className="font-mono bg-amber-100 px-1 rounded">node scripts/create-agent.mjs</code> and add the IDs to <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
        </div>
      )}

      {/* CSV Upload */}
      {isUploading ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-violet-700 animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Enriching signals for uploaded accounts...</p>
        </div>
      ) : (
        <CsvUpload />
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            icon={<Search className="w-4 h-4" />}
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          options={scoreOptions}
          value={scoreFilter}
          onChange={e => setScoreFilter(e.target.value)}
          className="w-36"
        />
        <Select
          options={industryOptions}
          value={industryFilter}
          onChange={e => setIndustryFilter(e.target.value)}
          className="w-40"
        />
        <Select
          options={countryOptions}
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          className="w-40"
        />
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={cn('p-2 transition-colors', viewMode === 'table' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={cn('p-2 transition-colors', viewMode === 'grid' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600')}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-700">No accounts yet</p>
            <p className="text-sm text-gray-500 mt-1">Upload a CSV of target accounts to start surfacing buying signals.</p>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(account => (
            <Link key={account.id} to={`/accounts/${account.id}`}>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <Avatar name={account.company_name} size="md" />
                  <ScoreBadge score={account.score} tier={account.scoreLabel} />
                </div>
                <h3 className="font-semibold text-gray-900">{account.company_name}</h3>
                <p className="text-xs text-gray-500">{account.domain}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{account.industry}</span>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>{account.signals.length}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('company_name')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Company <SortIcon field="company_name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden md:table-cell">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Industry</span>
                </th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">
                  <button onClick={() => handleSort('employees')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    <Users className="w-3.5 h-3.5" />
                    Employees <SortIcon field="employees" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('score')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Score <SortIcon field="score" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('signals')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Signals <SortIcon field="signals" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">
                  <button onClick={() => handleSort('lastUpdated')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Last Updated <SortIcon field="lastUpdated" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(account => (
                <tr
                  key={account.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link to={`/accounts/${account.id}`} className="flex items-center gap-3">
                      <Avatar name={account.company_name} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{account.company_name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Globe className="w-3 h-3" />
                          {account.domain}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-gray-600">{account.industry}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-gray-600">{account.employees > 0 ? account.employees.toLocaleString() : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreBadge score={account.score} tier={account.scoreLabel} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>{account.signals.length}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-500">{account.lastUpdated}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {enrichingIds.has(account.id) ? (
                      <div className="flex items-center justify-end gap-1.5 text-xs text-violet-700 max-w-48 text-right">
                        <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                        <span className="truncate">{progressMessages[account.id] || 'Starting agent...'}</span>
                      </div>
                    ) : account.enrichmentStatus === 'done' ? (
                      <div className="flex items-center justify-end gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </div>
                    ) : account.enrichmentStatus === 'error' ? (
                      <button
                        onClick={(e) => { e.preventDefault(); startEnrichment(account); }}
                        className="text-xs text-red-500 hover:text-red-700 underline"
                      >
                        Retry
                      </button>
                    ) : (account.enrichmentStatus === 'pending' || !account.enrichmentStatus) ? (
                      <button
                        onClick={(e) => { e.preventDefault(); startEnrichment(account); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-xs font-medium transition-colors"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        Start
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
