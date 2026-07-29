import { useState } from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps {
  name: string;
  email?: string;
  linkedin?: string;
  photoUrl?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-2xl',
};


function linkedinUsername(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? m[1] : null;
}

export function Avatar({ name, email, linkedin, photoUrl, color, size = 'md', className }: AvatarProps) {
  const liUsername = linkedinUsername(linkedin);
  const srcs = [
    photoUrl || null,
    liUsername ? `https://unavatar.io/linkedin/${liUsername}?fallback=404` : null,
    email ? `https://unavatar.io/${encodeURIComponent(email)}?fallback=404` : null,
  ].filter(Boolean) as string[];

  const [stage, setStage] = useState(0);
  const initial = name.charAt(0).toUpperCase();
  const bgColor = color || generateColor(name);

  if (stage < srcs.length) {
    return (
      <img
        src={srcs[stage]}
        alt={name}
        onError={() => setStage(s => s + 1)}
        className={cn('rounded-xl object-cover flex-shrink-0', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      {initial}
    </div>
  );
}

function generateColor(name: string): string {
  const colors = [
    '#7C3AED', '#0891B2', '#059669', '#D97706', '#DC2626',
    '#DB2777', '#2563EB', '#9333EA', '#0D9488', '#C2410C',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
