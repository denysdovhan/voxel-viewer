import { FolderInput } from 'lucide-react';
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
        <h2 className="text-lg font-semibold text-slate-100">
          Open a scan folder
        </h2>
        <p className="text-sm text-slate-400">
          Choose a local export folder to load the scan into the viewer.
        </p>
        <p className="text-sm text-slate-500">
          The app builds the volume in-browser and opens linked axial, sagittal,
          coronal, and 3D views.
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
          <FolderInput className="h-4 w-4" aria-hidden="true" />
          {directorySupported ? 'Open folder' : 'Directory API unavailable'}
        </Button>
      </div>
    </section>
  );
}
