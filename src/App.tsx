import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  FolderPicker,
  ImportStatus,
  PanoramaDisplay,
  SliceCanvas,
  ViewportFrame,
  VolumeViewport3D,
} from './components';
import { loadVolumeFromFolder } from './lib/import/load-volume';
import { fromDirectoryHandle, fromFileList } from './lib/import/scan-folder';
import {
  buildPanoramaImage,
  clamp,
  extractAxialImage,
  extractCoronalImage,
  extractSagittalImage,
  prepareVolumeFor3D,
} from './lib/volume';
import type {
  ImportIssue,
  ImportProgress,
  LoadedVolume,
  PanoramaMeta,
  ScanFolderSource,
  SliceImage,
  SliceWindowLevel,
  VolumeCursor,
} from './types';

const IDLE_PROGRESS: ImportProgress = {
  stage: 'idle',
  detail: 'Select a GALILEOS folder to begin',
  completed: 0,
  total: 1,
};

const EMPTY_SLICES: {
  axial: SliceImage | null;
  coronal: SliceImage | null;
  sagittal: SliceImage | null;
} = {
  axial: null,
  coronal: null,
  sagittal: null,
};

const DEFAULT_WINDOW_LEVEL: SliceWindowLevel = {
  window: 3200,
  level: 1600,
};

const WINDOW_MIN = 256;
const WINDOW_MAX = 4095;
const LEVEL_MIN = 0;
const LEVEL_MAX = 4095;

const PRIMARY_BUTTON =
  'inline-flex items-center rounded border border-slate-700 bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON =
  'inline-flex items-center rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50';
const GHOST_BUTTON =
  'inline-flex items-center rounded border border-slate-800 bg-transparent px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isBusy(progress: ImportProgress): boolean {
  return !['idle', 'ready', 'error'].includes(progress.stage);
}

function makeImportIssue(error: unknown): ImportIssue {
  if (error && typeof error === 'object') {
    const value = error as { code?: unknown; name?: unknown; message?: unknown };
    if (typeof value.message === 'string') {
      return {
        code:
          typeof value.code === 'string'
            ? value.code
            : typeof value.name === 'string'
              ? value.name
              : 'E_IMPORT',
        message: value.message,
      };
    }
  }

  return {
    code: 'E_IMPORT',
    message: 'Failed to load the selected scan folder.',
  };
}

function createCenterCursor(volume: LoadedVolume): VolumeCursor {
  const [x, y, z] = volume.meta.dimensions;
  return {
    x: Math.floor(x / 2),
    y: Math.floor(y / 2),
    z: Math.floor(z / 2),
  };
}

function formatSpacing(spacing: [number, number, number]): string {
  return spacing.map((value) => value.toFixed(2)).join(' x ');
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(IDLE_PROGRESS);
  const [issue, setIssue] = useState<ImportIssue | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [volume, setVolume] = useState<LoadedVolume | null>(null);
  const [cursor, setCursor] = useState<VolumeCursor | null>(null);
  const [windowLevel, setWindowLevel] = useState<SliceWindowLevel>(DEFAULT_WINDOW_LEVEL);
  const [panoramaEnabled, setPanoramaEnabled] = useState(false);
  const [downsampled3D, setDownsampled3D] = useState(false);
  const [panoramaMeta, setPanoramaMeta] = useState<PanoramaMeta | null>(null);
  const directorySupported =
    typeof window !== 'undefined' &&
    typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
  const deferredCursor = useDeferredValue(cursor);
  const deferredWindow = useDeferredValue(windowLevel.window);
  const deferredLevel = useDeferredValue(windowLevel.level);
  const deferredVolumeFor3D = useDeferredValue(volume);
  const busy = isBusy(progress);
  const stage = volume ? 'viewer' : 'import';

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;
  }, []);

  const resetViewer = useEffectEvent(() => {
    setIssue(null);
    setSourceLabel('');
    setVolume(null);
    setCursor(null);
    setWindowLevel(DEFAULT_WINDOW_LEVEL);
    setPanoramaEnabled(false);
    setPanoramaMeta(null);
    setDownsampled3D(false);
    setProgress(IDLE_PROGRESS);
  });

  const loadSource = useEffectEvent(async (source: ScanFolderSource) => {
    resetViewer();
    setSourceLabel(source.label);
    setProgress({
      stage: 'scanning',
      detail: `Scanning ${source.label}`,
      completed: 0,
      total: 1,
    });

    try {
      const loaded = await loadVolumeFromFolder(source, setProgress);
      setIssue(null);
      setVolume(loaded.volume);
      setPanoramaMeta(loaded.panorama ?? null);
      setCursor(createCenterCursor(loaded.volume));
      setProgress({
        stage: 'ready',
        detail: `Loaded ${loaded.meta.scanId}`,
        completed: loaded.meta.sliceCount,
        total: loaded.meta.sliceCount,
      });
    } catch (error) {
      if (isAbortError(error)) return;

      setIssue(makeImportIssue(error));
      setProgress({
        stage: 'error',
        detail: 'Import failed',
        completed: 0,
        total: 1,
      });
    }
  });

  const slices = useMemo(() => {
    if (!volume || !deferredCursor) return EMPTY_SLICES;

    const effectiveWindowLevel = {
      window: deferredWindow,
      level: deferredLevel,
    };

    return {
      axial: extractAxialImage(volume, deferredCursor, effectiveWindowLevel),
      coronal: extractCoronalImage(volume, deferredCursor, effectiveWindowLevel),
      sagittal: extractSagittalImage(volume, deferredCursor, effectiveWindowLevel),
    };
  }, [deferredCursor, deferredLevel, deferredWindow, volume]);

  const panoramaImage = useMemo(() => {
    if (!panoramaEnabled || !volume) return null;
    return buildPanoramaImage(volume, panoramaMeta);
  }, [panoramaEnabled, panoramaMeta, volume]);

  const prepared3D = useMemo(() => {
    if (!deferredVolumeFor3D) return null;
    return prepareVolumeFor3D(deferredVolumeFor3D);
  }, [deferredVolumeFor3D]);

  const dimensions = volume?.meta.dimensions ?? [0, 0, 0];
  const spacing = volume?.meta.spacing ?? [0, 0, 0];

  const openDirectory = async () => {
    const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
    if (!picker) return;

    try {
      const handle = await picker();
      const source = await fromDirectoryHandle(handle);
      await loadSource(source);
    } catch (error) {
      if (!isAbortError(error)) {
        setIssue(makeImportIssue(error));
      }
    }
  };

  const openFallbackInput = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;

    await loadSource(fromFileList(files));
  };

  const updateCursor = (axis: 'axial' | 'coronal' | 'sagittal') =>
    ({ xRatio, yRatio }: { xRatio: number; yRatio: number }) => {
      if (!volume) return;

      setCursor((current) => {
        if (!current) return current;

        const [width, height, depth] = volume.meta.dimensions;
        if (axis === 'axial') {
          return {
            x: clamp(Math.round(xRatio * (width - 1)), 0, width - 1),
            y: clamp(Math.round(yRatio * (height - 1)), 0, height - 1),
            z: current.z,
          };
        }

        if (axis === 'coronal') {
          return {
            x: clamp(Math.round(xRatio * (width - 1)), 0, width - 1),
            y: current.y,
            z: clamp(Math.round((1 - yRatio) * (depth - 1)), 0, depth - 1),
          };
        }

        return {
          x: current.x,
          y: clamp(Math.round(xRatio * (height - 1)), 0, height - 1),
          z: clamp(Math.round((1 - yRatio) * (depth - 1)), 0, depth - 1),
        };
      });
    };

  return (
    <main className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <input ref={fileInputRef} className="hidden" type="file" onChange={handleFilesChange} />

      {stage === 'import' ? (
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8">
          <div className="w-full space-y-3">
            <section className="rounded border border-slate-800 bg-slate-950/80 p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                Local-first static viewer
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
                GALILEOS dental x-ray viewer
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Import a local scan folder, parse it fully in-browser, and navigate with three
                linked orthogonal views plus a lightweight 3D preview.
              </p>
            </section>

            <FolderPicker
              directorySupported={directorySupported}
              onPickDirectory={() => void openDirectory()}
              onPickFiles={openFallbackInput}
              onReset={resetViewer}
              busy={busy}
              detail={sourceLabel ? `Source: ${sourceLabel}` : 'Chromium desktop over HTTPS or localhost recommended'}
              unsupportedHint="Use Chromium desktop for direct folder picking. The file-input fallback still works when available."
              stage="import"
            />

            <ImportStatus progress={progress} issue={issue} stage="import" />

            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Reference only. Not for diagnosis, treatment planning, measurements, or implant workflows.
            </div>
          </div>
        </div>
      ) : (
        <>
        <div className="h-full overflow-hidden p-2">
          <div className="grid h-full grid-cols-[minmax(0,1fr)_300px] gap-2">
            <section className="min-h-0">
              <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2">
                <ViewportFrame
                  title="Axial"
                  subtitle="Occlusal · linked crosshair"
                  status={cursor ? `Z ${cursor.z + 1}/${Math.max(1, dimensions[2])}` : 'No volume'}
                  density="compact"
                >
                  <SliceCanvas
                    image={slices.axial}
                    crosshairPoint={cursor ? { x: cursor.x, y: cursor.y } : undefined}
                    crosshairSpace={volume ? [dimensions[0], dimensions[1]] : undefined}
                    label="XY"
                    fit="cover"
                    onSelect={updateCursor('axial')}
                    stage="viewer"
                  />
                </ViewportFrame>

                <ViewportFrame
                  title="Coronal"
                  subtitle="Frontal · superior at top"
                  status={cursor ? `Y ${cursor.y + 1}/${Math.max(1, dimensions[1])}` : 'No volume'}
                  density="compact"
                >
                  <SliceCanvas
                    image={slices.coronal}
                    crosshairPoint={cursor ? { x: cursor.x, y: dimensions[2] - 1 - cursor.z } : undefined}
                    crosshairSpace={volume ? [dimensions[0], dimensions[2]] : undefined}
                    label="XZ"
                    fit="cover"
                    onSelect={updateCursor('coronal')}
                    stage="viewer"
                  />
                </ViewportFrame>

                <ViewportFrame
                  title="Sagittal"
                  subtitle="Lateral · superior at top"
                  status={cursor ? `X ${cursor.x + 1}/${Math.max(1, dimensions[0])}` : 'No volume'}
                  density="compact"
                >
                  <SliceCanvas
                    image={slices.sagittal}
                    crosshairPoint={cursor ? { x: cursor.y, y: dimensions[2] - 1 - cursor.z } : undefined}
                    crosshairSpace={volume ? [dimensions[1], dimensions[2]] : undefined}
                    label="YZ"
                    fit="cover"
                    onSelect={updateCursor('sagittal')}
                    stage="viewer"
                  />
                </ViewportFrame>

                <ViewportFrame
                  title="3D"
                  subtitle="Jaw surface preview"
                  status={
                    prepared3D
                      ? prepared3D.downsampled
                        ? 'Downsampled'
                        : 'Native'
                      : 'Preparing'
                  }
                  density="compact"
                >
                  <VolumeViewport3D volume={prepared3D} onDownsampledChange={setDownsampled3D} />
                </ViewportFrame>
              </div>
            </section>

            <aside className="grid min-h-0 grid-rows-[auto_auto_auto_auto_auto] gap-2 overflow-hidden">
              <section className="rounded border border-slate-800 bg-slate-950/80 p-2.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Study</div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-100">
                  {volume?.meta.scanId}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {dimensions.join(' x ')} voxels
                </div>
                <div className="mt-1 text-xs text-slate-500">{formatSpacing(spacing)} mm</div>
                <div className="mt-1 truncate text-xs text-slate-600">{sourceLabel}</div>
              </section>

              <section className="rounded border border-slate-800 bg-slate-950/70 p-2.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Display</div>
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Window</span>
                    <span className="font-medium text-slate-200">{windowLevel.window}</span>
                  </div>
                  <input
                    className="mt-1 w-full accent-sky-400"
                    type="range"
                    min={WINDOW_MIN}
                    max={WINDOW_MAX}
                    value={windowLevel.window}
                    onChange={(event) =>
                      setWindowLevel((current) => ({
                        ...current,
                        window: Number(event.target.value),
                      }))
                    }
                  />
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Contrast span. Smaller window = more contrast.</p>
                </div>

                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Level</span>
                    <span className="font-medium text-slate-200">{windowLevel.level}</span>
                  </div>
                  <input
                    className="mt-1 w-full accent-sky-400"
                    type="range"
                    min={LEVEL_MIN}
                    max={LEVEL_MAX}
                    value={windowLevel.level}
                    onChange={(event) =>
                      setWindowLevel((current) => ({
                        ...current,
                        level: Number(event.target.value),
                      }))
                    }
                  />
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Brightness bias. Higher level favors denser tissue.</p>
                </div>
              </section>

              <div className="min-h-0">
                <ImportStatus progress={progress} issue={issue} stage="viewer" />
              </div>

              <section className="rounded border border-slate-800 bg-slate-950/70 p-2.5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Navigation</div>
                <div className="mt-2 text-xs text-slate-400">
                  Cursor {cursor ? `${cursor.x + 1}, ${cursor.y + 1}, ${cursor.z + 1}` : 'n/a'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Coronal and sagittal views are flipped so superior anatomy stays at the top.
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {prepared3D?.cropped ? '3D preview cropped to dense anatomy.' : '3D preview using full volume.'}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {downsampled3D ? 'Downsampled after crop for responsiveness.' : 'Native crop resolution.'}
                </div>
              </section>

              <section className="rounded border border-slate-800 bg-slate-950/70 p-2.5">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    onClick={() => setPanoramaEnabled(true)}
                  >
                    Open panorama
                  </button>
                  <button type="button" className={PRIMARY_BUTTON} onClick={() => void openDirectory()}>
                    Open folder
                  </button>
                  <button type="button" className={SECONDARY_BUTTON} onClick={openFallbackInput}>
                    Use folder input
                  </button>
                  <button type="button" className={GHOST_BUTTON} onClick={resetViewer}>
                    Back to import
                  </button>
                </div>
                <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-[11px] leading-4 text-amber-200">
                  Reference only. Not for diagnosis, treatment planning, measurements, or implant workflows.
                </div>
              </section>
            </aside>
          </div>
        </div>
        {panoramaEnabled ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/88 p-6 backdrop-blur-[2px]">
            <div className="grid h-[min(74vh,720px)] w-[min(94vw,1400px)] grid-rows-[auto_minmax(0,1fr)] gap-2 rounded border border-slate-700 bg-slate-950/95 p-2 shadow-2xl">
              <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/90 px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Panorama</div>
                  <div className="text-xs text-slate-400">
                    {panoramaImage
                      ? panoramaImage.mode === 'metadata-seeded'
                        ? 'File-guided curved reconstruction'
                        : panoramaImage.mode === 'volume-derived'
                          ? 'Volume-derived curved reconstruction'
                          : 'Fallback curve'
                      : 'Rendering'}
                  </div>
                </div>
                <button type="button" className={GHOST_BUTTON} onClick={() => setPanoramaEnabled(false)}>
                  Close
                </button>
              </div>
              <div className="min-h-0 rounded border border-slate-800 bg-black p-1">
                <PanoramaDisplay panorama={panoramaImage} stage="viewer" className="h-full" />
              </div>
            </div>
          </div>
        ) : null}
        </>
      )}
    </main>
  );
}
