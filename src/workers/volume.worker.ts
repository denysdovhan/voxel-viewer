import type {
  VolumeWorkerEvent,
  VolumeWorkerRequest,
} from '../lib/import/types';
import { VolumeWorkerRequestType } from '../lib/import/types';
import { prepareVolumeFor3D } from '../lib/volume';
import type { LoadedVolume, PreparedVolumeFor3D } from '../types';
import { ImportStage } from '../types';
import { assembleByFormat } from './volume/assemble';
import { normalizeError, post } from './volume/progress';

self.onmessage = (event: MessageEvent<VolumeWorkerRequest>) => {
  void handle(event.data).then(
    ({ volume, prepared3D }) => {
      const scope = globalThis as typeof globalThis & {
        postMessage: (
          message: VolumeWorkerEvent,
          transfer: Transferable[],
        ) => void;
      };
      const message = {
        type: 'result',
        volume,
        meta: volume.meta,
        prepared3D,
      } satisfies VolumeWorkerEvent;

      scope.postMessage(message, [
        volume.voxels.buffer,
        volume.histogram.buffer,
        prepared3D.voxels.buffer,
      ] as Transferable[]);
    },
    (error: unknown) =>
      postMessage({
        type: 'error',
        error: normalizeError(error),
      } satisfies VolumeWorkerEvent),
  );
};

async function handle(request: VolumeWorkerRequest): Promise<{
  volume: LoadedVolume;
  prepared3D: PreparedVolumeFor3D;
}> {
  if (request.type !== VolumeWorkerRequestType.AssembleVolume)
    throw new Error('unsupported worker request');
  const volume = await assembleByFormat(request.format, {
    meta: request.meta,
    files: request.files,
  });

  post({
    stage: ImportStage.Preparing3D,
    detail: `Preparing ${request.meta.formatLabel} 3D rendering`,
    completed: 1,
    total: 2,
  });
  const prepared3D = prepareVolumeFor3D(volume);

  return {
    volume,
    prepared3D,
  };
}
