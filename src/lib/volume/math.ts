import type { SliceWindowLevel } from '../../types';

const DEFAULT_WINDOW = 3500;
const DEFAULT_LEVEL = 1800;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function resolveWindowLevel(
  windowLevel?: Partial<SliceWindowLevel>,
): SliceWindowLevel {
  return {
    window: Math.max(1, windowLevel?.window ?? DEFAULT_WINDOW),
    level: windowLevel?.level ?? DEFAULT_LEVEL,
  };
}

export function mapIntensityToGray(
  value: number,
  window: number,
  level: number,
): number {
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

export function grayToRgba(
  gray: ArrayLike<number>,
  out?: Uint8ClampedArray,
): Uint8ClampedArray {
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
