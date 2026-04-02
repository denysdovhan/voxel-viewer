import type {
  VolumeWorkerErrorPayload,
  VolumeWorkerEvent,
} from '../../lib/import/types';
import type { ImportProgress } from '../../types';

export function post(progress: ImportProgress): void {
  postMessage({ type: 'progress', progress } satisfies VolumeWorkerEvent);
}

export function normalizeError(error: unknown): VolumeWorkerErrorPayload {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  ) {
    const value = error as { code?: unknown; message?: unknown };
    if (typeof value.code === 'string' && typeof value.message === 'string') {
      return { code: value.code, message: value.message };
    }
  }

  if (error instanceof Error) {
    return { code: error.name || 'E_WORKER', message: error.message };
  }

  return { code: 'E_WORKER', message: 'volume assembly failed' };
}
