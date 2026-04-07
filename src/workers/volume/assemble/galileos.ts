import { gunzipSync } from 'fflate';
import type { LoadedVolume } from '../../../types';
import { ImportStage } from '../../../types';
import { post } from '../progress';
import { buildScalarHistogram } from '../scalars';
import type { VolumeAssemblerContext } from '../types';

export async function assembleGalileosVolume({
  meta,
  files,
}: VolumeAssemblerContext): Promise<LoadedVolume> {
  const map = new Map(files.map((file) => [file.path, file.buffer]));
  const slices = meta.sliceFiles.map((path) => ({
    path,
    buffer: map.get(path),
  }));
  if (slices.some((slice) => !slice.buffer)) {
    throw new Error('missing slice data');
  }

  post({
    stage: ImportStage.Assembling,
    detailKey: 'importStatus.progress.preparingGalileosVolumeBuffer',
    completed: 0,
    total: slices.length,
  });

  const voxelCount =
    meta.dimensions[0] * meta.dimensions[1] * meta.dimensions[2];
  const voxels = new Int16Array(voxelCount);
  const voxelsPerSlice = meta.dimensions[0] * meta.dimensions[1];

  for (let i = 0; i < slices.length; i += 1) {
    const inflated = gunzipSync(
      new Uint8Array(slices[i].buffer as ArrayBuffer),
    );
    const data = new Uint16Array(
      inflated.buffer,
      inflated.byteOffset,
      Math.floor(inflated.byteLength / 2),
    );
    const offset = i * voxelsPerSlice;

    for (let j = 0; j < Math.min(data.length, voxelsPerSlice); j += 1) {
      voxels[offset + j] = data[j] ?? 0;
    }

    post({
      stage: ImportStage.InflatingSlices,
      detailKey: 'importStatus.progress.inflatedGalileosSlice',
      detailValues: {
        current: i + 1,
        total: slices.length,
      },
      completed: i + 1,
      total: slices.length,
    });
  }

  return {
    meta,
    voxels,
    histogram: buildScalarHistogram(voxels, meta.scalarRange),
  } satisfies LoadedVolume;
}
