import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Globe, Users, ChevronUp, ChevronDown,
  CheckCircle2, Loader2, Plus, Trash2
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { CsvUpload } from '../components/CsvUpload';
import { useStore } from '../store/useStore';
import { importTorpedoJson } from '../services/importTorpedo';
import { connectWebhookListener, subscribeWsStatus, getWsUrl } from '../services/webhookListener';
import type { Account } from '../types';
import { cn } from '../lib/utils';

type SortField = 'company_name' | 'score' | 'employees' | 'signals' | 'lastUpdated';
type SortDir = 'asc' | 'desc';

function ScoreRing({ score, tier }: { score: number; tier: string }) {
  const r = 18, circ = 2 * Math.PI * r;
  const color = tier === 'Hot' ? '#ef4444' : tier === 'Warm' ? '#f59e0b' : '#6366f1';
  return (
    <div className="flex items-center gap-2">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          strokeLinecap="round" transform="rotate(-90 22 22)" />
      </svg>
      <span className="text-lg font-bold text-gray-900">{score > 0 ? score : '–'}</span>
    </div>
  );
}

function AccountLogo({ domain, name }: { domain: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  if (!failed) {
    return (
      <img
        src={`https://logo.clearbit.com/${cleanDomain}`}
        alt={name}
        onError={() => setFailed(true)}
        className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 p-0.5"
      />
    );
  }
  return <Avatar name={name} size="sm" />;
}

export function AccountsPage() {
  const { accounts, isUploading, uploadSuccess, setUploadSuccess, updateAccount, addAccounts, removeAccount } = useStore();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [wsLastMsg, setWsLastMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeWsStatus((status, msg) => {
      setWsStatus(status);
      if (msg) setWsLastMsg(msg);
    });
    return () => unsub();
  }, []);

  // Keep a ref to latest accounts so the webhook handler never captures stale closure
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    const normalizeDomain = (d: string) =>
      d.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

    const disconnect = connectWebhookListener((accountId, companyName, torpedoData) => {
      try {
        const current = accountsRef.current;
        const account = current.find(a =>
          a.id === accountId ||
          normalizeDomain(a.domain) === normalizeDomain(accountId) ||
          a.company_name.toLowerCase().trim() === companyName.toLowerCase().trim()
        );
        const baseId = account ? account.id : `webhook-${Date.now()}`;
        const baseName = account ? account.company_name : companyName;

        console.log('[webhook] torpedoData type:', typeof torpedoData, Array.isArray(torpedoData), torpedoData);
        // Clay sometimes sends an object instead of array — wrap it
        const safeData: unknown[] = Array.isArray(torpedoData)
          ? torpedoData
          : torpedoData && typeof torpedoData === 'object'
          ? Object.values(torpedoData as Record<string, unknown>)
          : [];
        const updates = importTorpedoJson(safeData as Parameters<typeof importTorpedoJson>[0], baseId, baseName);

        if (!account) {
          const newAccount: Account = {
            id: baseId,
            company_name: companyName,
            domain: accountId,
            industry: (updates.industry as string) || 'Unknown',
            employees: updates.employees || 0,
            country: '',
            score: updates.score || 0,
            scoreLabel: updates.scoreLabel || 'Cold',
            signals: updates.signals || [],
            enrichmentStatus: 'done',
            lastUpdated: 'Just now',
            description: updates.description || '',
            founded: updates.founded || '',
            hq: updates.hq || '',
            revenue: updates.revenue || '',
            lastMonthRevenue: updates.lastMonthRevenue,
            status: 'Private',
            logoColor: '#6366f1',
            people: updates.people,
            whyMatters: updates.whyMatters,
            whyKeywords: updates.whyKeywords,
            opportunitySummary: updates.opportunitySummary,
            adIntelligence: updates.adIntelligence,
          };
          console.log('[webhook] creating new account', newAccount.company_name, newAccount.id);
          addAccounts([newAccount]);
        } else {
          console.log('[webhook] updating existing account', account.company_name);
          updateAccount(account.id, { ...updates, lastUpdated: 'Just now' });
        }
      } catch (err) {
        console.error('[webhook] handler error', err);
      }
    });
    return disconnect;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addAccounts, updateAccount]);


  const filtered = accounts
    .filter(a => {
      if (search && !a.company_name.toLowerCase().includes(search.toLowerCase()) && !a.domain.toLowerCase().includes(search.toLowerCase())) return false;
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

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-900 flex-shrink-0">Companies</h1>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Company
        </button>
      </div>

      {/* WebSocket status */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0',
          wsStatus === 'connected' ? 'bg-green-500' :
          wsStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
        )} />
        <span>
          {wsStatus === 'connected' ? `Live · ${getWsUrl()}` :
           wsStatus === 'connecting' ? `Connecting to ${getWsUrl()}…` :
           `Disconnected · ${getWsUrl()}`}
        </span>
        {wsLastMsg && <span className="text-green-600 font-medium">· {wsLastMsg}</span>}
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

      {/* Upload loading */}
      {isUploading && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Enriching signals for uploaded accounts...</p>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-700">No companies yet.</p>
            <p className="text-sm text-gray-500 mt-1">Click 'Add Company' to import your target list.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('company_name')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Company <SortIcon field="company_name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => handleSort('score')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Score <SortIcon field="score" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">
                  <button onClick={() => handleSort('employees')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    <Users className="w-3.5 h-3.5" />
                    People <SortIcon field="employees" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">
                  <button onClick={() => handleSort('lastUpdated')} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
                    Last Updated <SortIcon field="lastUpdated" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(account => (
                <tr
                  key={account.id}
                  className={cn('hover:bg-gray-50 transition-colors', selectedIds.has(account.id) && 'bg-gray-50')}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(account.id)}
                      onChange={() => toggleSelect(account.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/accounts/${account.id}`} className="flex items-center gap-3">
                      <AccountLogo domain={account.domain} name={account.company_name} />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{account.company_name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Globe className="w-3 h-3" />
                          {account.domain}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <ScoreRing score={account.score} tier={account.scoreLabel} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{account.employees > 0 ? account.employees.toLocaleString() : '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-500">{account.lastUpdated}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.preventDefault(); removeAccount(account.id); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete company"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Company</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <CsvUpload />
          </div>
        </div>
      )}
    </div>
  );
}
