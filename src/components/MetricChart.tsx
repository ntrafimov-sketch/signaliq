import { useMemo } from 'react';

interface DataPoint {
  date: string;
  ios: number;
  android: number;
}

interface MetricChartProps {
  data: DataPoint[];
  type: 'revenue' | 'downloads';
  title: string;
}

function fmtValue(n: number, type: 'revenue' | 'downloads'): string {
  if (type === 'revenue') {
    return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000 ? `$${Math.round(n / 1_000)}K`
      : `$${Math.round(n)}`;
  }
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${Math.round(n / 1_000)}K`
    : String(Math.round(n));
}

function fmtDate(date: string): string {
  const [, month] = date.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(month) - 1] ?? date;
}

export function MetricChart({ data, type, title }: MetricChartProps) {
  const W = 560, H = 160;
  const padL = 52, padR = 12, padT = 12, padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const points = useMemo(() => data.map(d => ({
    ...d,
    total: d.ios + d.android,
  })), [data]);

  const maxVal = useMemo(() => Math.max(...points.map(p => p.total), 1), [points]);

  const xOf = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * plotW;
  const yOf = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const polyline = (vals: number[]) =>
    vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ');

  const areaPath = (vals: number[]) => {
    const top = vals.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' L ');
    return `M ${xOf(0)},${yOf(vals[0])} L ${top} L ${xOf(vals.length - 1)},${padT + plotH} L ${xOf(0)},${padT + plotH} Z`;
  };

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ val: maxVal * f, y: yOf(maxVal * f) }));

  // X-axis: show every 3rd label if many points
  const step = points.length > 12 ? Math.ceil(points.length / 8) : 1;
  const xLabels = points.filter((_, i) => i === 0 || i === points.length - 1 || i % step === 0);

  const iosColor = '#7c3aed';
  const androidColor = '#10b981';
  const totalColor = '#4f46e5';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: iosColor }} /> iOS
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: androidColor }} /> Android
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: totalColor }} /> Total
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        <defs>
          <linearGradient id={`grad-total-${type}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={totalColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={totalColor} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y grid lines */}
        {yTicks.map(t => (
          <g key={t.val}>
            <line x1={padL} y1={t.y} x2={W - padR} y2={t.y}
              stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={padL - 6} y={t.y + 3.5} textAnchor="end"
              fontSize="9" fill="#9ca3af" fontFamily="Plus Jakarta Sans, sans-serif">
              {fmtValue(t.val, type)}
            </text>
          </g>
        ))}

        {/* Total filled area */}
        <path d={areaPath(points.map(p => p.total))} fill={`url(#grad-total-${type})`} />

        {/* iOS area (lighter) */}
        <path d={areaPath(points.map(p => p.ios))}
          fill={iosColor} fillOpacity="0.06" />

        {/* Android line */}
        <polyline points={polyline(points.map(p => p.android))}
          fill="none" stroke={androidColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
          opacity="0.7" />

        {/* iOS line */}
        <polyline points={polyline(points.map(p => p.ios))}
          fill="none" stroke={iosColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"
          opacity="0.7" />

        {/* Total line */}
        <polyline points={polyline(points.map(p => p.total))}
          fill="none" stroke={totalColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Last point dot */}
        {points.length > 0 && (
          <circle
            cx={xOf(points.length - 1)}
            cy={yOf(points[points.length - 1].total)}
            r="3" fill={totalColor} stroke="white" strokeWidth="1.5" />
        )}

        {/* X-axis labels */}
        {xLabels.map((p, i) => {
          const idx = points.indexOf(p);
          return (
            <text key={i} x={xOf(idx)} y={H - 6} textAnchor="middle"
              fontSize="9" fill="#9ca3af" fontFamily="Plus Jakarta Sans, sans-serif">
              {fmtDate(p.date)}
            </text>
          );
        })}
      </svg>

      {/* Summary row */}
      <div className="bg-violet-50/60 rounded-xl px-4 py-2.5 flex items-center justify-between">
        <p className="text-xs text-gray-400 font-medium">Last month</p>
        <p className="text-sm font-bold" style={{ color: totalColor }}>
          {fmtValue(points[points.length - 1]?.total ?? 0, type)}
        </p>
      </div>
    </div>
  );
}
