import type { ViewerApp } from '../app/useViewerApp';
import logoUrl from '../assets/voxel-viewer-logo.svg';
import { Button } from '../components/Button';
import { FolderPicker } from '../components/FolderPicker';
import { ImportStatus, ImportStatusStage } from '../components/ImportStatus';
import { Notice } from '../components/Notice';
import { DISCLAIMER_TEXT } from '../constants';

const GITHUB_REPO_URL = 'https://github.com/denysdovhan/voxel-viewer';

interface ImportPageProps {
  app: ViewerApp;
}

export default function ImportPage({ app }: ImportPageProps) {
  if (app.busy) {
    return (
      <main className="h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 py-8">
          <div className="w-full space-y-4 rounded border border-slate-800 bg-slate-950/90 p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
              <div>
                <div className="text-sm font-medium text-slate-100">
                  Building viewer
                </div>
                <div className="text-xs text-slate-500">
                  {app.sourceLabel || 'Selected scan folder'}
                </div>
              </div>
            </div>
            <ImportStatus
              progress={app.progress}
              issue={app.issue}
              stage={ImportStatusStage.Import}
            />
            <Notice>{DISCLAIMER_TEXT}</Notice>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl items-start justify-center px-4 py-8">
        <div className="w-full space-y-3">
          <section className="rounded border border-slate-800 bg-slate-950/80 p-5">
            <div className="flex items-stretch justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  CBCT scan viewer
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
                  Voxel Viewer
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Inspect CBCT (Cone Beam Computed Tomography) scans directly in
                  the browser from local study folders. The viewer parses
                  supported exports locally and opens them as linked 2D slice
                  views with a 3D volume overview.
                </p>
                <Button
                  as="a"
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-4 w-4 text-slate-400"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  Star on GitHub
                </Button>
              </div>
              <div className="hidden w-28 shrink-0 self-stretch p-4 md:flex md:w-36 lg:w-40">
                <img
                  src={logoUrl}
                  alt="Voxel Viewer cube logo"
                  className="h-full w-full select-none object-contain object-right opacity-95"
                />
              </div>
            </div>
          </section>

          <FolderPicker
            directorySupported={app.directorySupported}
            onPickDirectory={() => void app.openDirectory()}
            busy={app.busy}
            detail={app.sourceLabel ? `Source: ${app.sourceLabel}` : undefined}
            unsupportedHint="Folder selection needs a browser with directory upload support. Safari on iPhone requires iOS 18.4+."
          />

          <Notice>{DISCLAIMER_TEXT}</Notice>

          <section className="rounded border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Supported folders
            </div>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              <div>
                <div className="font-medium text-slate-100">GALILEOS</div>
                <div className="mt-1 text-slate-400">
                  Legacy GALILEOS study volumes stored as compressed slice
                  files.
                </div>
                <div className="mt-1">
                  Select the study folder that contains{' '}
                  <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.9em] text-slate-200">
                    *_vol_0
                  </code>{' '}
                  and{' '}
                  <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.9em] text-slate-200">
                    *_vol_0_###
                  </code>
                  .
                </div>
              </div>
              <div>
                <div className="font-medium text-slate-100">OneVolume CT</div>
                <div className="mt-1 text-slate-400">
                  Native OneVolume volume stored in{' '}
                  <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.9em] text-slate-200">
                    CT_0.vol
                  </code>
                  .
                </div>
                <div className="mt-1">
                  Select the{' '}
                  <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.9em] text-slate-200">
                    CT_*
                  </code>{' '}
                  folder, or the export root if you want the app to auto-detect
                  the nested CT study folder.
                </div>
              </div>
              <div>
                <div className="font-medium text-slate-100">DICOM CT</div>
                <div className="mt-1 text-slate-400">
                  Standard DICOM slice stacks exported from compatible CT
                  software.
                </div>
                <div className="mt-1">
                  Select the folder that contains the{' '}
                  <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.9em] text-slate-200">
                    .dcm
                  </code>{' '}
                  slices, usually{' '}
                  <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.9em] text-slate-200">
                    DICOM/
                  </code>
                  .
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.95em] text-slate-400">
                Series_01/
              </code>{' '}
              is reference material only and is not imported.
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
