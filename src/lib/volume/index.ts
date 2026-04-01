import type {
  LoadedVolume,
  PreparedVolumeFor3D,
  SliceImage,
  SliceWindowLevel,
  VolumeCursor,
} from '../../types';

const DEFAULT_WINDOW = 3500;
const DEFAULT_LEVEL = 1800;
const MAX_3D_TEXTURE_EDGE = 512;
const MAX_SLICE_CACHE_ENTRIES = 12;

type Axis = 'axial' | 'coronal' | 'sagittal';

interface VolumeCacheEntry {
  axial: Map<string, Uint8ClampedArray>;
  coronal: Map<string, Uint8ClampedArray>;
  sagittal: Map<string, Uint8ClampedArray>;
}

const volumeCache = new WeakMap<LoadedVolume, VolumeCacheEntry>();

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getVolumeDimensions(volume: LoadedVolume): readonly [number, number, number] {
  return volume.meta.dimensions;
}

export function voxelIndex(volume: LoadedVolume, x: number, y: number, z: number): number {
  const [width, height] = volume.meta.dimensions;
  return z * width * height + y * width + x;
}

export function getVoxelValue(volume: LoadedVolume, x: number, y: number, z: number): number {
  const [width, height, depth] = volume.meta.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return 0;
  return volume.voxels[voxelIndex(volume, x, y, z)] ?? 0;
}

export function resolveWindowLevel(windowLevel?: Partial<SliceWindowLevel>): SliceWindowLevel {
  return {
    window: Math.max(1, windowLevel?.window ?? DEFAULT_WINDOW),
    level: windowLevel?.level ?? DEFAULT_LEVEL,
  };
}

export function mapIntensityToGray(value: number, window: number, level: number): number {
  const low = level - window / 2;
  const normalized = (value - low) / window;
  return Math.round(clamp(normalized, 0, 1) * 255);
}

export function mapIntensityToRgba(
  value: number,
  window: number,
  level: number,
): [number, number, number, number] {
  const gray = mapIntensityToGray(value, window, level);
  return [gray, gray, gray, 255];
}

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

function cacheForAxis(cache: VolumeCacheEntry, axis: Axis): Map<string, Uint8ClampedArray> {
  return cache[axis];
}

function sliceCacheKey(cursor: VolumeCursor, window: number, level: number): string {
  return `${cursor.x}|${cursor.y}|${cursor.z}|${window}|${level}`;
}

function toRgbaBuffer(gray: ArrayLike<number>, out?: Uint8ClampedArray): Uint8ClampedArray {
  const rgba = out ?? new Uint8ClampedArray(gray.length * 4);
  for (let i = 0, j = 0; i < gray.length; i += 1, j += 4) {
    const value = gray[i] ?? 0;
    rgba[j] = value;
    rgba[j + 1] = value;
    rgba[j + 2] = value;
    rgba[j + 3] = 255;
  }
  return rgba;
}

function sampleAxisGray(
  volume: LoadedVolume,
  axis: Axis,
  cursor: VolumeCursor,
  window: number,
  level: number,
): Uint8ClampedArray {
  const cache = cacheForAxis(getVolumeCache(volume), axis);
  const key = sliceCacheKey(cursor, window, level);
  const cached = cache.get(key);
  if (cached) return cached;

  const [width, height, depth] = volume.meta.dimensions;
  const gray =
    axis === 'axial'
      ? sampleAxialGray(volume, cursor.z, window, level, width, height, depth)
      : axis === 'coronal'
        ? sampleCoronalGray(volume, cursor.y, window, level, width, height, depth)
        : sampleSagittalGray(volume, cursor.x, window, level, width, height, depth);

  if (cache.size >= MAX_SLICE_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, gray);
  return gray;
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
      out[offset] = mapIntensityToGray(getVoxelValue(volume, x, y, z), window, level);
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
      out[offset] = mapIntensityToGray(getVoxelValue(volume, x, y, z), window, level);
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
      out[offset] = mapIntensityToGray(getVoxelValue(volume, x, y, z), window, level);
      offset += 1;
    }
  }
  return out;
}

export function extractAxialImage(
  volume: LoadedVolume,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  const [width, height] = volume.meta.dimensions;
  return { width, height, data: grayToRgba(sampleAxisGray(volume, 'axial', cursor, window, level)) };
}

export function extractCoronalImage(
  volume: LoadedVolume,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  const [width, , depth] = volume.meta.dimensions;
  return { width, height: depth, data: grayToRgba(sampleAxisGray(volume, 'coronal', cursor, window, level)) };
}

export function extractSagittalImage(
  volume: LoadedVolume,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): SliceImage {
  const { window, level } = resolveWindowLevel(windowLevel);
  const [, height, depth] = volume.meta.dimensions;
  return { width: height, height: depth, data: grayToRgba(sampleAxisGray(volume, 'sagittal', cursor, window, level)) };
}

export function extractSliceGrayImage(
  volume: LoadedVolume,
  axis: Axis,
  cursor: VolumeCursor,
  windowLevel?: Partial<SliceWindowLevel>,
): Uint8ClampedArray {
  const { window, level } = resolveWindowLevel(windowLevel);
  return sampleAxisGray(volume, axis, cursor, window, level);
}

export function grayToRgba(gray: ArrayLike<number>, out?: Uint8ClampedArray): Uint8ClampedArray {
  return toRgbaBuffer(gray, out);
}

export function prepareVolumeFor3D(volume: LoadedVolume): PreparedVolumeFor3D {
  const full = {
    dimensions: volume.meta.dimensions,
    sourceDimensions: volume.meta.dimensions,
    origin: [0, 0, 0] as [number, number, number],
    spacing: volume.meta.spacing,
    voxels: volume.voxels,
    scalarRange: volume.meta.scalarRange,
  };
  const [width, height, depth] = full.dimensions;
  const maxEdge = Math.max(width, height, depth);
  const threshold = estimatePreviewThreshold(full.voxels, full.scalarRange);
  if (maxEdge <= MAX_3D_TEXTURE_EDGE) {
    return {
      dimensions: full.dimensions,
      sourceDimensions: full.sourceDimensions,
      origin: full.origin,
      spacing: full.spacing,
      voxels: quantizePreviewVoxels(full.voxels, full.scalarRange),
      scalarRange: full.scalarRange,
      threshold,
      downsampled: false,
      cropped: false,
    };
  }

  const scale = MAX_3D_TEXTURE_EDGE / maxEdge;
  const outWidth = Math.max(1, Math.round(width * scale));
  const outHeight = Math.max(1, Math.round(height * scale));
  const outDepth = Math.max(1, Math.round(depth * scale));
  const out = new Uint16Array(outWidth * outHeight * outDepth);

  for (let z = 0; z < outDepth; z += 1) {
    const sourceZ = sampleIndex(z, outDepth, depth);
    for (let y = 0; y < outHeight; y += 1) {
      const sourceY = sampleIndex(y, outHeight, height);
      for (let x = 0; x < outWidth; x += 1) {
        const sourceX = sampleIndex(x, outWidth, width);
        out[z * outWidth * outHeight + y * outWidth + x] =
          full.voxels[sourceZ * width * height + sourceY * width + sourceX] ?? 0;
      }
    }
  }

  return {
    dimensions: [outWidth, outHeight, outDepth],
    sourceDimensions: full.sourceDimensions,
    origin: full.origin,
    spacing: [full.spacing[0] / scale, full.spacing[1] / scale, full.spacing[2] / scale],
    voxels: quantizePreviewVoxels(out, full.scalarRange),
    scalarRange: full.scalarRange,
    threshold,
    downsampled: true,
    cropped: false,
  };
}

function quantizePreviewVoxels(
  voxels: Uint16Array,
  scalarRange: [number, number],
): Uint8Array {
  const [scalarMin, scalarMax] = scalarRange;
  const span = Math.max(1, scalarMax - scalarMin);
  const out = new Uint8Array(voxels.length);
  for (let index = 0; index < voxels.length; index += 1) {
    const normalized = ((voxels[index] ?? 0) - scalarMin) / span;
    out[index] = Math.round(clamp(normalized, 0, 1) * 255);
  }
  return out;
}

function estimatePreviewThreshold(
  voxels: Uint16Array,
  scalarRange: [number, number],
): number {
  const histogram = new Uint32Array(4096);
  for (let index = 0; index < voxels.length; index += 1) {
    histogram[Math.min(histogram.length - 1, voxels[index] ?? 0)] += 1;
  }

  const percentile95 = resolveHistogramPercentile(histogram, voxels.length, 0.95);
  const percentile985 = resolveHistogramPercentile(histogram, voxels.length, 0.985);
  return clamp(
    Math.round(percentile95 * 0.42 + percentile985 * 0.14),
    Math.max(950, scalarRange[0]),
    Math.min(1650, scalarRange[1]),
  );
}

function resolveHistogramPercentile(
  histogram: Uint32Array,
  total: number,
  percentile: number,
): number {
  const target = total * percentile;
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value] ?? 0;
    if (seen >= target) return value;
  }
  return histogram.length - 1;
}

function sampleIndex(index: number, outSize: number, inSize: number): number {
  if (outSize <= 1 || inSize <= 1) return 0;
  return Math.min(inSize - 1, Math.round((index / (outSize - 1)) * (inSize - 1)));
}
