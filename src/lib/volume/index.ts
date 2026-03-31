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
const MAX_3D_TEXTURE_EDGE = 384;
const MAX_SLICE_CACHE_ENTRIES = 12;
const PANO_MAX_OUTPUT_WIDTH = 3072;
const PANO_OUTPUT_WIDTH_SCALE = 2.2;
const PANO_MIN_OUTPUT_HEIGHT = 512;
const PANO_MAX_OUTPUT_HEIGHT = 640;
const PANO_MIN_HALF_THICKNESS = 12;
const PANO_MAX_HALF_THICKNESS = 84;
const PANO_DEFAULT_HALF_THICKNESS_MM = 4.8;
const JAW_BOUNDS_MARGIN_X = 32;
const JAW_BOUNDS_MARGIN_Y = 18;
const JAW_BOUNDS_MARGIN_Z = 24;
const PANO_BOUNDS_MARGIN_X = 52;
const PANO_BOUNDS_MARGIN_Y = 24;
const PANO_BOUNDS_MARGIN_Z = 30;
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

interface SliceDensity {
  z: number;
  count: number;
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
  const jawBounds = estimatePanoramaBounds(volume);
  const zRange = resolvePanoramaZRange(volume, jawBounds);
  const curve = buildPanoramaCurve(volume, jawBounds, meta);
  const arcSampler = buildPanoramaArcSampler(curve);
  const outputWidth = Math.max(
    width,
    Math.min(
      PANO_MAX_OUTPUT_WIDTH,
      Math.round(meta?.projSize[0] || width * PANO_OUTPUT_WIDTH_SCALE),
    ),
  );
  const outputHeight = Math.max(
    PANO_MIN_OUTPUT_HEIGHT,
    Math.min(
      PANO_MAX_OUTPUT_HEIGHT,
      Math.round(
        Math.min(
          meta?.projSize[1] || depth,
          Math.max(
            zRange.maxZ - zRange.minZ + 1,
            (zRange.maxZ - zRange.minZ + 1) * 2.4,
          ),
        ),
      ),
    ),
  );
  const data = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const path = new Float32Array(outputWidth * 2);
  const halfThickness = resolvePanoramaHalfThickness(volume, meta);
  const zTop = zRange.maxZ;
  const zBottom = zRange.minZ;

  for (let x = 0; x < outputWidth; x += 1) {
    const t = outputWidth === 1 ? 0 : x / (outputWidth - 1);
    const sample = arcSampler.sampleAt(t);
    const columnHalfThickness = resolvePanoramaColumnHalfThickness(halfThickness, t);
    path[x * 2] = sample.x;
    path[x * 2 + 1] = sample.y;
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
        columnHalfThickness,
      );
      const i = (row * outputWidth + x) * 4;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
      data[i + 3] = 255;
    }
  }

  return trimPanoramaRows({
    width: outputWidth,
    height: outputHeight,
    data,
    mode: meta ? 'metadata-seeded' : 'volume-derived',
    path,
    zRange: [zTop, zBottom],
    displayAspect: resolvePanoramaDisplayAspect(meta),
  });
}

function resolvePanoramaDisplayAspect(meta?: PanoramaMeta | null): number {
  const horizontal = meta?.voxelSize[0] ?? 0;
  const vertical = meta?.voxelSize[1] ?? 0;
  if (!(horizontal > 0) || !(vertical > 0)) return 1;
  return clamp(horizontal / vertical, 0.45, 1.2);
}

function resolvePanoramaColumnHalfThickness(base: number, t: number): number {
  const edgeBias = Math.abs(t - 0.5) * 2;
  return clamp(
    Math.round(base * (1 + edgeBias * 0.22)),
    PANO_MIN_HALF_THICKNESS,
    PANO_MAX_HALF_THICKNESS,
  );
}

export function resolvePanoramaSelection(
  volume: LoadedVolume,
  panorama: PanoramaImage,
  point: { xRatio: number; yRatio: number },
): VolumeCursor {
  const column = clamp(
    Math.round(clamp(point.xRatio, 0, 1) * Math.max(1, panorama.width - 1)),
    0,
    panorama.width - 1,
  );
  const pathIndex = column * 2;
  const zTop = panorama.zRange[0];
  const zBottom = panorama.zRange[1];
  return {
    x: clamp(Math.round(panorama.path[pathIndex] ?? 0), 0, volume.meta.dimensions[0] - 1),
    y: clamp(Math.round(panorama.path[pathIndex + 1] ?? 0), 0, volume.meta.dimensions[1] - 1),
    z: clamp(
      Math.round(zTop - clamp(point.yRatio, 0, 1) * Math.max(1, zTop - zBottom)),
      0,
      volume.meta.dimensions[2] - 1,
    ),
  };
}

export function projectCursorToPanorama(
  panorama: PanoramaImage | null,
  cursor: VolumeCursor | null,
): { x: number; y: number } | undefined {
  if (!panorama || !cursor) return undefined;

  let bestColumn = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let x = 0; x < panorama.width; x += 1) {
    const pathIndex = x * 2;
    const dx = (panorama.path[pathIndex] ?? 0) - cursor.x;
    const dy = (panorama.path[pathIndex + 1] ?? 0) - cursor.y;
    const score = dx * dx + dy * dy;
    if (score < bestScore) {
      bestScore = score;
      bestColumn = x;
    }
  }

  const zTop = panorama.zRange[0];
  const zBottom = panorama.zRange[1];
  const yRatio = clamp(
    (zTop - cursor.z) / Math.max(1, zTop - zBottom),
    0,
    1,
  );

  return {
    x: bestColumn,
    y: yRatio * Math.max(1, panorama.height - 1),
  };
}

function resolvePanoramaHalfThickness(volume: LoadedVolume, meta?: PanoramaMeta | null): number {
  const base = meta?.thicknessScale && Number.isFinite(meta.thicknessScale) ? meta.thicknessScale : 1;
  const xySpacing = Math.max(1e-3, (volume.meta.spacing[0] + volume.meta.spacing[1]) * 0.5);
  const halfThicknessMm = PANO_DEFAULT_HALF_THICKNESS_MM * clamp(base, 0.8, 1.8);
  const scaled = Math.round(halfThicknessMm / xySpacing);
  const [_, height] = volume.meta.dimensions;
  return clamp(
    scaled,
    PANO_MIN_HALF_THICKNESS,
    Math.min(PANO_MAX_HALF_THICKNESS, Math.max(PANO_MIN_HALF_THICKNESS, Math.round(height * 0.18))),
  );
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
  let weighted = 0;
  let totalWeight = 0;
  let best = 0;
  let second = 0;
  let third = 0;
  let fourth = 0;
  let fifth = 0;
  const zHalfThickness = Math.max(1, Math.round(halfThickness * 0.14));

  for (let zOffset = -zHalfThickness; zOffset <= zHalfThickness; zOffset += 1) {
    const z = clamp(zCenter + zOffset, 0, depth - 1);
    const zWeight = zOffset === 0 ? 1 : 0.72;

    for (let offset = -halfThickness; offset <= halfThickness; offset += 1) {
      const x = clamp(centerX + normalX * offset, 0, width - 1);
      const y = clamp(centerY + normalY * offset, 0, height - 1);
      const radialWeight = 1 - Math.abs(offset) / Math.max(1, halfThickness + 1);
      const emphasis = Math.pow(radialWeight, 1.35) * zWeight;
      const value = sampleVoxelBilinear(volume, x, y, z);
      if (value >= best) {
        fifth = fourth;
        fourth = third;
        third = second;
        second = best;
        best = value;
      } else if (value >= second) {
        fifth = fourth;
        fourth = third;
        third = second;
        second = value;
      } else if (value > third) {
        fifth = fourth;
        fourth = third;
        third = value;
      } else if (value > fourth) {
        fifth = fourth;
        fourth = value;
      } else if (value > fifth) {
        fifth = value;
      }
      weighted += value * emphasis;
      totalWeight += emphasis;
    }
  }

  const mean = totalWeight > 0 ? weighted / totalWeight : best;
  const topAverage = (best + second + third + fourth + fifth) / 5;
  return mapIntensityToGray(best * 0.34 + topAverage * 0.38 + mean * 0.28, DEFAULT_WINDOW, DEFAULT_LEVEL);
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
  const template = resolvePanoramaTemplate(volume, jawBounds, meta);
  const curve = curveFromVolume(volume, jawBounds, meta);
  if (curve) return curve;

  const spanX = jawBounds.maxX - jawBounds.minX;
  return (t: number) => {
    const x = jawBounds.minX + t * spanX;
    const sample = sampleTemplateCurve(template, x, height);
    const y = sample.y;
    const derivative = sample.derivative;
    const normal = normalize2D(-derivative, 1);
    return { x, y, normalX: normal.x, normalY: normal.y };
  };
}

function buildPanoramaArcSampler(
  curve: (t: number) => PanoramaSample,
): { sampleAt: (ratio: number) => PanoramaSample } {
  const steps = 255;
  const samples = new Array<PanoramaSample>(steps + 1);
  const cumulative = new Float32Array(steps + 1);
  samples[0] = curve(0);
  let totalLength = 0;

  for (let index = 1; index <= steps; index += 1) {
    const sample = curve(index / steps);
    samples[index] = sample;
    const previous = samples[index - 1];
    totalLength += Math.hypot(sample.x - previous.x, sample.y - previous.y);
    cumulative[index] = totalLength;
  }

  const sampleAt = (ratio: number): PanoramaSample => {
    if (totalLength <= 0) return samples[0];
    const target = clamp(ratio, 0, 1) * totalLength;
    let right = 1;
    while (right < cumulative.length && cumulative[right] < target) right += 1;
    const left = Math.max(0, right - 1);
    const leftDistance = cumulative[left] ?? 0;
    const rightDistance = cumulative[Math.min(right, cumulative.length - 1)] ?? totalLength;
    const span = Math.max(1e-6, rightDistance - leftDistance);
    const mix = clamp((target - leftDistance) / span, 0, 1);
    const from = samples[left];
    const to = samples[Math.min(right, samples.length - 1)];
    const normal = normalize2D(
      from.normalX + (to.normalX - from.normalX) * mix,
      from.normalY + (to.normalY - from.normalY) * mix,
    );
    return {
      x: from.x + (to.x - from.x) * mix,
      y: from.y + (to.y - from.y) * mix,
      normalX: normal.x,
      normalY: normal.y,
    };
  };

  return { sampleAt };
}

function resolvePanoramaTemplate(
  volume: LoadedVolume,
  jawBounds: VolumeBounds,
  meta?: PanoramaMeta | null,
): {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  shapeExponent: number;
} {
  const [, height] = volume.meta.dimensions;
  const spanX = Math.max(1, jawBounds.maxX - jawBounds.minX);
  const spanY = Math.max(1, jawBounds.maxY - jawBounds.minY);
  const shiftXValue = meta?.positionsX?.[0];
  const shiftYValue = meta?.positionsY?.[0];
  const shiftX =
    typeof shiftXValue === 'number' && Number.isFinite(shiftXValue)
      ? (shiftXValue / Math.max(volume.meta.spacing[0], 1e-3)) * 0.7
      : 0;
  const shiftY =
    typeof shiftYValue === 'number' && Number.isFinite(shiftYValue)
      ? (-shiftYValue / Math.max(volume.meta.spacing[1], 1e-3)) * 0.12
      : 0;
  const curveProfile = resolveCurveProfile(meta?.curveType);

  return {
    centerX: clamp((jawBounds.minX + jawBounds.maxX) * 0.5 + shiftX, 0, volume.meta.dimensions[0] - 1),
    centerY: clamp(jawBounds.maxY + spanY * curveProfile.centerYOffsetScale + shiftY, 0, height - 1),
    radiusX: Math.max(1, spanX * curveProfile.radiusXScale),
    radiusY: Math.max(height * 0.1, spanY * curveProfile.radiusYScale),
    shapeExponent: curveProfile.shapeExponent,
  };
}

function resolveCurveProfile(curveType?: string): {
  centerYOffsetScale: number;
  radiusXScale: number;
  radiusYScale: number;
  shapeExponent: number;
} {
  switch (curveType) {
    case '1':
      return { centerYOffsetScale: 0.1, radiusXScale: 0.54, radiusYScale: 0.98, shapeExponent: 0.62 };
    case '2':
      return { centerYOffsetScale: 0.11, radiusXScale: 0.55, radiusYScale: 1.02, shapeExponent: 0.6 };
    case '3':
      return { centerYOffsetScale: 0.12, radiusXScale: 0.57, radiusYScale: 1.08, shapeExponent: 0.56 };
    case '4':
      return { centerYOffsetScale: 0.13, radiusXScale: 0.59, radiusYScale: 1.12, shapeExponent: 0.54 };
    default:
      return { centerYOffsetScale: 0.12, radiusXScale: 0.56, radiusYScale: 1.04, shapeExponent: 0.58 };
  }
}

function sampleTemplateCurve(
  template: {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    shapeExponent: number;
  },
  x: number,
  maxHeight: number,
): { y: number; derivative: number } {
  const normalizedX = clamp((x - template.centerX) / Math.max(1, template.radiusX), -0.9999, 0.9999);
  const inside = Math.max(1e-6, 1 - normalizedX * normalizedX);
  const lift = Math.pow(inside, template.shapeExponent);
  const y = clamp(
    template.centerY - template.radiusY * lift,
    0,
    maxHeight - 1,
  );
  return {
    y,
    derivative:
      (2 * template.radiusY * template.shapeExponent * normalizedX * Math.pow(inside, template.shapeExponent - 1)) /
      Math.max(1, template.radiusX),
  };
}

function curveFromVolume(
  volume: LoadedVolume,
  jawBounds: VolumeBounds,
  meta?: PanoramaMeta | null,
): ((t: number) => PanoramaSample) | null {
  const [width, height] = volume.meta.dimensions;
  const occlusalZ = estimateOcclusalSlice(volume, jawBounds);
  const mip = buildAxialGuideProjection(volume, occlusalZ, 2);
  const yByX = new Float32Array(width);
  const valid = new Uint8Array(width);
  const scoreByX = new Float32Array(width);
  const confidenceByX = new Float32Array(width);
  const template = resolvePanoramaTemplate(volume, jawBounds, meta);
  const minSearchY = clamp(jawBounds.minY - 14, 0, height - 1);
  const maxSearchY = clamp(jawBounds.maxY + 14, 0, height - 1);
  const searchRadius = clamp(Math.round((maxSearchY - minSearchY) * 0.15), 18, 38);
  const denseThreshold = resolvePanoramaTraceThreshold(mip, jawBounds, width);

  for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 1) {
    const expected = sampleTemplateCurve(template, x, height).y;
    const startY = clamp(Math.round(expected) - searchRadius, minSearchY, maxSearchY);
    const endY = clamp(Math.round(expected) + searchRadius, minSearchY, maxSearchY);
    let bestY = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    const band = findDenseBandCenter(mip, width, x, startY, endY, denseThreshold);
    if (band) {
      bestY = band.centerY;
      bestScore = band.score - Math.abs(band.centerY - expected) * 5;
    }

    for (let y = startY + 1; y < endY - 1; y += 1) {
      const intensity =
        (mip[y * width + x] ?? 0) * 0.5 +
        (mip[(y - 1) * width + x] ?? 0) * 0.25 +
        (mip[(y + 1) * width + x] ?? 0) * 0.25;
      const gradient = Math.abs((mip[(y + 2) * width + x] ?? 0) - (mip[(y - 2) * width + x] ?? 0));
      const score = intensity * 0.5 + gradient * 2.1 - Math.abs(y - expected) * 10;
      if (score > bestScore) {
        bestScore = score;
        bestY = y;
      }
    }

    if (bestY >= 0 && bestScore >= 620) {
      yByX[x] = bestY;
      valid[x] = 1;
      scoreByX[x] = bestScore;
      confidenceByX[x] = clamp((bestScore - 620) / 1800, 0, 1);
    } else if (bestScore > 0) {
      scoreByX[x] = bestScore;
    }
  }

  let firstValid = -1;
  let lastValid = -1;
  for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 1) {
    if (!valid[x]) continue;
    if (firstValid < 0) firstValid = x;
    lastValid = x;
  }
  if (firstValid < 0 || lastValid < 0) return null;

  const rawDomain = resolveCurveDomain(scoreByX, jawBounds.minX, jawBounds.maxX, firstValid, lastValid) ?? {
    minX: firstValid,
    maxX: lastValid,
  };
  const domainPadding = Math.round(Math.max(18, (rawDomain.maxX - rawDomain.minX) * 0.08));
  const domain = {
    minX: Math.max(jawBounds.minX, rawDomain.minX - domainPadding),
    maxX: Math.min(jawBounds.maxX, rawDomain.maxX + domainPadding),
  };

  extendCurveEdges(yByX, valid, domain.minX, domain.maxX, height, template);

  interpolateMissingCurve(yByX, valid, domain.minX, domain.maxX);
  smoothCurve(yByX, domain.minX, domain.maxX, 10);
  const smoothedConfidence = smoothProjectionProfile(confidenceByX, domain.minX, domain.maxX, 12);

  let validCount = 0;
  for (let x = domain.minX; x <= domain.maxX; x += 1) {
    if (valid[x]) validCount += 1;
  }
  if (validCount < Math.max(12, (domain.maxX - domain.minX) * 0.08)) return null;

  let tracedMin = Number.POSITIVE_INFINITY;
  let tracedMax = Number.NEGATIVE_INFINITY;
  for (let x = domain.minX; x <= domain.maxX; x += 1) {
    const value = yByX[x] ?? 0;
    if (value < tracedMin) tracedMin = value;
    if (value > tracedMax) tracedMax = value;
  }
  if (!Number.isFinite(tracedMin) || !Number.isFinite(tracedMax)) return null;
  if (tracedMax - tracedMin < template.radiusY * 0.18) return null;

  return (t: number) => {
    const x = clamp(domain.minX + t * (domain.maxX - domain.minX), 0, width - 1);
    const templateSample = sampleTemplateCurve(template, x, height);
    const edgeBias = Math.abs(t - 0.5) * 2;
    const localConfidence = clamp(sampleCurve(smoothedConfidence, x), 0, 1);
    const traceWeight = clamp(0.18 + localConfidence * 0.5 + edgeBias * 0.12, 0.18, 0.8);
    const templateWeight = 1 - traceWeight;
    const baseY = sampleCurve(yByX, x) * traceWeight + templateSample.y * templateWeight;
    const leftY =
      sampleCurve(yByX, clamp(x - 3, 0, width - 1)) * traceWeight +
      sampleTemplateCurve(template, clamp(x - 3, 0, width - 1), height).y * templateWeight;
    const rightY =
      sampleCurve(yByX, clamp(x + 3, 0, width - 1)) * traceWeight +
      sampleTemplateCurve(template, clamp(x + 3, 0, width - 1), height).y * templateWeight;
    const derivative = (rightY - leftY) / 6;
    const normal = normalize2D(-derivative, 1);
    return {
      x,
      y: clamp(baseY, 0, height - 1),
      normalX: normal.x,
      normalY: normal.y,
    };
  };
}

function resolveCurveDomain(
  scores: Float32Array,
  startX: number,
  endX: number,
  firstValid: number,
  lastValid: number,
): { minX: number; maxX: number } | null {
  const smoothed = smoothProjectionProfile(scores, startX, endX, 14);
  const peak = peakProjectionValue(smoothed, firstValid, lastValid);
  if (peak <= 0) return null;

  const threshold = Math.max(peak * 0.2, 520);
  const relaxedThreshold = Math.max(peak * 0.14, 420);
  let minX = -1;
  let maxX = -1;

  for (let x = firstValid; x <= lastValid; x += 1) {
    if ((smoothed[x] ?? 0) < relaxedThreshold) continue;
    if (minX < 0) minX = x;
    maxX = x;
  }

  if (minX < 0 || maxX < 0 || maxX - minX < 128) {
    minX = -1;
    maxX = -1;
    for (let x = firstValid; x <= lastValid; x += 1) {
      if ((smoothed[x] ?? 0) < threshold) continue;
      if (minX < 0) minX = x;
      maxX = x;
    }
  }

  if (minX < 0 || maxX < 0 || maxX - minX < 96) return null;

  return {
    minX,
    maxX,
  };
}

function resolvePanoramaTraceThreshold(mip: Uint16Array, jawBounds: VolumeBounds, width: number): number {
  let max = 0;
  let total = 0;
  let count = 0;

  for (let y = jawBounds.minY; y <= jawBounds.maxY; y += 3) {
    const rowOffset = y * width;
    for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 3) {
      const value = mip[rowOffset + x] ?? 0;
      if (value > max) max = value;
      total += value;
      count += 1;
    }
  }

  const mean = total / Math.max(1, count);
  return clamp(Math.round(mean + (max - mean) * 0.28), 1300, 2600);
}

function findDenseBandCenter(
  mip: Uint16Array,
  width: number,
  x: number,
  startY: number,
  endY: number,
  threshold: number,
): { centerY: number; score: number } | null {
  let first = -1;
  let last = -1;
  let peak = 0;
  let weightedY = 0;
  let weightedTotal = 0;

  for (let y = startY; y <= endY; y += 1) {
    const value =
      (mip[y * width + x] ?? 0) * 0.5 +
      (mip[Math.max(0, y - 1) * width + x] ?? 0) * 0.25 +
      (mip[Math.min(endY, y + 1) * width + x] ?? 0) * 0.25;
    if (value < threshold) continue;
    if (first < 0) first = y;
    last = y;
    if (value > peak) peak = value;
    weightedY += y * value;
    weightedTotal += value;
  }

  if (first < 0 || last < 0) return null;
  const span = last - first + 1;
  if (span < 4) return null;

  const centerY = Math.round(weightedTotal > 0 ? weightedY / weightedTotal : (first + last) * 0.5);
  const edgeGradient = Math.abs(
    (mip[Math.min(endY, last + 2) * width + x] ?? 0) - (mip[Math.max(startY, first - 2) * width + x] ?? 0),
  );
  return {
    centerY,
    score: peak * 0.72 + span * 24 + edgeGradient * 0.42,
  };
}

function estimateOcclusalSlice(volume: LoadedVolume, jawBounds: VolumeBounds): number {
  const candidates = [3000, 2600, 2200, 1800];
  let best: SliceDensity | null = null;

  for (const threshold of candidates) {
    const slices = sliceDensities(volume, jawBounds, threshold);
    const candidate = slices.reduce<SliceDensity | null>(
      (current, entry) => (current === null || entry.count > current.count ? entry : current),
      null,
    );
    if (candidate && candidate.count > 800) {
      best = candidate;
      break;
    }
  }

  return best?.z ?? Math.round((jawBounds.minZ + jawBounds.maxZ) / 2);
}

function sliceDensities(
  volume: LoadedVolume,
  jawBounds: VolumeBounds,
  threshold: number,
): SliceDensity[] {
  const [width, height] = volume.meta.dimensions;
  const out: SliceDensity[] = [];

  for (let z = jawBounds.minZ; z <= jawBounds.maxZ; z += 1) {
    let count = 0;
    const planeOffset = z * width * height;
    for (let y = jawBounds.minY; y <= jawBounds.maxY; y += 1) {
      const rowOffset = planeOffset + y * width;
      for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 1) {
        if ((volume.voxels[rowOffset + x] ?? 0) >= threshold) count += 1;
      }
    }
    out.push({ z, count });
  }

  return out;
}

function buildAxialGuideProjection(
  volume: LoadedVolume,
  centerZ: number,
  halfDepth: number,
): Uint16Array {
  const [width, height, depth] = volume.meta.dimensions;
  const out = new Uint16Array(width * height);
  const second = new Uint16Array(width * height);
  const third = new Uint16Array(width * height);
  const start = clamp(centerZ - halfDepth, 0, depth - 1);
  const end = clamp(centerZ + halfDepth, 0, depth - 1);

  for (let z = start; z <= end; z += 1) {
    const offset = z * width * height;
    for (let index = 0; index < width * height; index += 1) {
      const value = volume.voxels[offset + index] ?? 0;
      if (value >= out[index]) {
        third[index] = second[index];
        second[index] = out[index];
        out[index] = value;
      } else if (value >= second[index]) {
        third[index] = second[index];
        second[index] = value;
      } else if (value > third[index]) {
        third[index] = value;
      }
    }
  }

  for (let index = 0; index < out.length; index += 1) {
    out[index] = Math.round(out[index] * 0.52 + second[index] * 0.33 + third[index] * 0.15);
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
    if (previous >= 0 && x - previous > 1) {
      const from = values[previous] ?? 0;
      const to = values[x] ?? 0;
      for (let fill = previous + 1; fill < x; fill += 1) {
        const ratio = (fill - previous) / (x - previous);
        values[fill] = from + (to - from) * ratio;
      }
    }
    previous = x;
  }
}

function extendCurveEdges(
  values: Float32Array,
  valid: Uint8Array,
  startX: number,
  endX: number,
  maxHeight: number,
  template: {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    shapeExponent: number;
  },
): void {
  let firstValid = -1;
  let secondValid = -1;
  let previousValid = -1;
  let lastValid = -1;

  for (let x = startX; x <= endX; x += 1) {
    if (!valid[x]) continue;
    if (firstValid < 0) firstValid = x;
    else if (secondValid < 0) secondValid = x;
    previousValid = lastValid;
    lastValid = x;
  }

  if (firstValid < 0 || lastValid < 0) return;

  const leftNeighbor = secondValid >= 0 ? secondValid : firstValid;
  const rightNeighbor = previousValid >= 0 ? previousValid : lastValid;
  const leftSlope =
    leftNeighbor === firstValid ? 0 : (values[leftNeighbor] - values[firstValid]) / Math.max(1, leftNeighbor - firstValid);
  const rightSlope =
    rightNeighbor === lastValid ? 0 : (values[lastValid] - values[rightNeighbor]) / Math.max(1, lastValid - rightNeighbor);
  const firstTemplate = sampleTemplateCurve(template, firstValid, maxHeight).y;
  const lastTemplate = sampleTemplateCurve(template, lastValid, maxHeight).y;
  const leftTemplateShift = values[firstValid] - firstTemplate;
  const rightTemplateShift = values[lastValid] - lastTemplate;
  const leftSpan = Math.max(1, firstValid - startX);
  const rightSpan = Math.max(1, endX - lastValid);

  for (let x = firstValid - 1; x >= startX; x -= 1) {
    const delta = firstValid - x;
    const extrapolated = values[firstValid] - leftSlope * delta;
    const templateY = sampleTemplateCurve(template, x, maxHeight).y + leftTemplateShift;
    const edgeRatio = delta / leftSpan;
    const templateWeight = clamp(0.72 + edgeRatio * 0.18, 0.72, 0.9);
    values[x] = clamp(extrapolated * (1 - templateWeight) + templateY * templateWeight, 0, maxHeight - 1);
  }

  for (let x = lastValid + 1; x <= endX; x += 1) {
    const delta = x - lastValid;
    const extrapolated = values[lastValid] + rightSlope * delta;
    const templateY = sampleTemplateCurve(template, x, maxHeight).y + rightTemplateShift;
    const edgeRatio = delta / rightSpan;
    const templateWeight = clamp(0.72 + edgeRatio * 0.18, 0.72, 0.9);
    values[x] = clamp(extrapolated * (1 - templateWeight) + templateY * templateWeight, 0, maxHeight - 1);
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

function estimatePanoramaBounds(volume: LoadedVolume): VolumeBounds {
  const dimensions = volume.meta.dimensions;
  const jawBounds = estimateJawBounds(volume);
  const occlusalZ = estimateOcclusalSlice(volume, jawBounds);
  const guide = buildAxialGuideProjection(volume, occlusalZ, 6);
  const threshold = Math.max(
    900,
    Math.min(2400, Math.round(resolvePanoramaTraceThreshold(guide, jawBounds, dimensions[0]) * 0.78)),
  );
  const projectionBounds = findProjectionDentalBounds(
    guide,
    dimensions[0],
    dimensions[1],
    jawBounds,
    threshold,
  );

  if (projectionBounds && projectionBounds.count > 200) {
    return {
      minX: clamp(projectionBounds.minX - 18, 0, dimensions[0] - 1),
      maxX: clamp(projectionBounds.maxX + 18, 0, dimensions[0] - 1),
      minY: clamp(projectionBounds.minY - 26, 0, dimensions[1] - 1),
      maxY: clamp(projectionBounds.maxY + 26, 0, dimensions[1] - 1),
      minZ: clamp(jawBounds.minZ - PANO_BOUNDS_MARGIN_Z, 0, dimensions[2] - 1),
      maxZ: clamp(jawBounds.maxZ + PANO_BOUNDS_MARGIN_Z, 0, dimensions[2] - 1),
      count: projectionBounds.count,
    };
  }

  return expandBounds(
    jawBounds,
    dimensions,
    Math.round(PANO_BOUNDS_MARGIN_X * 0.5),
    PANO_BOUNDS_MARGIN_Y,
    PANO_BOUNDS_MARGIN_Z,
  );
}

function findProjectionDentalBounds(
  projection: Uint16Array,
  width: number,
  height: number,
  searchBounds: VolumeBounds,
  threshold: number,
): VolumeBounds | null {
  const columnCounts = new Float32Array(width);
  const rowCounts = new Float32Array(height);
  let count = 0;

  for (let y = searchBounds.minY; y <= searchBounds.maxY; y += 1) {
    const rowOffset = y * width;
    for (let x = searchBounds.minX; x <= searchBounds.maxX; x += 1) {
      const value = projection[rowOffset + x] ?? 0;
      if (value < threshold) continue;
      count += 1;
      columnCounts[x] += 1;
      rowCounts[y] += 1;
    }
  }

  if (count === 0) return null;

  const smoothedColumns = smoothProjectionProfile(columnCounts, searchBounds.minX, searchBounds.maxX, 9);
  const smoothedRows = smoothProjectionProfile(rowCounts, searchBounds.minY, searchBounds.maxY, 11);
  const columnPeak = peakProjectionValue(smoothedColumns, searchBounds.minX, searchBounds.maxX);
  const rowPeak = peakProjectionValue(smoothedRows, searchBounds.minY, searchBounds.maxY);
  const minColumnCount = Math.max(3, columnPeak * 0.08);
  const minRowCount = Math.max(3, rowPeak * 0.08);
  const minX = findFirstProjectionIndex(smoothedColumns, searchBounds.minX, searchBounds.maxX, minColumnCount);
  const maxX = findLastProjectionIndex(smoothedColumns, searchBounds.minX, searchBounds.maxX, minColumnCount);
  const minY = findFirstProjectionIndex(smoothedRows, searchBounds.minY, searchBounds.maxY, minRowCount);
  const maxY = findLastProjectionIndex(smoothedRows, searchBounds.minY, searchBounds.maxY, minRowCount);

  if (minX < 0 || maxX < 0 || minY < 0 || maxY < 0 || maxX <= minX || maxY <= minY) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ: searchBounds.minZ,
    maxZ: searchBounds.maxZ,
    count,
  };
}

function smoothProjectionProfile(
  values: Float32Array,
  start: number,
  end: number,
  radius: number,
): Float32Array {
  const out = new Float32Array(values.length);

  for (let index = start; index <= end; index += 1) {
    let total = 0;
    let samples = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const sampleIndex = clamp(index + offset, start, end);
      total += values[sampleIndex] ?? 0;
      samples += 1;
    }
    out[index] = total / Math.max(1, samples);
  }

  return out;
}

function peakProjectionValue(values: Float32Array, start: number, end: number): number {
  let peak = 0;
  for (let index = start; index <= end; index += 1) {
    if ((values[index] ?? 0) > peak) peak = values[index] ?? 0;
  }
  return peak;
}

function findFirstProjectionIndex(
  values: Float32Array,
  start: number,
  end: number,
  threshold: number,
): number {
  for (let index = start; index <= end; index += 1) {
    if ((values[index] ?? 0) >= threshold) return index;
  }
  return -1;
}

function findLastProjectionIndex(
  values: Float32Array,
  start: number,
  end: number,
  threshold: number,
): number {
  for (let index = end; index >= start; index -= 1) {
    if ((values[index] ?? 0) >= threshold) return index;
  }
  return -1;
}

function resolvePanoramaZRange(
  volume: LoadedVolume,
  jawBounds: VolumeBounds,
): { minZ: number; maxZ: number } {
  const [width, height, depth] = volume.meta.dimensions;
  const counts = new Uint32Array(depth);
  const smoothed = new Float32Array(depth);
  let peak = 0;
  let peakZ = Math.round((jawBounds.minZ + jawBounds.maxZ) / 2);

  for (let z = jawBounds.minZ; z <= jawBounds.maxZ; z += 1) {
    const planeOffset = z * width * height;
    let count = 0;
    for (let y = jawBounds.minY; y <= jawBounds.maxY; y += 1) {
      const rowOffset = planeOffset + y * width;
      for (let x = jawBounds.minX; x <= jawBounds.maxX; x += 1) {
        if ((volume.voxels[rowOffset + x] ?? 0) >= 2400) count += 1;
      }
    }
    counts[z] = count;
  }

  for (let z = jawBounds.minZ; z <= jawBounds.maxZ; z += 1) {
    let total = 0;
    let samples = 0;
    for (let offset = -4; offset <= 4; offset += 1) {
      const sampleZ = clamp(z + offset, jawBounds.minZ, jawBounds.maxZ);
      total += counts[sampleZ] ?? 0;
      samples += 1;
    }
    smoothed[z] = total / Math.max(1, samples);
    if (smoothed[z] > peak) {
      peak = smoothed[z];
      peakZ = z;
    }
  }

  if (peak < 100) {
    return { minZ: jawBounds.minZ, maxZ: jawBounds.maxZ };
  }

  const occlusalZ = estimateOcclusalSlice(volume, jawBounds);
  const fullSpan = jawBounds.maxZ - jawBounds.minZ + 1;

  const resolveContiguousWindow = (ratio: number) => {
    const activeThreshold = Math.max(55, peak * ratio);
    let minZ = occlusalZ;
    let maxZ = occlusalZ;
    while (minZ > jawBounds.minZ && smoothed[minZ - 1] >= activeThreshold) minZ -= 1;
    while (maxZ < jawBounds.maxZ && smoothed[maxZ + 1] >= activeThreshold) maxZ += 1;
    return { minZ, maxZ, span: maxZ - minZ + 1 };
  };

  const tight = resolveContiguousWindow(0.18);
  const active = tight.span >= 80 ? tight : resolveContiguousWindow(0.1);
  const superiorSpan = clamp(Math.round(fullSpan * 0.24), 72, 148);
  const inferiorSpan = clamp(Math.round(fullSpan * 0.34), 108, 196);

  return {
    minZ: clamp(Math.min(active.minZ - 40, occlusalZ - superiorSpan), 0, depth - 1),
    maxZ: clamp(Math.max(active.maxZ + 56, occlusalZ + inferiorSpan), 0, depth - 1),
  };
}

function trimPanoramaRows(panorama: PanoramaImage): PanoramaImage {
  const { width, height, data, zRange } = panorama;
  if (height <= 32) return panorama;

  let firstActive = -1;
  let lastActive = -1;

  for (let row = 0; row < height; row += 1) {
    let rowMax = 0;
    let rowTotal = 0;
    for (let x = 0; x < width; x += 1) {
      const value = data[(row * width + x) * 4] ?? 0;
      rowTotal += value;
      if (value > rowMax) rowMax = value;
    }
    const rowMean = rowTotal / Math.max(1, width);
    if (rowMean >= 8 || rowMax >= 20) {
      if (firstActive < 0) firstActive = row;
      lastActive = row;
    }
  }

  if (firstActive < 0 || lastActive < 0) return panorama;

  const margin = clamp(Math.round(height * 0.08), 18, 48);
  const cropTop = clamp(firstActive - margin, 0, height - 1);
  const cropBottom = clamp(lastActive + margin, 0, height - 1);
  const croppedHeight = cropBottom - cropTop + 1;
  const targetHeight = clamp(
    Math.max(croppedHeight + margin * 2, Math.round(height * 0.78), PANO_MIN_OUTPUT_HEIGHT),
    0,
    height,
  );
  const center = Math.round((cropTop + cropBottom) * 0.5);
  const expandedTop = clamp(center - Math.floor(targetHeight / 2), 0, Math.max(0, height - targetHeight));
  const expandedBottom = clamp(expandedTop + targetHeight - 1, 0, height - 1);
  const nextHeight = expandedBottom - expandedTop + 1;
  if (nextHeight >= height - 4) return panorama;

  const nextData = new Uint8ClampedArray(width * nextHeight * 4);
  for (let row = 0; row < nextHeight; row += 1) {
    const sourceOffset = (expandedTop + row) * width * 4;
    nextData.set(data.subarray(sourceOffset, sourceOffset + width * 4), row * width * 4);
  }

  const zSpan = Math.max(1, zRange[0] - zRange[1]);
  const topRatio = expandedTop / Math.max(1, height - 1);
  const bottomRatio = expandedBottom / Math.max(1, height - 1);
  const nextTop = Math.round(zRange[0] - zSpan * topRatio);
  const nextBottom = Math.round(zRange[0] - zSpan * bottomRatio);

  return {
    ...panorama,
    height: nextHeight,
    data: nextData,
    zRange: [nextTop, nextBottom],
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
  sourceDimensions: [number, number, number];
  origin: [number, number, number];
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
    sourceDimensions: [width, height, depth],
    origin: [bounds.minX, bounds.minY, bounds.minZ],
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
  const threshold = estimatePreviewThreshold(cropped.voxels, cropped.scalarRange);
  if (maxEdge <= MAX_3D_TEXTURE_EDGE) {
    return {
      dimensions: cropped.dimensions,
      sourceDimensions: cropped.sourceDimensions,
      origin: cropped.origin,
      spacing: cropped.spacing,
      voxels: quantizePreviewVoxels(cropped.voxels, cropped.scalarRange),
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
    sourceDimensions: cropped.sourceDimensions,
    origin: cropped.origin,
    spacing: [
      cropped.spacing[0] / scale,
      cropped.spacing[1] / scale,
      cropped.spacing[2] / scale,
    ],
    voxels: quantizePreviewVoxels(out, cropped.scalarRange),
    scalarRange: cropped.scalarRange,
    threshold,
    downsampled: true,
    cropped: true,
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
