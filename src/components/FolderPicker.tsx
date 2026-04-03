import { Button } from './Button';

interface FolderPickerProps {
  directorySupported: boolean;
  onPickDirectory: () => void;
  busy?: boolean;
  detail?: string;
  unsupportedHint?: string;
}

export function FolderPicker({
  directorySupported,
  onPickDirectory,
  busy,
  detail,
  unsupportedHint,
}: FolderPickerProps) {
  return (
    <section className="rounded border border-slate-800 bg-slate-950/70 p-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-slate-100">Voxel Viewer</h1>
        <p className="text-sm text-slate-400">
          Open a supported CT study folder locally. Browser parsing only.
        </p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
        {!directorySupported && unsupportedHint ? (
          <p className="text-xs text-amber-300">{unsupportedHint}</p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={onPickDirectory}
          disabled={busy || !directorySupported}
        >
          {directorySupported ? 'Open folder' : 'Directory API unavailable'}
        </Button>
      </div>
    </section>
  );
}
