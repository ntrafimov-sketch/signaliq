import { cn } from '../../lib/utils';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<string, string> = {
  primary: 'bg-gradient-to-br from-violet-600 to-violet-700 text-white hover:from-violet-700 hover:to-violet-800 border border-violet-700 shadow-sm shadow-violet-200',
  secondary: 'bg-white text-gray-700 hover:bg-violet-50 border border-gray-200 hover:border-violet-200',
  ghost: 'bg-transparent text-gray-600 hover:text-violet-700 hover:bg-violet-50 border border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 border border-red-600',
  outline: 'bg-white text-violet-700 hover:bg-violet-50 border border-violet-300',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-xl',
  lg: 'px-5 py-2.5 text-sm rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-2 font-semibold transition-all cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
