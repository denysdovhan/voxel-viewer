import type { ImportProgress, ScanFolderSource } from '../../types';
import { ImportStage } from '../../types';
import { type ImportFailure, parseGalileosFolder } from './parse-galileos';
import type {
  LoadedImport,
  VolumeWorkerEvent,
  VolumeWorkerRequest,
} from './types';
import { VolumeWorkerRequestType } from './types';

export async function loadVolumeFromFolder(
  source: ScanFolderSource,
  onProgress?: (progress: ImportProgress) => void,
): Promise<LoadedImport> {
  onProgress?.({
    stage: ImportStage.Scanning,
    detail: 'Scanning selected folder',
    completed: 0,
    total: 1,
  });
  const parsed = await parseGalileosFolder(source);
  onProgress?.({
    stage: ImportStage.ParsingMeta,
    detail: 'Parsed folder metadata',
    completed: 1,
    total: 3,
  });

  const worker = new Worker(
    new URL('../../workers/volume.worker.ts', import.meta.url),
    { type: 'module' },
  );
  const payload: VolumeWorkerRequest = {
    type: VolumeWorkerRequestType.AssembleVolume,
    files: await Promise.all(
      source.entries
        .filter((entry) =>
          parsed.meta.sliceFiles.includes(entry.relativePath || entry.name),
        )
        .map(async (entry) => ({
          name: entry.name,
          path: entry.relativePath || entry.name,
          buffer: await entry.file.arrayBuffer(),
        })),
    ),
    meta: parsed.meta,
  };

  return await new Promise<LoadedImport>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<VolumeWorkerEvent>) => {
      const data = event.data;
      if (data.type === 'progress') {
        onProgress?.(data.progress);
        return;
      }
      if (data.type === 'result') {
        worker.terminate();
        onProgress?.({
          stage: ImportStage.Ready,
          detail: 'Viewer ready',
          completed: 1,
          total: 1,
        });
        resolve({
          volume: data.volume,
          meta: data.meta,
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
    worker.postMessage(
      payload,
      payload.files.map((file) => file.buffer),
    );
    onProgress?.({
      stage: ImportStage.InflatingSlices,
      detail: 'Inflating gzip slices',
      completed: 0,
      total: parsed.meta.sliceFiles.length + 1,
    });
  });
}

function makeError(code: string, message: string): ImportFailure {
  const error = new Error(message) as ImportFailure;
  error.name = code;
  error.code = code;
  return error;
}
