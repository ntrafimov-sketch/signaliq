import { BarChart2, TrendingUp, Users, Zap, Target, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { useStore } from '../store/useStore';

export function ReportsPage() {
  const { accounts } = useStore();

  const totalSignals = accounts.flatMap(a => a.signals).length;
  const hotAccounts = accounts.filter(a => a.scoreLabel === 'Hot').length;
  const warmAccounts = accounts.filter(a => a.scoreLabel === 'Warm').length;
  const coldAccounts = accounts.filter(a => a.scoreLabel === 'Cold').length;
  const avgScore = accounts.length ? Math.round(accounts.reduce((s, a) => s + a.score, 0) / accounts.length) : 0;

  const industries = [...new Set(accounts.map(a => a.industry))];
  const industryData = industries.map(ind => ({
    name: ind,
    count: accounts.filter(a => a.industry === ind).length,
    avgScore: Math.round(
      accounts.filter(a => a.industry === ind).reduce((s, a) => s + a.score, 0) /
      (accounts.filter(a => a.industry === ind).length || 1)
    ),
  })).sort((a, b) => b.avgScore - a.avgScore);

  const allSignals = accounts.flatMap(a => a.signals);
  const signalCategories = [...new Set(allSignals.map(s => s.category))];
  const signalCategoryData = signalCategories.map(cat => ({
    name: cat,
    count: allSignals.filter(s => s.category === cat).length,
  })).sort((a, b) => b.count - a.count);

  const topAccounts = [...accounts].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Analytics and performance insights across your account pipeline.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Total Accounts', value: accounts.length, color: 'text-slate-900', bg: 'bg-slate-100', iconColor: 'text-slate-600' },
          { icon: Zap, label: 'Total Signals', value: totalSignals, color: 'text-amber-700', bg: 'bg-amber-100', iconColor: 'text-amber-600' },
          { icon: Target, label: 'Avg Score', value: `${avgScore}/100`, color: 'text-indigo-700', bg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
          { icon: TrendingUp, label: 'Hot Accounts', value: hotAccounts, color: 'text-red-700', bg: 'bg-red-100', iconColor: 'text-red-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent>
              <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4.5 h-4.5 ${stat.iconColor}`} />
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Score distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Score Distribution</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Hot', count: hotAccounts, total: accounts.length, color: 'bg-red-400' },
                { label: 'Warm', count: warmAccounts, total: accounts.length, color: 'bg-orange-400' },
                { label: 'Cold', count: coldAccounts, total: accounts.length, color: 'bg-blue-400' },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <span className="text-sm font-medium text-slate-800">{item.count} accounts ({accounts.length ? Math.round(item.count / accounts.length * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${item.color}`}
                      style={{ width: accounts.length ? `${(item.count / accounts.length) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Signals by category */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Signals by Category</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {signalCategoryData.map(item => (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600">{item.name}</span>
                    <span className="text-sm font-medium text-slate-800">{item.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-400"
                      style={{ width: totalSignals ? `${(item.count / totalSignals) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top accounts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Top Accounts by Score</h2>
            </div>
          </CardHeader>
          <div className="divide-y divide-slate-100">
            {topAccounts.map((account, i) => (
              <div key={account.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-400 w-4">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{account.company_name}</p>
                    <p className="text-xs text-slate-400">{account.industry}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{account.score}</p>
                    <p className="text-xs text-slate-400">{account.signals.length} signals</p>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Industry breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-sm">Industry Breakdown</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {industryData.map(item => (
                <div key={item.name} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.count} accounts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{item.avgScore}</p>
                    <p className="text-xs text-slate-400">avg score</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
