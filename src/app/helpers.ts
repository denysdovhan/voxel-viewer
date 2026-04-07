import { LEVEL_MAX, LEVEL_MIN, WINDOW_MAX, WINDOW_MIN } from '../constants';
import { i18n } from '../i18n';
import type {
  ImportIssue,
  ImportProgress,
  LoadedVolume,
  RangeBounds,
  Vec3,
  VolumeCursor,
} from '../types';
import { ImportStage } from '../types';

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function isBusy(progress: ImportProgress): boolean {
  return ![ImportStage.Idle, ImportStage.Ready, ImportStage.Error].includes(
    progress.stage,
  );
}

export function makeImportIssue(error: unknown): ImportIssue {
  if (error && typeof error === 'object') {
    const value = error as {
      code?: unknown;
      name?: unknown;
      message?: unknown;
    };

    if (typeof value.message === 'string') {
      const code =
        typeof value.code === 'string'
          ? value.code
          : typeof value.name === 'string'
            ? value.name
            : 'E_IMPORT';

      if (code === 'E_FORMAT') {
        return {
          code,
          message: i18n.t('errors.unsupportedFolderLayout'),
        };
      }

      return {
        code,
        message: value.message,
      };
    }
  }

  return {
    code: 'E_IMPORT',
    message: i18n.t('errors.failedToLoadSelectedScanFolder'),
  };
}

export function createCenterCursor(volume: LoadedVolume): VolumeCursor {
  const [x, y, z] = volume.meta.dimensions;

  return {
    x: Math.floor(x / 2),
    y: Math.floor(y / 2),
    z: Math.floor(z / 2),
  };
}

export function formatSpacing(spacing: Vec3): string {
  return spacing.map((value) => value.toFixed(2)).join(' x ');
}

export function resolveWindowBounds(volume: LoadedVolume | null): RangeBounds {
  if (!volume) return { min: WINDOW_MIN, max: WINDOW_MAX };

  const span = Math.round(
    volume.meta.scalarRange[1] - volume.meta.scalarRange[0],
  );

  return {
    min: WINDOW_MIN,
    max: Math.max(WINDOW_MAX, span, volume.meta.initialWindowLevel.window),
  };
}

export function resolveLevelBounds(volume: LoadedVolume | null): RangeBounds {
  if (!volume) return { min: LEVEL_MIN, max: LEVEL_MAX };

  return {
    min: Math.min(LEVEL_MIN, Math.floor(volume.meta.scalarRange[0])),
    max: Math.max(
      LEVEL_MAX,
      Math.ceil(volume.meta.scalarRange[1]),
      volume.meta.initialWindowLevel.level,
    ),
  };
}
