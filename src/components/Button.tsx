import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'overlay';
  size?: 'md' | 'sm';
  block?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'border-slate-700 bg-slate-200 text-slate-950 hover:bg-white',
  ghost: 'border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900',
  overlay:
    'border-slate-700/80 bg-slate-950/75 text-slate-300 hover:bg-slate-900',
};

const SIZE_CLASSES: Record<NonNullable<ButtonProps['size']>, string> = {
  md: 'px-3 py-1.5 text-sm',
  sm: 'px-2 py-1 text-[11px]',
};

export function Button({
  variant = 'ghost',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded border transition [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' ? 'font-medium' : '',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        block ? 'w-full' : '',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
