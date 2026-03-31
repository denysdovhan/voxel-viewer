import type {
  ImportProgress,
  LoadedVolume,
  PanoramaMeta,
  ParsedVolumeMeta,
  PreparedVolumeFor3D,
  ScanFolderSource,
} from '../../types';
import { parseGalileosFolder, type ImportFailure } from './parse-galileos';

type WorkerRequest = {
  type: 'assemble-volume';
  files: Array<{ name: string; path: string; buffer: ArrayBuffer }>;
  meta: ParsedVolumeMeta;
  panorama?: PanoramaMeta;
};

type WorkerEvent =
  | { type: 'progress'; progress: ImportProgress }
  | {
      type: 'result';
      volume: LoadedVolume;
      meta: ParsedVolumeMeta;
      panorama?: PanoramaMeta;
      panoramaImage: null;
      prepared3D: PreparedVolumeFor3D;
    }
  | { type: 'error'; error: ImportFailure };

export interface LoadedImport {
  volume: LoadedVolume;
  meta: ParsedVolumeMeta;
  panorama?: PanoramaMeta;
  panoramaImage: null;
  prepared3D: PreparedVolumeFor3D;
}

export async function loadVolumeFromFolder(
  source: ScanFolderSource,
  onProgress?: (progress: ImportProgress) => void,
): Promise<LoadedImport> {
  onProgress?.({ stage: 'scanning', detail: 'Scanning selected folder', completed: 0, total: 1 });
  const parsed = await parseGalileosFolder(source);
  onProgress?.({ stage: 'parsing-meta', detail: 'Parsed folder metadata', completed: 1, total: 3 });

  const worker = new Worker(new URL('../../workers/volume.worker.ts', import.meta.url), { type: 'module' });
  const payload: WorkerRequest = {
    type: 'assemble-volume',
    files: await Promise.all(
      source.entries
        .filter((entry) => parsed.meta.sliceFiles.includes(entry.relativePath || entry.name))
        .map(async (entry) => ({
          name: entry.name,
          path: entry.relativePath || entry.name,
          buffer: await entry.file.arrayBuffer(),
        })),
    ),
    meta: parsed.meta,
    panorama: parsed.panorama,
  };

  return await new Promise<LoadedImport>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const data = event.data;
      if (data.type === 'progress') {
        onProgress?.(data.progress);
        return;
      }
      if (data.type === 'result') {
        worker.terminate();
        onProgress?.({ stage: 'ready', detail: 'Viewer ready', completed: 1, total: 1 });
        resolve({
          volume: data.volume,
          meta: data.meta,
          panorama: data.panorama,
          panoramaImage: data.panoramaImage,
          prepared3D: data.prepared3D,
        });
        return;
      }
      worker.terminate();
      reject(makeError(data.error.code, data.error.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(makeError('E_WORKER', event.message || 'worker failed'));
    };
    worker.postMessage(payload, payload.files.map((file) => file.buffer));
    onProgress?.({ stage: 'inflating-slices', detail: 'Inflating gzip slices', completed: 0, total: parsed.meta.sliceFiles.length + 1 });
  });
}

function makeError(code: string, message: string): ImportFailure {
  const error = new Error(message) as ImportFailure;
  error.name = code;
  error.code = code;
  return error;
}
