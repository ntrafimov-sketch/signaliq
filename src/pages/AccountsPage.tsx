import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Globe, Users, ChevronUp, ChevronDown,
  CheckCircle2, Loader2, Plus, Trash2, Sparkles, Copy, ExternalLink, ImagePlus, X
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
  const [stage, setStage] = useState(0);
  const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  const srcs = [
    `https://logo.brandfetch.io/${cleanDomain}/icon`,
    `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`,
  ];
  if (stage < srcs.length) {
    return (
      <img
        src={srcs[stage]}
        alt={name}
        onError={() => setStage(s => s + 1)}
        className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 p-0.5"
      />
    );
  }
  return <Avatar name={name} size="sm" />;
}

const BRIDGE = 'http://localhost:7337';

function AddCompanyModal({ onClose, onResearching }: { onClose: () => void; onResearching: (company: string, domain: string, paywallPreview?: string) => void }) {
  const [tab, setTab] = useState<'ai' | 'csv'>('ai');
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const [form, setForm] = useState({ company: '', app_name: '', domain: '', linkedin: '' });
  const [status, setStatus] = useState<'idle' | 'launching' | 'done' | 'copied'>('idle');
  const [image, setImage] = useState<{ b64: string; preview: string; name: string } | null>(null);
  const [paywallImage, setPaywallImage] = useState<{ b64: string; preview: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paywallFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(1500) })
      .then(r => r.ok ? setBridgeOk(true) : setBridgeOk(false))
      .catch(() => setBridgeOk(false));
  }, []);

  const buildPrompt = () => {
    const parts = [];
    if (form.company) parts.push(`Company: ${form.company}`);
    if (form.domain) parts.push(`Domain: ${form.domain}`);
    if (form.app_name) parts.push(`App: ${form.app_name}`);
    if (form.linkedin) parts.push(`LinkedIn: ${form.linkedin}`);
    return 'Research account — ' + parts.join(', ');
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(',')[1];
      setImage({ b64, preview: result, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handlePaywallImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.split(',')[1];
      setPaywallImage({ b64, preview: result, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const handleLaunch = async () => {
    setStatus('launching');
    if (bridgeOk) {
      try {
        const res = await fetch(`${BRIDGE}/trigger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, image_b64: image?.b64 ?? null, paywall_image_b64: paywallImage?.b64 ?? null }),
        });
        if (res.ok) {
          setStatus('done');
          onResearching(form.company, form.domain, paywallImage?.preview);
          setTimeout(onClose, 1500);
        } else throw new Error();
      } catch {
        setBridgeOk(false);
        setStatus('idle');
      }
    } else {
      navigator.clipboard.writeText(buildPrompt()).catch(() => {});
      setStatus('copied');
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, required = false) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">
        {label}{required && <span className="text-violet-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Add Company</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border border-gray-200 rounded-xl overflow-hidden mb-5">
          {([['ai', 'AI Research'], ['csv', 'CSV Import']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-1 py-2 text-sm font-semibold transition-colors',
                tab === t ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-violet-50')}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'csv' && <CsvUpload />}

        {tab === 'ai' && (
          <div className="space-y-4">
            {/* Bridge status */}
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border',
              bridgeOk === true ? 'bg-green-50 border-green-100 text-green-700'
              : bridgeOk === false ? 'bg-amber-50 border-amber-100 text-amber-700'
              : 'bg-gray-50 border-gray-100 text-gray-400')}>
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0',
                bridgeOk === true ? 'bg-green-500' : bridgeOk === false ? 'bg-amber-400' : 'bg-gray-300 animate-pulse')} />
              {bridgeOk === true ? 'Bridge connected — will launch directly in Claude Desktop'
                : bridgeOk === false ? 'Bridge offline — will copy prompt to clipboard instead'
                : 'Checking bridge…'}
              {bridgeOk === false && (
                <a href="https://github.com" className="ml-auto flex items-center gap-1 text-amber-600 hover:underline">
                  <ExternalLink className="w-3 h-3" /> run bridge.py
                </a>
              )}
            </div>

            {field('company', 'Company Name', 'e.g. Endel', true)}
            {field('app_name', 'App Name', 'e.g. Endel: Sleep & Focus Music')}
            {field('domain', 'Company Domain', 'e.g. endel.io')}
            {field('linkedin', 'LinkedIn URL', 'e.g. linkedin.com/company/endel')}

            {/* Image upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Screenshot <span className="text-gray-400 font-normal">(optional — App Store, LinkedIn, etc.)</span>
              </label>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
              {image ? (
                <div className="flex items-center gap-3 p-2 border border-violet-200 rounded-xl bg-violet-50/50">
                  <img src={image.preview} alt="preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <p className="text-xs text-gray-600 flex-1 truncate">{image.name}</p>
                  <button onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/30 transition-all">
                  <ImagePlus className="w-4 h-4" />
                  Attach screenshot
                </button>
              )}
            </div>

            {/* Paywall image upload */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Paywall Screenshot <span className="text-gray-400 font-normal">(optional — will be saved and displayed in the account)</span>
              </label>
              <input ref={paywallFileInputRef} type="file" accept="image/*" onChange={handlePaywallImage} className="hidden" />
              {paywallImage ? (
                <div className="flex items-center gap-3 p-2 border border-violet-200 rounded-xl bg-violet-50/50">
                  <img src={paywallImage.preview} alt="paywall preview" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  <p className="text-xs text-gray-600 flex-1 truncate">{paywallImage.name}</p>
                  <button onClick={() => { setPaywallImage(null); if (paywallFileInputRef.current) paywallFileInputRef.current.value = ''; }}
                    className="text-gray-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => paywallFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/30 transition-all">
                  <ImagePlus className="w-4 h-4" />
                  Attach paywall screenshot
                </button>
              )}
            </div>

            <button
              onClick={handleLaunch}
              disabled={!form.company || status === 'launching' || status === 'done'}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                status === 'done' ? 'bg-green-500 text-white'
                  : status === 'copied' ? 'bg-violet-100 text-violet-700'
                  : 'bg-gradient-to-br from-violet-600 to-violet-700 text-white hover:from-violet-700 hover:to-violet-800 disabled:opacity-40'
              )}>
              {status === 'launching' && <Loader2 className="w-4 h-4 animate-spin" />}
              {status === 'done' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'copied' && <Copy className="w-4 h-4" />}
              {status === 'idle' && <Sparkles className="w-4 h-4" />}
              {status === 'done' ? 'Agent launched in Claude Desktop ✓'
                : status === 'copied' ? 'Prompt copied — paste in Claude Desktop'
                : status === 'launching' ? 'Launching…'
                : bridgeOk ? 'Launch Research'
                : 'Copy Prompt'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AccountsPage() {
  const { accounts, isUploading, uploadSuccess, setUploadSuccess, updateAccount, addAccounts, removeAccount, profile } = useStore();
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [wsLastMsg, setWsLastMsg] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);

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
    const normalizeDomain = (d: string | undefined | null) =>
      (d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

    const disconnect = connectWebhookListener((accountId, companyName, torpedoData) => {
      try {
        const current = accountsRef.current;
        const account = current.find(a => {
          try {
            return a.id === accountId ||
              normalizeDomain(a.domain) === normalizeDomain(accountId) ||
              (a.company_name || '').toLowerCase().trim() === (companyName || '').toLowerCase().trim();
          } catch { return false; }
        });
        const baseId = account ? account.id : `webhook-${Date.now()}`;
        const baseName = account ? account.company_name : companyName;

        console.log('[webhook] torpedoData type:', typeof torpedoData, Array.isArray(torpedoData));
        // Clay sometimes sends an object instead of array — wrap it
        // Clay sometimes sends data as a stringified JSON string — parse it
        let parsed = torpedoData;
        if (typeof torpedoData === 'string') {
          try { parsed = JSON.parse(torpedoData); } catch { parsed = []; }
        }
        const safeData: unknown[] = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object'
          ? Object.values(parsed as Record<string, unknown>)
          : [];
        const updates = importTorpedoJson(safeData as Parameters<typeof importTorpedoJson>[0], baseId, baseName);
        const entryTypes = (safeData as {type?:string}[]).map((e: {type?:string}) => e?.type);
        console.log('[webhook] raw torpedoData type:', typeof torpedoData, Array.isArray(torpedoData));
        console.log('[webhook] parsed entry types:', entryTypes);
        console.log('[webhook] updates keys with data:', Object.entries(updates).filter(([,v]) => v !== undefined).map(([k]) => k));

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
            lastUpdated: new Date().toISOString(),
            addedAt: new Date().toISOString(),
            addedBy: useStore.getState().profile.name,
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
            revenueHistory: updates.revenueHistory,
            downloadHistory: updates.downloadHistory,
            news: updates.news,
            products: updates.products,
            orgChart: updates.orgChart,
            investmentHistory: updates.investmentHistory,
            paywallAnalysis: updates.paywallAnalysis,
            paywallScreenshot: updates.paywallScreenshot,
            departmentIntel: updates.departmentIntel,
            torpedoData: updates.torpedoData,
          };
          console.log('[webhook] creating new account', newAccount.company_name, newAccount.id);
          addAccounts([newAccount]);
        } else {
          console.log('[webhook] updating existing account', account.company_name,
            'orgChart:', !!updates.orgChart, 'news:', updates.news?.length,
            'people:', updates.people?.length, 'signals:', updates.signals?.length);
          updateAccount(account.id, { ...updates, lastUpdated: new Date().toISOString() });
        }
      } catch (err) {
        console.error('[webhook] handler error', err);
        setWebhookError(`Failed to process ${companyName}: ${err instanceof Error ? err.message : String(err)}`);
        setTimeout(() => setWebhookError(null), 8000);
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
        {webhookError && <span className="text-red-500 font-medium">· ⚠ {webhookError}</span>}
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
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm shadow-violet-50 p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Enriching signals for uploaded accounts...</p>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm shadow-violet-50 flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-gray-400" />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-700">No companies yet.</p>
            <p className="text-sm text-gray-500 mt-1">Click 'Add Company' to import your target list.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-violet-100 shadow-sm shadow-violet-50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-violet-100 bg-violet-50/40">
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
                    Added <SortIcon field="lastUpdated" />
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
                    {account.enrichmentStatus === 'enriching' ? (
                      <div className="flex items-center gap-2 text-violet-600">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        <span className="text-xs font-semibold">Researching…</span>
                      </div>
                    ) : (
                      <ScoreRing score={account.score} tier={account.scoreLabel} />
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span>{account.employees > 0 ? account.employees.toLocaleString() : '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm text-gray-500">
                        {account.addedAt
                          ? new Date(account.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : account.lastUpdated}
                      </span>
                      <span className="text-xs text-gray-400">
                        by {(account.addedBy || profile.name).split(' ')[0]}
                      </span>
                    </div>
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
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onResearching={(company, domain, paywallPreview) => {
            const id = `researching-${Date.now()}`;
            addAccounts([{
              id,
              company_name: company,
              domain: domain || '',
              industry: '',
              country: '',
              employees: 0,
              score: 0,
              scoreLabel: 'Cold',
              signals: [],
              lastUpdated: new Date().toISOString(),
              addedAt: new Date().toISOString(),
              addedBy: useStore.getState().profile.name,
              description: '',
              founded: '',
              hq: '',
              revenue: '',
              status: '',
              logoColor: '#7c3aed',
              enrichmentStatus: 'enriching',
              paywallScreenshot: paywallPreview,
            }]);
          }}
        />
      )}
    </div>
  );
}
