import { parseImplicitLittleEndianDicom } from '../../../lib/import/adapters/dicom';
import type { LoadedVolume } from '../../../types';
import { ImportStage } from '../../../types';
import { post } from '../progress';
import { buildScalarHistogram, resolveScalarRange } from '../scalars';
import type { VolumeAssemblerContext } from '../types';

export async function assembleDicomVolume({
  meta,
  files,
}: VolumeAssemblerContext): Promise<LoadedVolume> {
  const map = new Map(files.map((file) => [file.path, file.buffer]));
  const slices = meta.sliceFiles.map((path) => ({
    path,
    buffer: map.get(path),
  }));
  if (slices.some((slice) => !slice.buffer)) {
    throw new Error('missing DICOM slice data');
  }

  post({
    stage: ImportStage.Assembling,
    detailKey: 'importStatus.progress.readingDicomSliceStack',
    completed: 0,
    total: slices.length,
  });

  const [width, height, depth] = meta.dimensions;
  const voxelsPerSlice = width * height;
  const voxels = new Int16Array(voxelsPerSlice * depth);
  const slope = meta.nativeValueScale?.slope ?? 1;
  const intercept = meta.nativeValueScale?.intercept ?? 0;

  for (let index = 0; index < slices.length; index += 1) {
    const buffer = slices[index].buffer as ArrayBuffer;
    const header = parseImplicitLittleEndianDicom(buffer);
    const expectedBytes = voxelsPerSlice * meta.bytesPerVoxel;
    if (header.pixelDataLength !== expectedBytes) {
      throw new Error(
        `invalid DICOM pixel payload: expected ${expectedBytes}, got ${header.pixelDataLength}`,
      );
    }

    const view = new DataView(
      buffer,
      header.pixelDataOffset,
      header.pixelDataLength,
    );
    const offset = index * voxelsPerSlice;

    for (let pixel = 0; pixel < voxelsPerSlice; pixel += 1) {
      const raw =
        header.pixelRepresentation === 0
          ? view.getUint16(pixel * 2, true)
          : view.getInt16(pixel * 2, true);
      voxels[offset + pixel] = Math.round(raw * slope + intercept);
    }

    post({
      stage: ImportStage.Assembling,
      detailKey: 'importStatus.progress.decodedDicomSlice',
      detailValues: {
        current: index + 1,
        total: slices.length,
      },
      completed: index + 1,
      total: slices.length,
    });
  }

  const scalarRange = resolveScalarRange(voxels, meta.scalarRange);
  return {
    meta: {
      ...meta,
      scalarRange,
    },
    voxels,
    histogram: buildScalarHistogram(voxels, scalarRange),
  } satisfies LoadedVolume;
}
