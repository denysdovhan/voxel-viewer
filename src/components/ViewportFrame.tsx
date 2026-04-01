import type { ReactNode } from 'react';

interface ViewportFrameProps {
  title: string;
  subtitle?: string;
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  stage?: 'import' | 'viewer';
}

export function ViewportFrame({
  title,
  subtitle,
  status,
  actions,
  children,
  className,
  stage = 'viewer',
}: ViewportFrameProps) {
  return (
    <section
      className={[
        'relative h-full min-h-0 overflow-hidden bg-slate-950/80 rounded-none border-0 p-0',
        className ?? '',
      ].join(' ').trim()}
      data-stage={stage}
    >
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-slate-950/92 via-slate-950/68 to-transparent px-3 py-2">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle ? <p className="text-[11px] text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? (
            <div className="rounded border border-slate-700/80 bg-slate-950/75 px-2 py-1 text-[11px] text-slate-300">
              {status}
            </div>
          ) : null}
          {actions ? <div className="pointer-events-auto flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className="h-full min-h-0">{children}</div>
    </section>
  );
}
