import type {
  ParsedVolumeMeta,
  ScanFolderEntry,
  ScanFolderSource,
} from '../../../../types';
import { getEntryPath } from '../utils';
import {
  DEFAULT_WINDOW_LEVEL,
  extractNumber,
  extractText,
  issue,
  readMaybeGzipText,
} from './helpers';

const VOL_HEADER_RE = /^(.*)_vol_0$/;
const VOL_SLICE_RE = /^(.*)_vol_0_(\d+)$/;
const GWG_RE = /\.gwg$/i;

export async function parseGalileosFolder(source: ScanFolderSource): Promise<{
  meta: ParsedVolumeMeta;
}> {
  const gwgFiles = source.entries.filter((entry) => GWG_RE.test(entry.name));
  const headerFiles = source.entries.filter((entry) =>
    VOL_HEADER_RE.test(entry.name),
  );
  const sliceGroups = source.entries
    .map((entry) => {
      const match = VOL_SLICE_RE.exec(entry.name);
      return match
        ? { entry, scanId: match[1], index: Number.parseInt(match[2], 10) }
        : null;
    })
    .filter(
      (
        value,
      ): value is { entry: ScanFolderEntry; scanId: string; index: number } =>
        Boolean(value),
    );

  if (gwgFiles.length > 1) {
    throw issue(
      'E_GWG',
      `expected at most one .gwg file, found ${gwgFiles.length}`,
    );
  }
  if (headerFiles.length !== 1) {
    throw issue(
      'E_HEADER',
      `expected exactly one *_vol_0 header, found ${headerFiles.length}`,
    );
  }
  if (sliceGroups.length < 1) {
    throw issue('E_SLICES', 'expected at least one *_vol_0_### slice');
  }

  const header = headerFiles[0];
  const headerText = await readMaybeGzipText(header);
  const slicePrefix = header.name;
  const headerScanId = extractText(headerText, 'ScanID');
  const scanId = (
    headerScanId ||
    VOL_HEADER_RE.exec(header.name)?.[1] ||
    sliceGroups[0]?.scanId ||
    gwgFiles[0]?.name.replace(/\.gwg$/i, '') ||
    header.name
  ).trim();
  const sliceIndexes = sliceGroups
    .map((item) => item.index)
    .sort((a, b) => a - b);

  for (let i = 1; i < sliceIndexes.length; i += 1) {
    if (sliceIndexes[i] !== sliceIndexes[i - 1] + 1) {
      throw issue(
        'E_SLICE_GAP',
        `missing slice index ${sliceIndexes[i - 1] + 1}`,
      );
    }
  }

  const dimensionMatch = headerText.match(
    /(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)/,
  );
  const dimensions: [number, number, number] = dimensionMatch
    ? [
        Number.parseInt(dimensionMatch[1], 10),
        Number.parseInt(dimensionMatch[2], 10),
        Number.parseInt(dimensionMatch[3], 10),
      ]
    : [
        Math.round(extractNumber(headerText, 'VolSizeX') ?? 512),
        Math.round(extractNumber(headerText, 'VolSizeY') ?? 512),
        Math.round(extractNumber(headerText, 'VolSizeZ') ?? sliceGroups.length),
      ];

  const spacing: [number, number, number] = [
    extractNumber(headerText, 'VoxelSizeX') ??
      extractNumber(headerText, 'VoxelSize') ??
      extractNumber(headerText, 'Spacing') ??
      0.16,
    extractNumber(headerText, 'VoxelSizeY') ??
      extractNumber(headerText, 'VoxelSize') ??
      extractNumber(headerText, 'Spacing') ??
      0.16,
    extractNumber(headerText, 'VoxelSizeZ') ??
      extractNumber(headerText, 'VoxelSize') ??
      extractNumber(headerText, 'Spacing') ??
      0.16,
  ];
  const scalarMin =
    extractNumber(headerText, 'VoxelValueMin') ??
    extractNumber(headerText, 'ScalarMin') ??
    extractNumber(headerText, 'Min') ??
    0;
  const scalarMax =
    extractNumber(headerText, 'VoxelValueMax') ??
    extractNumber(headerText, 'ScalarMax') ??
    extractNumber(headerText, 'Max') ??
    4095;
  const sliceCount = Math.round(
    extractNumber(headerText, 'SliceCount') ??
      extractNumber(headerText, 'VolSizeZ') ??
      sliceGroups.length,
  );
  const bytesPerVoxel = extractNumber(headerText, 'BytesPerVoxel') ?? 2;

  const meta: ParsedVolumeMeta = {
    format: 'galileos',
    formatLabel: 'GALILEOS',
    scanId,
    dimensions,
    spacing,
    scalarRange: [scalarMin, scalarMax],
    initialWindowLevel: { ...DEFAULT_WINDOW_LEVEL },
    nativeValueScale: undefined,
    sliceCount,
    bytesPerVoxel,
    headerFileName: header.name,
    slicePrefix,
    sliceFiles: sliceGroups
      .sort((a, b) => a.index - b.index)
      .map((item) => getEntryPath(item.entry)),
  };

  if (
    sliceGroups.length !==
    new Set(sliceGroups.map((item) => item.entry.name)).size
  ) {
    throw issue('E_DUPLICATE', 'duplicate slice names detected');
  }

  return { meta };
}

export function matchesGalileosFolder(source: ScanFolderSource): boolean {
  const headerCount = source.entries.filter((entry) =>
    VOL_HEADER_RE.test(entry.name),
  ).length;
  const sliceCount = source.entries.filter((entry) =>
    VOL_SLICE_RE.test(entry.name),
  ).length;
  return headerCount === 1 && sliceCount > 0;
}
