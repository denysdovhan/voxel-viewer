import type {
  LoadedVolume,
  PanoramaImage,
  PanoramaMeta,
  PreparedVolumeFor3D,
  SliceImage,
  SliceWindowLevel,
  VolumeCursor,
} from '../../types';

const DEFAULT_WINDOW = 3500;
const DEFAULT_LEVEL = 1800;
const MAX_3D_TEXTURE_EDGE = 256;
const MAX_SLICE_CACHE_ENTRIES = 12;
const PANO_MAX_OUTPUT_WIDTH = 1400;
const PANO_OUTPUT_WIDTH_SCALE = 2.5;
const PANO_MIN_OUTPUT_HEIGHT = 320;
const PANO_MIN_HALF_THICKNESS = 6;
const PANO_MAX_HALF_THICKNESS = 44;
const PANO_DEFAULT_HALF_THICKNESS = 18;
const JAW_BOUNDS_MARGIN_X = 18;
const JAW_BOUNDS_MARGIN_Y = 18;
const JAW_BOUNDS_MARGIN_Z = 24;
const PREVIEW_THRESHOLD_STEPS = [3000, 2400, 1800] as const;

type Axis = 'axial' | 'coronal' | 'sagittal';

interface VolumeBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  count: number;
}

interface PanoramaSample {
  x: number;
  y: number;
  normalX: number;
  normalY: number;
}

interface VolumeCacheEntry {
  axial: Map<string, Uint8ClampedArray>;
  coronal: Map<string, Uint8ClampedArray>;
  sagittal: Map<string, Uint8ClampedArray>;
}

export interface ThresholdPreviewData {
  dimensions: [number, number, number];
  spacing: [number, number, number];
  positions: Float32Array;
  intensities: Uint16Array;
  threshold: number;
  downsampled: boolean;
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
  const gray = axis === 'axial'
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

export function buildPanoramaImage(volume: LoadedVolume, meta?: PanoramaMeta | null): PanoramaImage {
  const [width, , depth] = volume.meta.dimensions;
  const jawBounds = estimateJawBounds(volume);
  const positions = buildPanoramaCurve(volume, jawBounds, meta);
  const outputWidth = Math.max(
    width,
    Math.min(
      PANO_MAX_OUTPUT_WIDTH,
      Math.round(meta?.projSize[0] || width * PANO_OUTPUT_WIDTH_SCALE),
    ),
  );
  const outputHeight = Math.max(
    PANO_MIN_OUTPUT_HEIGHT,
    Math.round(meta?.projSize[1] || jawBounds.maxZ - jawBounds.minZ + 1),
  );
  const data = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const halfThickness = resolvePanoramaHalfThickness(volume, meta);
  const zTop = jawBounds.maxZ;
  const zBottom = jawBounds.minZ;

  for (let x = 0; x < outputWidth; x += 1) {
    const t = outputWidth === 1 ? 0 : x / (outputWidth - 1);
    const sample = positions(t);
    for (let row = 0; row < outputHeight; row += 1) {
      const v = outputHeight === 1 ? 0 : row / (outputHeight - 1);
      const zCenter =
        depth > 1
          ? clamp(Math.round(zTop - v * Math.max(1, zTop - zBottom)), 0, depth - 1)
          : 0;
      const gray = samplePanoColumn(
        volume,
        sample.x,
        sample.y,
        sample.normalX,
        sample.normalY,
        zCenter,
        halfThickness,
      );
      const i = (row * outputWidth + x) * 4;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }

  return {
    width: outputWidth,
    height: outputHeight,
    data,
    mode: meta ? 'metadata-seeded' : 'volume-derived',
  };
}

function resolvePanoramaHalfThickness(volume: LoadedVolume, meta?: PanoramaMeta | null): number {
  const base = meta?.thicknessScale && Number.isFinite(meta.thicknessScale) ? meta.thicknessScale : 1;
  const scaled = Math.round(PANO_DEFAULT_HALF_THICKNESS * clamp(base, 0.5, 2.5));
  const [_, height] = volume.meta.dimensions;
  return clamp(scaled, PANO_MIN_HALF_THICKNESS, Math.min(PANO_MAX_HALF_THICKNESS, Math.max(8, Math.round(height * 0.14))));
}

function samplePanoColumn(
  volume: LoadedVolume,
  centerX: number,
  centerY: number,
  normalX: number,
  normalY: number,
  zCenter: number,
  halfThickness: number,
): number {
  const [width, height, depth] = volume.meta.dimensions;
  let best = 0;

  for (let offset = -halfThickness; offset <= halfThickness; offset += 1) {
    const x = clamp(centerX + normalX * offset, 0, width - 1);
    const y = clamp(centerY + normalY * offset, 0, height - 1);
    const value = sampleVoxelBilinear(volume, x, y, zCenter);
    if (value > best) best = value;

    if (zCenter > 0) {
      const below = sampleVoxelBilinear(volume, x, y, zCenter - 1);
      if (below > best) best = below;
    }

    if (zCenter < depth - 1) {
      const above = sampleVoxelBilinear(volume, x, y, zCenter + 1);
      if (above > best) best = above;
    }
  }

  return mapIntensityToGray(best, DEFAULT_WINDOW, DEFAULT_LEVEL);
}

function sampleVoxelBilinear(volume: LoadedVolume, x: number, y: number, z: number): number {
  const [width, height, depth] = volume.meta.dimensions;
  const zz = clamp(Math.round(z), 0, depth - 1);
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const tx = clamp(x - x0, 0, 1);
  const ty = clamp(y - y0, 0, 1);

  const v00 = getVoxelValue(volume, x0, y0, zz);
  const v10 = getVoxelValue(volume, x1, y0, zz);
  const v01 = getVoxelValue(volume, x0, y1, zz);
  const v11 = getVoxelValue(volume, x1, y1, zz);

  const top = v00 + (v10 - v00) * tx;
  const bottom = v01 + (v11 - v01) * tx;
  return Math.round(top + (bottom - top) * ty);
}

function buildPanoramaCurve(
  volume: LoadedVolume,
  jawBounds: VolumeBounds,
  meta?: PanoramaMeta | null,
): (t: number) => PanoramaSample {
  const [, height] = volume.meta.dimensions;
  const curve = curveFromVolume(volume, jawBounds, meta);
  if (curve) return curve;

  const spanX = jawBounds.maxX - jawBounds.minX;
  const centerX = (jawBounds.minX + jawBounds.maxX) / 2;
  const centerY = clamp((jawBounds.minY + jawBounds.maxY) * 0.5, 0, height - 1);
  const archHeight = Math.max(height * 0.12, (jawBounds.maxY - jawBounds.minY) * 0.42);
  return (t: number) => {
    const x = jawBounds.minX + t * spanX;
    const normalizedX = spanX <= 0 ? 0 : (x - centerX) / Math.max(1, spanX * 0.5);
    const y = clamp(centerY - archHeight + normalizedX * normalizedX * archHeight, 0, height - 1);
    const derivative = (normalizedX * archHeight * 2) / Math.max(1, spanX * 0.5);
    const normal = normalize2D(-derivative, 1);
    return { x, y, normalX: normal.x, normalY: normal.y };
  };
}

function curveFromVolume(
  volume: LoadedVolume,
  jawBounds: VolumeBounds,
  meta?: PanoramaMeta | null,
): ((t: number) => PanoramaSample) | null {
  const [width, height] = volume.meta.dimensions;
  const mip = buildAxialMIP(volume, jawBounds.minZ, jawBounds.maxZ);
  const yByX = new Float32Array(width);
  const valid = new Uint8Array(width);
  const minSearchY = clamp(jawBounds.minY - 14, 0, height - 1);
  const maxSearchY = clamp(jawBounds.maxY + 14, 0, height - 1);

  for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 1) {
    let bestY = -1;
    let bestScore = 0;
    for (let y = minSearchY + 1; y < maxSearchY - 1; y += 1) {
      const score =
        (mip[y * width + x] ?? 0) * 0.5 +
        (mip[(y - 1) * width + x] ?? 0) * 0.25 +
        (mip[(y + 1) * width + x] ?? 0) * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }

    if (bestY >= 0 && bestScore >= 1800) {
      yByX[x] = bestY;
      valid[x] = 1;
    }
  }

  interpolateMissingCurve(yByX, valid, jawBounds.minX, jawBounds.maxX);
  smoothCurve(yByX, jawBounds.minX, jawBounds.maxX, 12);

  let validCount = 0;
  for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 1) {
    if (valid[x]) validCount += 1;
  }
  if (validCount < Math.max(24, (jawBounds.maxX - jawBounds.minX) * 0.2)) return null;

  const shiftX =
    meta?.positionsX[0] && Number.isFinite(meta.positionsX[0])
      ? meta.positionsX[0] / Math.max(volume.meta.spacing[0], 1e-3)
      : 0;
  const shiftY =
    meta?.positionsY[0] && Number.isFinite(meta.positionsY[0])
      ? -meta.positionsY[0] / Math.max(volume.meta.spacing[1], 1e-3) * 0.08
      : 0;

  return (t: number) => {
    const x = clamp(jawBounds.minX + t * (jawBounds.maxX - jawBounds.minX), 0, width - 1);
    const baseY = sampleCurve(yByX, x);
    const leftY = sampleCurve(yByX, clamp(x - 2, 0, width - 1));
    const rightY = sampleCurve(yByX, clamp(x + 2, 0, width - 1));
    const derivative = (rightY - leftY) / 4;
    const normal = normalize2D(-derivative, 1);
    return {
      x: clamp(x + shiftX * 0.06, 0, width - 1),
      y: clamp(baseY + shiftY, 0, height - 1),
      normalX: normal.x,
      normalY: normal.y,
    };
  };
}

function buildAxialMIP(volume: LoadedVolume, zMin: number, zMax: number): Uint16Array {
  const [width, height, depth] = volume.meta.dimensions;
  const out = new Uint16Array(width * height);
  const start = clamp(zMin, 0, depth - 1);
  const end = clamp(zMax, 0, depth - 1);

  for (let z = start; z <= end; z += 1) {
    const offset = z * width * height;
    for (let index = 0; index < width * height; index += 1) {
      const value = volume.voxels[offset + index] ?? 0;
      if (value > out[index]) out[index] = value;
    }
  }

  return out;
}

function interpolateMissingCurve(
  values: Float32Array,
  valid: Uint8Array,
  startX: number,
  endX: number,
): void {
  let previous = -1;
  for (let x = startX; x <= endX; x += 1) {
    if (!valid[x]) continue;
    if (previous < 0) {
      for (let fill = startX; fill < x; fill += 1) values[fill] = values[x] ?? 0;
    } else if (x - previous > 1) {
      const from = values[previous] ?? 0;
      const to = values[x] ?? 0;
      for (let fill = previous + 1; fill < x; fill += 1) {
        const ratio = (fill - previous) / (x - previous);
        values[fill] = from + (to - from) * ratio;
      }
    }
    previous = x;
  }

  if (previous >= 0) {
    for (let x = previous + 1; x <= endX; x += 1) values[x] = values[previous] ?? 0;
  }
}

function smoothCurve(values: Float32Array, startX: number, endX: number, radius: number): void {
  const copy = values.slice();
  for (let x = startX; x <= endX; x += 1) {
    let total = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleX = clamp(x + offset, startX, endX);
      total += copy[sampleX] ?? 0;
      count += 1;
    }
    values[x] = total / Math.max(1, count);
  }
}

function sampleCurve(values: Float32Array, x: number): number {
  const left = Math.floor(x);
  const right = Math.min(values.length - 1, Math.ceil(x));
  if (left === right) return values[left] ?? 0;
  const ratio = x - left;
  return (values[left] ?? 0) * (1 - ratio) + (values[right] ?? 0) * ratio;
}

function normalize2D(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function estimateJawBounds(volume: LoadedVolume): VolumeBounds {
  for (const threshold of PREVIEW_THRESHOLD_STEPS) {
    const bounds = findBoundsAboveThreshold(volume, threshold);
    if (bounds && bounds.count > 3000) {
      return expandBounds(bounds, volume.meta.dimensions, JAW_BOUNDS_MARGIN_X, JAW_BOUNDS_MARGIN_Y, JAW_BOUNDS_MARGIN_Z);
    }
  }

  const [width, height, depth] = volume.meta.dimensions;
  return {
    minX: 0,
    maxX: width - 1,
    minY: 0,
    maxY: height - 1,
    minZ: 0,
    maxZ: depth - 1,
    count: width * height * depth,
  };
}

function findBoundsAboveThreshold(volume: LoadedVolume, threshold: number): VolumeBounds | null {
  const [width, height, depth] = volume.meta.dimensions;
  let minX = width;
  let minY = height;
  let minZ = depth;
  let maxX = -1;
  let maxY = -1;
  let maxZ = -1;
  let count = 0;

  for (let z = 0; z < depth; z += 1) {
    const planeOffset = z * width * height;
    for (let y = 0; y < height; y += 1) {
      const rowOffset = planeOffset + y * width;
      for (let x = 0; x < width; x += 1) {
        const value = volume.voxels[rowOffset + x] ?? 0;
        if (value < threshold) continue;
        count += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (z < minZ) minZ = z;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (z > maxZ) maxZ = z;
      }
    }
  }

  if (count === 0) return null;
  return { minX, maxX, minY, maxY, minZ, maxZ, count };
}

function expandBounds(
  bounds: VolumeBounds,
  dimensions: readonly [number, number, number],
  marginX: number,
  marginY: number,
  marginZ: number,
): VolumeBounds {
  return {
    minX: clamp(bounds.minX - marginX, 0, dimensions[0] - 1),
    maxX: clamp(bounds.maxX + marginX, 0, dimensions[0] - 1),
    minY: clamp(bounds.minY - marginY, 0, dimensions[1] - 1),
    maxY: clamp(bounds.maxY + marginY, 0, dimensions[1] - 1),
    minZ: clamp(bounds.minZ - marginZ, 0, dimensions[2] - 1),
    maxZ: clamp(bounds.maxZ + marginZ, 0, dimensions[2] - 1),
    count: bounds.count,
  };
}

function cropVolumeForPreview(volume: LoadedVolume): {
  dimensions: [number, number, number];
  spacing: [number, number, number];
  voxels: Uint16Array;
  scalarRange: [number, number];
} {
  const bounds = estimateJawBounds(volume);
  const width = bounds.maxX - bounds.minX + 1;
  const height = bounds.maxY - bounds.minY + 1;
  const depth = bounds.maxZ - bounds.minZ + 1;
  const out = new Uint16Array(width * height * depth);
  let scalarMin = Number.POSITIVE_INFINITY;
  let scalarMax = Number.NEGATIVE_INFINITY;

  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = getVoxelValue(volume, bounds.minX + x, bounds.minY + y, bounds.minZ + z);
        out[z * width * height + y * width + x] = value;
        if (value < scalarMin) scalarMin = value;
        if (value > scalarMax) scalarMax = value;
      }
    }
  }

  return {
    dimensions: [width, height, depth],
    spacing: volume.meta.spacing,
    voxels: out,
    scalarRange: [
      Number.isFinite(scalarMin) ? scalarMin : volume.meta.scalarRange[0],
      Number.isFinite(scalarMax) ? scalarMax : volume.meta.scalarRange[1],
    ],
  };
}

export function prepareVolumeFor3D(volume: LoadedVolume): PreparedVolumeFor3D {
  const cropped = cropVolumeForPreview(volume);
  const [width, height, depth] = cropped.dimensions;
  const maxEdge = Math.max(width, height, depth);
  const threshold = Math.max(2200, Math.min(3200, Math.round(cropped.scalarRange[1] * 0.72)));
  if (maxEdge <= MAX_3D_TEXTURE_EDGE) {
    return {
      dimensions: cropped.dimensions,
      spacing: cropped.spacing,
      voxels: cropped.voxels,
      scalarRange: cropped.scalarRange,
      threshold,
      downsampled: false,
      cropped: true,
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
          cropped.voxels[sourceZ * width * height + sourceY * width + sourceX] ?? 0;
      }
    }
  }

  return {
    dimensions: [outWidth, outHeight, outDepth],
    spacing: [
      cropped.spacing[0] / scale,
      cropped.spacing[1] / scale,
      cropped.spacing[2] / scale,
    ],
    voxels: out,
    scalarRange: cropped.scalarRange,
    threshold,
    downsampled: true,
    cropped: true,
  };
}

function sampleIndex(index: number, outSize: number, inSize: number): number {
  if (outSize <= 1 || inSize <= 1) return 0;
  return Math.min(inSize - 1, Math.round((index / (outSize - 1)) * (inSize - 1)));
}

export function buildThresholdPreviewData(volume: LoadedVolume, threshold: number): ThresholdPreviewData {
  const dims = volume.meta.dimensions;
  const total = dims[0] * dims[1] * dims[2];
  const positions = new Float32Array(total * 3);
  const intensities = new Uint16Array(total);
  let p = 0;
  let i = 0;
  for (let z = 0; z < dims[2]; z += 1) {
    for (let y = 0; y < dims[1]; y += 1) {
      for (let x = 0; x < dims[0]; x += 1) {
        positions[p] = x;
        positions[p + 1] = y;
        positions[p + 2] = z;
        intensities[i] = volume.voxels[voxelIndex(volume, x, y, z)] ?? 0;
        p += 3;
        i += 1;
      }
    }
  }

  return {
    dimensions: dims,
    spacing: volume.meta.spacing,
    positions,
    intensities,
    threshold,
    downsampled: false,
  };
}
