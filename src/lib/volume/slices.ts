import type {
  LoadedVolume,
  SliceImage,
  SliceWindowLevel,
  VolumeCursor,
} from '../../types';
import { VolumeAxis } from '../../types';
import {
  clamp,
  grayToRgba,
  mapIntensityToGray,
  resolveWindowLevel,
} from './math';
import { getVoxelValue } from './voxels';

const MAX_SLICE_CACHE_ENTRIES = 12;

interface VolumeCacheEntry {
  axial: Map<string, SliceImage>;
  coronal: Map<string, SliceImage>;
  sagittal: Map<string, SliceImage>;
}

const volumeCache = new WeakMap<LoadedVolume, VolumeCacheEntry>();

function getVolumeCache(volume: LoadedVolume): VolumeCacheEntry {
  let cache = volumeCache.get(volume);
  if (!cache) {
    cache = {
      axial: new Map(),
      coronal: new Map(),
      sagittal: new Map(),
    };
    volumeCache.set(volume, cache);
  }
  return cache;
}

function cacheForAxis(
  cache: VolumeCacheEntry,
  axis: VolumeAxis,
): Map<string, SliceImage> {
  return cache[axis];
}

function sliceCacheKey(
  sliceIndex: number,
  window: number,
  level: number,
): string {
  return `${sliceIndex}|${window}|${level}`;
}

function extractAxisSliceIndex(axis: VolumeAxis, cursor: VolumeCursor): number {
  switch (axis) {
    case VolumeAxis.Axial:
      return cursor.z;
    case VolumeAxis.Coronal:
      return cursor.y;
    case VolumeAxis.Sagittal:
      return cursor.x;
  }
}

function axisSliceLimit(
  axis: VolumeAxis,
  width: number,
  height: number,
  depth: number,
): number {
  switch (axis) {
    case VolumeAxis.Axial:
      return depth - 1;
    case VolumeAxis.Coronal:
      return height - 1;
    case VolumeAxis.Sagittal:
      return width - 1;
  }
}

function axisImageShape(
  axis: VolumeAxis,
  width: number,
  height: number,
  depth: number,
): Pick<SliceImage, 'width' | 'height'> {
  switch (axis) {
    case VolumeAxis.Axial:
      return { width, height };
    case VolumeAxis.Coronal:
      return { width, height: depth };
    case VolumeAxis.Sagittal:
      return { width: height, height: depth };
  }
}

function sampleAxialGray(
  volume: LoadedVolume,
  zValue: number,
  window: number,
  level: number,
  width: number,
  height: number,
  depth: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  const z = clamp(Math.round(zValue), 0, depth - 1);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      out[offset] = mapIntensityToGray(
        getVoxelValue(volume, x, y, z),
        window,
        level,
      );
      offset += 1;
    }
  }
  return out;
}

function sampleCoronalGray(
  volume: LoadedVolume,
  yValue: number,
  window: number,
  level: number,
  width: number,
  height: number,
  depth: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * depth);
  const y = clamp(Math.round(yValue), 0, height - 1);
  let offset = 0;
  for (let z = depth - 1; z >= 0; z -= 1) {
    for (let x = 0; x < width; x += 1) {
      out[offset] = mapIntensityToGray(
        getVoxelValue(volume, x, y, z),
        window,
        level,
      );
      offset += 1;
    }
  }
  return out;
}

function sampleSagittalGray(
  volume: LoadedVolume,
  xValue: number,
  window: number,
  level: number,
  width: number,
  height: number,
  depth: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(height * depth);
  const x = clamp(Math.round(xValue), 0, width - 1);
  let offset = 0;
  for (let z = depth - 1; z >= 0; z -= 1) {
    for (let y = 0; y < height; y += 1) {
      out[offset] = mapIntensityToGray(
        getVoxelValue(volume, x, y, z),
        window,
        level,
      );
      offset += 1;
    }
  }
  return out;
}

function sampleAxisGray(
  volume: LoadedVolume,
  axis: VolumeAxis,
  sliceIndex: number,
  window: number,
  level: number,
): Uint8ClampedArray {
  const [width, height, depth] = volume.meta.dimensions;
  const slice = clamp(
    Math.round(sliceIndex),
    0,
    axisSliceLimit(axis, width, height, depth),
  );

  switch (axis) {
    case VolumeAxis.Axial:
      return sampleAxialGray(
        volume,
        slice,
        window,
        level,
        width,
        height,
        depth,
      );
    case VolumeAxis.Coronal:
      return sampleCoronalGray(
        volume,
        slice,
        window,
        level,
        width,
        height,
        depth,
      );
    case VolumeAxis.Sagittal:
      return sampleSagittalGray(
        volume,
        slice,
        window,
        level,
        width,
        height,
        depth,
      );
  }
}

function extractAxisImageData(
  volume: LoadedVolume,
  axis: VolumeAxis,
  sliceIndex: number,
  window: number,
  level: number,
): SliceImage {
  const cache = cacheForAxis(getVolumeCache(volume), axis);
  const key = sliceCacheKey(sliceIndex, window, level);
  const cached = cache.get(key);
  if (cached) return cached;

  const [width, height, depth] = volume.meta.dimensions;
  const gray = sampleAxisGray(volume, axis, sliceIndex, window, level);
  const shape = axisImageShape(axis, width, height, depth);
  const image: SliceImage = {
    ...shape,
    data: grayToRgba(gray),
  };

  if (cache.size >= MAX_SLICE_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, image);
  return image;
}

function extractAxisImage(
  volume: LoadedVolume,
  axis: VolumeAxis,
  sliceIndex: number,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  return extractAxisImageData(volume, axis, sliceIndex, window, level);
}

export function extractAxialImage(
  volume: LoadedVolume,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  return extractAxisImage(volume, VolumeAxis.Axial, cursor.z, {
    window,
    level,
  });
}

export function extractCoronalImage(
  volume: LoadedVolume,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  return extractAxisImage(volume, VolumeAxis.Coronal, cursor.y, {
    window,
    level,
  });
}

export function extractSagittalImage(
  volume: LoadedVolume,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  return extractAxisImage(volume, VolumeAxis.Sagittal, cursor.x, {
    window,
    level,
  });
}

export function extractSliceGrayImage(
  volume: LoadedVolume,
  axis: VolumeAxis,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): Uint8ClampedArray {
  const { window, level } = resolveWindowLevel(windowLevel);
  return sampleAxisGray(
    volume,
    axis,
    extractAxisSliceIndex(axis, cursor),
    window,
    level,
  );
}
