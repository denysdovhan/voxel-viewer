import { gunzipSync } from 'fflate';
import type { ImportProgress, LoadedVolume, PanoramaMeta, ParsedVolumeMeta } from '../types';

type WorkerRequest = {
  type: 'assemble-volume';
  files: Array<{ name: string; path: string; buffer: ArrayBuffer }>;
  meta: ParsedVolumeMeta;
  panorama?: PanoramaMeta;
};

type WorkerEvent =
  | { type: 'progress'; progress: ImportProgress }
  | { type: 'result'; volume: LoadedVolume; meta: ParsedVolumeMeta; panorama?: PanoramaMeta }
  | { type: 'error'; error: { code: string; message: string } };

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data).then(
    (volume) => postMessage({ type: 'result', volume, meta: event.data.meta, panorama: event.data.panorama } satisfies WorkerEvent),
    (error: unknown) =>
      postMessage({
        type: 'error',
        error: normalizeError(error),
      } satisfies WorkerEvent),
  );
};

async function handle(request: WorkerRequest): Promise<LoadedVolume> {
  if (request.type !== 'assemble-volume') throw new Error('unsupported worker request');
  const map = new Map(request.files.map((file) => [file.path, file.buffer]));
  const slices = request.meta.sliceFiles.map((path) => ({ path, buffer: map.get(path) }));
  if (slices.some((slice) => !slice.buffer)) throw new Error('missing slice data');

  post({ stage: 'assembling', detail: 'Preparing volume buffer', completed: 0, total: slices.length });

  const voxelCount = request.meta.dimensions[0] * request.meta.dimensions[1] * request.meta.dimensions[2];
  const voxels = new Uint16Array(voxelCount);
  const histogram = new Uint32Array(4096);
  const voxelsPerSlice = request.meta.dimensions[0] * request.meta.dimensions[1];

  for (let i = 0; i < slices.length; i += 1) {
    const inflated = gunzipSync(new Uint8Array(slices[i].buffer as ArrayBuffer));
    const slice = inflated.buffer.slice(inflated.byteOffset, inflated.byteOffset + inflated.byteLength);
    const data = new Uint16Array(slice);
    const offset = i * voxelsPerSlice;
    voxels.set(data.subarray(0, voxelsPerSlice), offset);

    for (let j = 0; j < Math.min(data.length, voxelsPerSlice); j += 1) {
      const value = data[j] | 0;
      histogram[Math.min(histogram.length - 1, value)] += 1;
    }

    post({ stage: 'inflating-slices', detail: `Inflated slice ${i + 1}/${slices.length}`, completed: i + 1, total: slices.length });
  }

  return {
    meta: request.meta,
    voxels,
    histogram,
  };
}

function post(progress: ImportProgress): void {
  postMessage({ type: 'progress', progress } satisfies WorkerEvent);
}

function normalizeError(error: unknown): { code: string; message: string } {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const value = error as { code?: unknown; message?: unknown };
    if (typeof value.code === 'string' && typeof value.message === 'string') return { code: value.code, message: value.message };
  }

  if (error instanceof Error) {
    return { code: error.name || 'E_WORKER', message: error.message };
  }

  return { code: 'E_WORKER', message: 'volume assembly failed' };
}
