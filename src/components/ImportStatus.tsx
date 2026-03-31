import type { ImportIssue, ImportProgress } from '../types';

interface ImportStatusProps {
  progress: ImportProgress;
  issue?: ImportIssue | null;
  stage?: 'import' | 'viewer';
  className?: string;
}

function resolveProgressPercent(progress: ImportProgress): number {
  const local = progress.total > 0 ? progress.completed / progress.total : 0;

  switch (progress.stage) {
    case 'idle':
      return 0;
    case 'scanning':
      return 4 + local * 4;
    case 'parsing-meta':
      return 8 + local * 10;
    case 'assembling':
      return 18 + local * 8;
    case 'inflating-slices':
      return 26 + local * 54;
    case 'preparing-panorama':
      return 80 + local * 12;
    case 'preparing-3d':
      return 92 + local * 6;
    case 'ready':
      return 100;
    case 'error':
      return Math.max(8, Math.min(99, local * 100));
    default:
      return local * 100;
  }
}

export function ImportStatus({ progress, issue, stage = 'import', className }: ImportStatusProps) {
  const pct = Math.round(resolveProgressPercent(progress));

  return (
    <div
      className={[
        'rounded border border-slate-800 bg-slate-950/70 p-3',
        stage === 'viewer' ? 'text-xs' : '',
        className ?? '',
      ].join(' ').trim()}
      data-stage={stage}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="truncate text-sm font-medium text-slate-100">{progress.detail}</strong>
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">
          {progress.stage}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-sky-400 transition-[width]"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <span className="text-xs text-slate-500">
          {progress.completed}/{progress.total || 0}
        </span>
        {issue ? <span className="text-right text-xs text-amber-300">{issue.message}</span> : null}
      </div>
    </div>
  );
}
