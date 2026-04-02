import type { ImportProgress, SliceWindowLevel, ViewerSlices } from './types';
import { ImportStage } from './types';

export const APP_ROUTES = {
  import: '/',
  viewer: '/viewer',
} as const;

export const DISCLAIMER_TEXT =
  'Reference only. Not for diagnosis, treatment planning, measurements, or implant workflows.';

export const PLANE_COLORS = {
  axial: '#38bdf8',
  coronal: '#f59e0b',
  sagittal: '#a78bfa',
} as const;

export const IDLE_PROGRESS: ImportProgress = {
  stage: ImportStage.Idle,
  detail: 'Select a supported CT folder to begin',
  completed: 0,
  total: 1,
};

export const EMPTY_SLICES: ViewerSlices = {
  axial: null,
  coronal: null,
  sagittal: null,
};

export const DEFAULT_WINDOW_LEVEL: SliceWindowLevel = {
  window: 3200,
  level: 1600,
};

export const WINDOW_MIN = 256;
export const WINDOW_MAX = 4095;
export const LEVEL_MIN = 0;
export const LEVEL_MAX = 4095;
export const DEFAULT_MPR_ZOOM = 1;
