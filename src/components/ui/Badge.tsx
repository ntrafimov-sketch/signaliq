import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'hot' | 'warm' | 'cold' | 'high' | 'medium' | 'low' | 'default' | 'outline';
  className?: string;
}

const variantClasses: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 border border-red-200',
  warm: 'bg-orange-100 text-orange-700 border border-orange-200',
  cold: 'bg-sky-100 text-sky-700 border border-sky-200',
  high: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  medium: 'bg-amber-100 text-amber-700 border border-amber-200',
  low: 'bg-violet-50 text-violet-500 border border-violet-100',
  default: 'bg-violet-50 text-violet-700 border border-violet-100',
  outline: 'bg-white text-gray-600 border border-gray-200',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
