import { gunzipSync } from 'fflate';
import type {
  VolumeWorkerErrorPayload,
  VolumeWorkerEvent,
  VolumeWorkerRequest,
} from '../lib/import/types';
import { VolumeWorkerRequestType } from '../lib/import/types';
import { prepareVolumeFor3D } from '../lib/volume';
import type {
  ImportProgress,
  LoadedVolume,
  PreparedVolumeFor3D,
} from '../types';
import { ImportStage } from '../types';

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
        meta: event.data.meta,
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
  const map = new Map(request.files.map((file) => [file.path, file.buffer]));
  const slices = request.meta.sliceFiles.map((path) => ({
    path,
    buffer: map.get(path),
  }));
  if (slices.some((slice) => !slice.buffer))
    throw new Error('missing slice data');

  post({
    stage: ImportStage.Assembling,
    detail: 'Preparing volume buffer',
    completed: 0,
    total: slices.length,
  });

  const voxelCount =
    request.meta.dimensions[0] *
    request.meta.dimensions[1] *
    request.meta.dimensions[2];
  const voxels = new Uint16Array(voxelCount);
  const histogram = new Uint32Array(4096);
  const voxelsPerSlice =
    request.meta.dimensions[0] * request.meta.dimensions[1];

  for (let i = 0; i < slices.length; i += 1) {
    const inflated = gunzipSync(
      new Uint8Array(slices[i].buffer as ArrayBuffer),
    );
    const slice = inflated.buffer.slice(
      inflated.byteOffset,
      inflated.byteOffset + inflated.byteLength,
    );
    const data = new Uint16Array(slice);
    const offset = i * voxelsPerSlice;
    voxels.set(data.subarray(0, voxelsPerSlice), offset);

    for (let j = 0; j < Math.min(data.length, voxelsPerSlice); j += 1) {
      const value = data[j] | 0;
      histogram[Math.min(histogram.length - 1, value)] += 1;
    }

    post({
      stage: ImportStage.InflatingSlices,
      detail: `Inflated slice ${i + 1}/${slices.length}`,
      completed: i + 1,
      total: slices.length,
    });
  }

  const volume = {
    meta: request.meta,
    voxels,
    histogram,
  } satisfies LoadedVolume;

  post({
    stage: ImportStage.Preparing3D,
    detail: 'Preparing 3D rendering',
    completed: slices.length,
    total: slices.length + 1,
  });
  const prepared3D = prepareVolumeFor3D(volume);

  return {
    volume,
    prepared3D,
  };
}

function post(progress: ImportProgress): void {
  postMessage({ type: 'progress', progress } satisfies VolumeWorkerEvent);
}

function normalizeError(error: unknown): VolumeWorkerErrorPayload {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  ) {
    const value = error as { code?: unknown; message?: unknown };
    if (typeof value.code === 'string' && typeof value.message === 'string')
      return { code: value.code, message: value.message };
  }

  if (error instanceof Error) {
    return { code: error.name || 'E_WORKER', message: error.message };
  }

  return { code: 'E_WORKER', message: 'volume assembly failed' };
}
