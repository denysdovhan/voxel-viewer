import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '../utils/cn';

const VARIANT_CLASSES = {
  primary: 'border-slate-700 bg-slate-200 text-slate-950 hover:bg-white',
  ghost: 'border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900',
  overlay:
    'border-slate-700/80 bg-slate-950/75 text-slate-300 hover:bg-slate-900',
} as const;

const SIZE_CLASSES = {
  md: 'px-3 py-1.5 text-sm',
  sm: 'px-2 py-1 text-[11px]',
} as const;

type ButtonOwnProps = {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  block?: boolean;
  children: ReactNode;
};

export type ButtonProps<T extends ElementType = 'button'> = ButtonOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | 'as'>;

type ResolvedButtonProps = ButtonProps<ElementType>;

export function Button<T extends ElementType = 'button'>(
  buttonProps: ButtonProps<T>,
) {
  const {
    as: Component = 'button',
    variant = 'ghost',
    size = 'md',
    block = false,
    className,
    children,
    ...props
  } = buttonProps as ResolvedButtonProps;

  const classes = cn(
    'inline-flex items-center justify-center gap-1.5 rounded border transition [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'primary' ? 'font-medium' : '',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    block ? 'w-full' : '',
    className,
  );

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
