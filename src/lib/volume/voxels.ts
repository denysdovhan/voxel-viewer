import type { LoadedVolume } from '../../types';

export function getVolumeDimensions(
  volume: LoadedVolume,
): readonly [number, number, number] {
  return volume.meta.dimensions;
}

export function voxelIndex(
  volume: LoadedVolume,
  x: number,
  y: number,
  z: number,
): number {
  const [width, height] = volume.meta.dimensions;
  return z * width * height + y * width + x;
}

export function getVoxelValue(
  volume: LoadedVolume,
  x: number,
  y: number,
  z: number,
): number {
  const [width, height, depth] = volume.meta.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) {
    return 0;
  }
  return volume.voxels[voxelIndex(volume, x, y, z)] ?? 0;
}
