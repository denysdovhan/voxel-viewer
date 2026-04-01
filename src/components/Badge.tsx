import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'overlay';
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'border-slate-700/80 bg-slate-950/75 text-[11px] text-slate-300',
  overlay:
    'border-transparent bg-slate-950/45 text-[10px] uppercase tracking-[0.16em] text-slate-300 backdrop-blur-[1px]',
};

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        'rounded border px-2 py-1',
        variant === 'overlay' ? 'px-1.5 py-0.5' : '',
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
