import type { SliceWindowLevel } from '../../types';

const HISTOGRAM_BINS = 4096;

export function resolveScalarRange(
  voxels: Int16Array,
  fallback: [number, number],
  ignoredValue?: number,
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < voxels.length; index += 1) {
    const value = voxels[index] ?? 0;
    if (ignoredValue != null && value === ignoredValue) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  return [min, max];
}

export function buildScalarHistogram(
  voxels: Int16Array,
  scalarRange: [number, number],
): Uint32Array {
  const histogram = new Uint32Array(HISTOGRAM_BINS);
  const [min, max] = scalarRange;
  const span = Math.max(1, max - min);

  for (let index = 0; index < voxels.length; index += 1) {
    const value = voxels[index] ?? 0;
    if (value < min || value > max) continue;
    const bucket = Math.max(
      0,
      Math.min(
        histogram.length - 1,
        Math.round(((value - min) / span) * (histogram.length - 1)),
      ),
    );
    histogram[bucket] += 1;
  }

  return histogram;
}

export function resolveOneVolumeWindowLevel(
  histogram: Uint32Array,
  scalarRange: [number, number],
  fallback: SliceWindowLevel,
): SliceWindowLevel {
  const total = sumHistogram(histogram);
  if (total === 0) return fallback;

  const low = resolveHistogramPercentile(histogram, total, 0.05, scalarRange);
  const high = resolveHistogramPercentile(histogram, total, 0.999, scalarRange);
  const window = Math.max(1, Math.round(high - low));
  const level = Math.round((high + low) / 2);

  return {
    window,
    level,
  };
}

function sumHistogram(histogram: Uint32Array): number {
  let total = 0;
  for (let index = 0; index < histogram.length; index += 1) {
    total += histogram[index] ?? 0;
  }
  return total;
}

function resolveHistogramPercentile(
  histogram: Uint32Array,
  total: number,
  percentile: number,
  scalarRange: [number, number],
): number {
  const threshold = Math.max(
    0,
    Math.min(total - 1, Math.floor(total * percentile)),
  );
  let cumulative = 0;

  for (let index = 0; index < histogram.length; index += 1) {
    cumulative += histogram[index] ?? 0;
    if (cumulative > threshold) {
      const ratio = histogram.length === 1 ? 0 : index / (histogram.length - 1);
      return scalarRange[0] + ratio * (scalarRange[1] - scalarRange[0]);
    }
  }

  return scalarRange[1];
}
