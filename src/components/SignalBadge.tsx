import { cn } from '../lib/utils';
import type { Signal } from '../types';

const categoryColors: Record<Signal['category'], { bg: string; text: string; border: string }> = {
  Revenue: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Downloads: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  Hiring: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Seasonality: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'Ad Spend': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Website: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  Social: { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
  Competitive: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  Content: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

interface SignalBadgeProps {
  category: Signal['category'];
  className?: string;
}

export function SignalCategoryBadge({ category, className }: SignalBadgeProps) {
  const colors = categoryColors[category] || categoryColors.Website;
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {category}
    </span>
  );
}

interface ConfidenceBadgeProps {
  level: 'High' | 'Medium' | 'Low';
  label?: string;
  className?: string;
}

const confidenceColors = {
  High: 'bg-green-50 text-green-700 border-green-200',
  Medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Low: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function ConfidenceBadge({ level, label = 'Confidence', className }: ConfidenceBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
      confidenceColors[level],
      className
    )}>
      {label}: {level}
    </span>
  );
}
