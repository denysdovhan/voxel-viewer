import { FolderInput } from 'lucide-react';
import { useTranslation } from '../i18n';
import { Button } from './Button';

interface FolderPickerProps {
  directorySupported: boolean;
  onPickDirectory: () => void;
  busy?: boolean;
  detail?: string;
}

export function FolderPicker({
  directorySupported,
  onPickDirectory,
  busy,
  detail,
}: FolderPickerProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded border border-slate-800 bg-slate-950/70 p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">
          {t('folderPicker.title')}
        </h2>
        <p className="text-sm text-slate-400">
          {t('folderPicker.description')}
        </p>
        <p className="text-sm text-slate-500">{t('folderPicker.detail')}</p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
        {!directorySupported ? (
          <p className="text-xs text-amber-300">
            {t('folderPicker.unsupportedHint')}
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={onPickDirectory}
          disabled={busy || !directorySupported}
        >
          <FolderInput className="h-4 w-4" aria-hidden="true" />
          {directorySupported
            ? t('folderPicker.openSupported')
            : t('folderPicker.openUnsupported')}
        </Button>
      </div>
    </section>
  );
}
