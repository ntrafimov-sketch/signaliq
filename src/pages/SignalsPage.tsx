import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Zap, Calendar } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { SignalCategoryBadge, ConfidenceBadge } from '../components/SignalBadge';
import { useStore } from '../store/useStore';
import type { Signal } from '../types';

const signalTypeOptions = [
  { value: 'all', label: 'All types' },
  { value: 'Revenue', label: 'Revenue' },
  { value: 'Hiring', label: 'Hiring' },
  { value: 'Ad Spend', label: 'Ad Spend' },
  { value: 'Website', label: 'Website' },
  { value: 'Social', label: 'Social' },
  { value: 'Competitive', label: 'Competitive' },
  { value: 'Content', label: 'Content' },
  { value: 'Seasonality', label: 'Seasonality' },
];

const confidenceOptions = [
  { value: 'all', label: 'All confidence' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const impactOptions = [
  { value: 'all', label: 'All impact' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

export function SignalsPage() {
  const { accounts } = useStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [impactFilter, setImpactFilter] = useState('all');

  const allSignals: Signal[] = accounts.flatMap(a => a.signals);

  const filtered = allSignals.filter(s => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) && !s.accountName.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (confidenceFilter !== 'all' && s.confidence !== confidenceFilter) return false;
    if (impactFilter !== 'all' && s.impact !== impactFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Signals</h1>
        <p className="text-sm text-slate-500 mt-0.5">All buying signals detected across your target accounts.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Signals', value: allSignals.length, color: 'text-slate-900' },
          { label: 'High Confidence', value: allSignals.filter(s => s.confidence === 'High').length, color: 'text-green-700' },
          { label: 'High Impact', value: allSignals.filter(s => s.impact === 'High').length, color: 'text-red-600' },
          { label: 'This Week', value: allSignals.filter(s => new Date(s.date) >= new Date(Date.now() - 7 * 86400000)).length, color: 'text-indigo-600' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-slate-200 px-5 py-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            icon={<Search className="w-4 h-4" />}
            placeholder="Search signals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select options={signalTypeOptions} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="w-40" />
        <Select options={confidenceOptions} value={confidenceFilter} onChange={e => setConfidenceFilter(e.target.value)} className="w-40" />
        <Select options={impactOptions} value={impactFilter} onChange={e => setImpactFilter(e.target.value)} className="w-36" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Signal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Account</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No signals found
                </td>
              </tr>
            ) : filtered.map(signal => (
              <tr key={signal.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <SignalCategoryBadge category={signal.category} />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{signal.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{signal.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <Link
                    to={`/accounts/${signal.accountId}`}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    {signal.accountName}
                  </Link>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-sm text-slate-600">{signal.source}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(signal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBadge level={signal.confidence} label="" />
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBadge level={signal.impact} label="" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">Showing {filtered.length} of {allSignals.length} signals</p>
          </div>
        )}
      </div>
    </div>
  );
}
