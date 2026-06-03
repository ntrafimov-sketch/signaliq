import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'hot' | 'warm' | 'cold' | 'high' | 'medium' | 'low' | 'default' | 'outline';
  className?: string;
}

const variantClasses: Record<string, string> = {
  hot: 'bg-red-100 text-red-700 border border-red-200',
  warm: 'bg-orange-100 text-orange-700 border border-orange-200',
  cold: 'bg-blue-100 text-blue-700 border border-blue-200',
  high: 'bg-green-100 text-green-700 border border-green-200',
  medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  low: 'bg-slate-100 text-slate-600 border border-slate-200',
  default: 'bg-slate-100 text-slate-700 border border-slate-200',
  outline: 'bg-white text-slate-700 border border-slate-300',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
