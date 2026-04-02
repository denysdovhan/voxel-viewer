import type { ParsedVolumeMeta, ScanFolderSource } from '../../../../types';
import type { ImportFailure, ParsedImportResult } from '../../types';
import { getEntryPath, inferOneVolumeScanId, resolveScanId } from '../utils';
import {
  computeDicomSliceLocation,
  findDicomEntries,
  parseImplicitLittleEndianDicom,
  resolveDicomHeaderReadLength,
  sortDicomSlices,
} from './reader';

function makeError(code: string, message: string): ImportFailure {
  const error = new Error(message) as ImportFailure;
  error.name = code;
  error.code = code;
  return error;
}

export async function parseDicomFolder(
  source: ScanFolderSource,
): Promise<ParsedImportResult> {
  const dicomEntries = findDicomEntries(source);
  if (dicomEntries.length < 2) {
    throw makeError('E_DICOM_COUNT', 'expected at least two DICOM slices');
  }

  const slices = await Promise.all(
    dicomEntries.map(async (entry) => {
      const headerBytes = await entry.file
        .slice(0, resolveDicomHeaderReadLength(entry.file.size))
        .arrayBuffer();
      const header = parseImplicitLittleEndianDicom(headerBytes, {
        requirePixelData: false,
      });
      return {
        entry,
        header,
        sliceLocation: computeDicomSliceLocation(header),
      };
    }),
  );

  const sorted = sortDicomSlices(slices);
  const first = sorted[0]?.header;
  if (!first) {
    throw makeError('E_DICOM_HEADER', 'missing DICOM header');
  }

  for (const slice of sorted) {
    if (
      slice.header.rows !== first.rows ||
      slice.header.columns !== first.columns ||
      slice.header.bitsAllocated !== first.bitsAllocated ||
      slice.header.pixelRepresentation !== first.pixelRepresentation
    ) {
      throw makeError(
        'E_DICOM_MISMATCH',
        'inconsistent DICOM slice geometry or pixel format',
      );
    }
  }

  const sliceStep =
    sorted.length > 1
      ? Math.abs(sorted[1].sliceLocation - sorted[0].sliceLocation)
      : first.pixelSpacing[0];
  const width = first.columns;
  const height = first.rows;
  const depth = sorted.length;
  const level = Math.round(first.windowCenter ?? 1600);
  const window = Math.max(1, Math.round(first.windowWidth ?? 3200));

  const meta: ParsedVolumeMeta = {
    format: 'dicom',
    formatLabel: inferOneVolumeScanId(source)
      ? 'OneVolume CT (DICOM)'
      : 'DICOM CT',
    scanId: resolveScanId(source, {
      studyDate: first.studyDate,
      studyTime: first.studyTime,
      studyId: first.studyId,
    }),
    dimensions: [width, height, depth],
    spacing: [first.pixelSpacing[1], first.pixelSpacing[0], sliceStep || 0.16],
    scalarRange: [
      Math.round(level - window / 2),
      Math.round(level + window / 2),
    ],
    initialWindowLevel: {
      window,
      level,
    },
    nativeValueScale: {
      slope: first.rescaleSlope,
      intercept: first.rescaleIntercept,
    },
    sliceCount: depth,
    bytesPerVoxel: Math.max(1, Math.round(first.bitsAllocated / 8)),
    headerFileName: getEntryPath(sorted[0].entry),
    slicePrefix: getEntryPath(sorted[0].entry)
      .split('/')
      .slice(0, -1)
      .join('/'),
    sliceFiles: sorted.map((slice) => getEntryPath(slice.entry)),
  };

  return { meta };
}
