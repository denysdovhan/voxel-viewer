import type { ScanFolderEntry, ScanFolderSource } from '../../../types';
import type { VolumeWorkerFile } from '../types';

const ONEVOLUME_SCAN_PATH_PATTERN = /(^|\/)(CT_[^/]+)\/CT_0\.vol$/i;

export function getEntryPath(entry: ScanFolderEntry): string {
  return entry.relativePath || entry.name;
}

export function inferOneVolumeScanId(
  source: ScanFolderSource,
): string | undefined {
  const oneVolumeEntry = source.entries.find((entry) =>
    ONEVOLUME_SCAN_PATH_PATTERN.test(getEntryPath(entry)),
  );
  if (!oneVolumeEntry) return undefined;

  const match = ONEVOLUME_SCAN_PATH_PATTERN.exec(getEntryPath(oneVolumeEntry));
  return match?.[2];
}

export function resolveScanId(
  source: ScanFolderSource,
  fallback: {
    studyDate?: string;
    studyTime?: string;
    studyId?: string;
    preferred?: string;
  } = {},
): string {
  if (fallback.preferred) return fallback.preferred;

  const oneVolumeId = inferOneVolumeScanId(source);
  if (oneVolumeId) return oneVolumeId;

  const compactTime = (fallback.studyTime ?? '')
    .replace(/\..*$/, '')
    .slice(0, 6);
  if (fallback.studyDate && compactTime) {
    return `CT_${fallback.studyDate}${compactTime}`;
  }
  if (fallback.studyId) return fallback.studyId;
  return source.label || 'CT';
}

export async function buildWorkerFilesForPaths(
  source: ScanFolderSource,
  paths: Iterable<string>,
): Promise<VolumeWorkerFile[]> {
  const pathSet = new Set(paths);
  return Promise.all(
    source.entries
      .filter((entry) => pathSet.has(getEntryPath(entry)))
      .map(async (entry) => ({
        name: entry.name,
        path: getEntryPath(entry),
        buffer: await entry.file.arrayBuffer(),
      })),
  );
}
