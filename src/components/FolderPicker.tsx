interface FolderPickerProps {
  directorySupported: boolean;
  onPickDirectory: () => void;
  onPickFiles: () => void;
  onReset?: () => void;
  busy?: boolean;
  detail?: string;
  unsupportedHint?: string;
  stage?: 'import' | 'viewer';
  className?: string;
}

export function FolderPicker({
  directorySupported,
  onPickDirectory,
  onPickFiles,
  onReset,
  busy,
  detail,
  unsupportedHint,
  stage = 'import',
  className,
}: FolderPickerProps) {
  const compact = stage === 'viewer';

  return (
    <section
      className={[
        'rounded border border-slate-800 bg-slate-950/70',
        compact ? 'p-3' : 'p-4',
        className ?? '',
      ].join(' ').trim()}
      data-stage={stage}
    >
      <div className="space-y-1">
        <h1 className={compact ? 'text-sm font-semibold text-slate-100' : 'text-lg font-semibold text-slate-100'}>
          Dental X-Ray Viewer
        </h1>
        <p className="text-sm text-slate-400">
          Open a GALILEOS scan folder locally. Browser parsing only.
        </p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
        {!directorySupported && unsupportedHint ? (
          <p className="text-xs text-amber-300">{unsupportedHint}</p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex items-center rounded border border-slate-700 bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onPickDirectory}
          disabled={busy || !directorySupported}
        >
          {directorySupported ? 'Open folder' : 'Directory API unavailable'}
        </button>
        <button
          type="button"
          className="inline-flex items-center rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onPickFiles}
          disabled={busy}
        >
          Use folder input
        </button>
        {onReset ? (
          <button
            type="button"
            className="inline-flex items-center rounded border border-slate-800 bg-transparent px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onReset}
            disabled={busy}
          >
            Reset
          </button>
        ) : null}
      </div>
    </section>
  );
}
