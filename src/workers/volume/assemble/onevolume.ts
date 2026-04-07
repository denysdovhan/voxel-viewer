import type { LoadedVolume } from '../../../types';
import { ImportStage } from '../../../types';
import { post } from '../progress';
import {
  buildScalarHistogram,
  resolveOneVolumeWindowLevel,
  resolveScalarRange,
} from '../scalars';
import type { VolumeAssemblerContext } from '../types';

const ONEVOLUME_SENTINEL = -32768;
const ONEVOLUME_WINDOW_SCALE = 100;
const ONEVOLUME_MARKER_LENGTH = 'JmVolumeVersion=1'.length;

export async function assembleOneVolumeVolume({
  meta,
  files,
}: VolumeAssemblerContext): Promise<LoadedVolume> {
  const file = files.find((entry) => entry.path === meta.sliceFiles[0]);
  if (!file) {
    throw new Error('missing CT_0.vol payload');
  }

  post({
    stage: ImportStage.Assembling,
    detailKey: 'importStatus.progress.readingOneVolumeVoxelPayload',
    completed: 0,
    total: 2,
  });

  const buffer = file.buffer as ArrayBuffer;
  const markerOffset = 4;
  const xmlLength = new DataView(
    buffer,
    markerOffset + ONEVOLUME_MARKER_LENGTH,
    4,
  ).getUint32(0, true);
  const dataOffset =
    markerOffset + ONEVOLUME_MARKER_LENGTH + 4 + xmlLength + 36;
  const [sourceWidth, sourceHeight, sourceDepth] =
    meta.sourceDimensions ?? meta.dimensions;
  const sourceVoxelCount = sourceWidth * sourceHeight * sourceDepth;
  const expectedBytes = sourceVoxelCount * meta.bytesPerVoxel;
  const actualBytes = buffer.byteLength - dataOffset;

  if (actualBytes !== expectedBytes) {
    throw new Error(
      `invalid OneVolume payload size: expected ${expectedBytes}, got ${actualBytes}`,
    );
  }

  const view = new DataView(buffer, dataOffset, actualBytes);
  const [offsetX, offsetY, offsetZ] = meta.sourceOffset ?? [0, 0, 0];
  const [width, height, depth] = meta.dimensions;
  const voxels = new Int16Array(width * height * depth);
  const slope = meta.nativeValueScale?.slope ?? 190;
  const intercept = meta.nativeValueScale?.intercept ?? 0;

  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      const canonicalPlaneOffset = z * width * height + y * width;
      const sourceY = offsetY + y;

      for (let x = 0; x < width; x += 1) {
        const sourceX = offsetX + x;
        const sourceZ = offsetZ + z;
        const sourceIndex =
          sourceZ +
          sourceDepth * sourceY +
          sourceDepth * sourceHeight * sourceX;
        const raw = view.getInt16(sourceIndex * 2, true);
        if (raw === ONEVOLUME_SENTINEL) {
          voxels[canonicalPlaneOffset + x] = ONEVOLUME_SENTINEL;
          continue;
        }

        voxels[canonicalPlaneOffset + x] = Math.round(
          (raw * ONEVOLUME_WINDOW_SCALE) / slope +
            intercept * ONEVOLUME_WINDOW_SCALE,
        );
      }
    }
  }

  post({
    stage: ImportStage.Assembling,
    detailKey: 'importStatus.progress.decodedOneVolumeVoxelPayload',
    completed: 1,
    total: 2,
  });

  const scalarRange = resolveScalarRange(
    voxels,
    meta.scalarRange,
    ONEVOLUME_SENTINEL,
  );
  const histogram = buildScalarHistogram(voxels, scalarRange);
  return {
    meta: {
      ...meta,
      scalarRange,
      initialWindowLevel: resolveOneVolumeWindowLevel(
        histogram,
        scalarRange,
        meta.initialWindowLevel,
      ),
    },
    voxels,
    histogram,
  } satisfies LoadedVolume;
}
