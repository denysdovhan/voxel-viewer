import { useTranslation } from '../i18n';
import { type ImportIssue, type ImportProgress, ImportStage } from '../types';
import { cn } from '../utils/cn';

export enum ImportStatusStage {
  Import = 'import',
  Viewer = 'viewer',
}

interface ImportStatusProps {
  progress: ImportProgress;
  issue?: ImportIssue | null;
  stage?: ImportStatusStage;
}

function resolveProgressPercent(progress: ImportProgress): number {
  const local = progress.total > 0 ? progress.completed / progress.total : 0;

  switch (progress.stage) {
    case ImportStage.Idle:
      return 0;
    case ImportStage.Scanning:
      return 4 + local * 4;
    case ImportStage.ParsingMeta:
      return 8 + local * 10;
    case ImportStage.Assembling:
      return 18 + local * 8;
    case ImportStage.InflatingSlices:
      return 26 + local * 54;
    case ImportStage.Preparing3D:
      return 80 + local * 20;
    case ImportStage.Ready:
      return 100;
    case ImportStage.Error:
      return Math.max(8, Math.min(99, local * 100));
    default:
      return local * 100;
  }
}

export function ImportStatus({
  progress,
  issue,
  stage = ImportStatusStage.Import,
}: ImportStatusProps) {
  const { t } = useTranslation();
  const pct = Math.round(resolveProgressPercent(progress));
  const detail = t(progress.detailKey, progress.detailValues);
  const issueText = issue?.message;
  const stageLabelKey: Record<ImportStage, string> = {
    [ImportStage.Idle]: 'importStatus.stages.idle',
    [ImportStage.Scanning]: 'importStatus.stages.scanning',
    [ImportStage.ParsingMeta]: 'importStatus.stages.parsingMeta',
    [ImportStage.InflatingSlices]: 'importStatus.stages.inflatingSlices',
    [ImportStage.Assembling]: 'importStatus.stages.assembling',
    [ImportStage.Preparing3D]: 'importStatus.stages.preparing3D',
    [ImportStage.Ready]: 'importStatus.stages.ready',
    [ImportStage.Error]: 'importStatus.stages.error',
  };

  return (
    <div
      className={cn(
        'rounded border border-slate-800 bg-slate-950/70 p-3',
        stage === ImportStatusStage.Viewer ? 'text-xs' : '',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="truncate text-sm font-medium text-slate-100">
          {detail}
        </strong>
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-slate-500">
          {t(stageLabelKey[progress.stage])}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"
        aria-hidden="true"
      >
        <span
          className="block h-full rounded-full bg-sky-400 transition-[width]"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <span className="text-xs text-slate-500">
          {progress.completed}/{progress.total || 0}
        </span>
        {issueText ? (
          <span className="text-right text-xs text-amber-300">{issueText}</span>
        ) : null}
      </div>
    </div>
  );
}
