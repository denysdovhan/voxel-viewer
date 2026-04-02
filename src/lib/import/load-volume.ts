import type { ImportProgress, ScanFolderSource } from '../../types';
import { ImportStage } from '../../types';
import { importFormatAdapters } from './adapters';
import type { ImportFailure, LoadedImport, VolumeWorkerEvent } from './types';

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
  const adapter = importFormatAdapters.find((candidate) =>
    candidate.matches(source),
  );
  if (!adapter) {
    throw makeError(
      'E_FORMAT',
      'Unsupported folder layout. Select a GALILEOS study, a OneVolume export root, or a DICOM slice folder.',
    );
  }

  const parsed = await adapter.parse(source);
  onProgress?.({
    stage: ImportStage.ParsingMeta,
    detail: `Parsed ${adapter.label} metadata`,
    completed: 1,
    total: 3,
  });

  const worker = new Worker(
    new URL('../../workers/volume.worker.ts', import.meta.url),
    { type: 'module' },
  );
  const payload = await adapter.buildWorkerRequest(source, parsed);

  return await new Promise<LoadedImport>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<VolumeWorkerEvent>) => {
      const data = event.data;
      if (data.type === 'progress') {
        onProgress?.(data.progress);
        return;
      }
      if (data.type === 'result') {
        worker.terminate();
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
  });
}

function makeError(code: string, message: string): ImportFailure {
  const error = new Error(message) as ImportFailure;
  error.name = code;
  error.code = code;
  return error;
}
