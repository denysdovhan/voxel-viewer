import type {
  ParsedVolumeMeta,
  ScanFolderSource,
  Vec3,
} from '../../../../types';
import type { ParsedImportResult } from '../../types';
import { getEntryPath, resolveScanId } from '../utils';
import {
  CONSTANTS_XML_NAME,
  CT_STATUS_NAME,
  CT_VOL_NAME,
  decodeText,
  findEntriesByName,
  findSiblingEntry,
  makeError,
  ONEVOLUME_WINDOW_SCALE,
  parseCsvValue,
  parseXmlNumber,
  readOneVolumeHeader,
  resolveOneVolumeCrop,
} from './helpers';

function buildOneVolumeMeta(
  source: ScanFolderSource,
  volPath: string,
  xml: string,
  bounds: [number, number, number, number, number, number],
  statusCsv?: string,
  constantsXml?: string,
): ParsedVolumeMeta {
  const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;
  const sourceDimensions: Vec3 = [
    xMax - xMin + 1,
    yMax - yMin + 1,
    zMax - zMin + 1,
  ];
  const spacing: Vec3 = [
    parseXmlNumber(xml, 'tfXGridSize') ?? 0.16,
    parseXmlNumber(xml, 'tfYGridSize') ?? 0.16,
    parseXmlNumber(xml, 'tfZGridSize') ?? 0.16,
  ];
  const slope = parseXmlNumber(xml, 'tfSystemV2HuSlope') ?? 190;
  const intercept = parseXmlNumber(xml, 'tfSystemV2HuIntercept') ?? 0;
  const scalarMin = Math.round(
    (parseXmlNumber(xml, 'MinValue') ?? -68.8329) * ONEVOLUME_WINDOW_SCALE,
  );
  const scalarMax = Math.round(
    (parseXmlNumber(xml, 'MaxValue') ?? 159.757) * ONEVOLUME_WINDOW_SCALE,
  );
  const windowCenter = parseCsvValue(
    statusCsv ?? '',
    'SliceExist_dWindowCenter',
  );
  const windowWidth = parseCsvValue(statusCsv ?? '', 'SliceExist_dWindowWidth');
  const slicePrefix = volPath.split('/').slice(0, -1).join('/');
  const crop = resolveOneVolumeCrop(
    sourceDimensions,
    bounds,
    spacing,
    constantsXml,
  );
  const dimensions = crop?.dimensions ?? sourceDimensions;

  return {
    format: 'onevolume',
    formatLabel: 'OneVolume CT',
    scanId: resolveScanId(source, {
      preferred: volPath.split('/').at(-2) || volPath,
    }),
    dimensions,
    sourceDimensions,
    sourceOffset: crop?.offset,
    spacing,
    scalarRange: [scalarMin, scalarMax],
    initialWindowLevel: {
      window:
        windowWidth == null
          ? scalarMax - scalarMin
          : Math.round(windowWidth * ONEVOLUME_WINDOW_SCALE),
      level:
        windowCenter == null
          ? Math.round((scalarMin + scalarMax) / 2)
          : Math.round(windowCenter * ONEVOLUME_WINDOW_SCALE),
    },
    nativeValueScale: {
      slope,
      intercept,
    },
    sliceCount: dimensions[2],
    bytesPerVoxel: 2,
    headerFileName: volPath,
    slicePrefix,
    sliceFiles: [volPath],
  };
}

export async function parseOneVolumeFolder(
  source: ScanFolderSource,
): Promise<ParsedImportResult> {
  const volumeEntries = findEntriesByName(source, CT_VOL_NAME);
  if (volumeEntries.length !== 1) {
    throw makeError(
      'E_ONEVOLUME_HEADER',
      `expected exactly one ${CT_VOL_NAME}, found ${volumeEntries.length}`,
    );
  }

  const volumeEntry = volumeEntries[0];
  const volumePath = getEntryPath(volumeEntry);
  const statusEntry = findSiblingEntry(source, volumePath, CT_STATUS_NAME);
  const constantsEntry = findSiblingEntry(
    source,
    volumePath,
    CONSTANTS_XML_NAME,
  );
  const [{ xml, bounds }, statusCsv, constantsXml] = await Promise.all([
    readOneVolumeHeader(volumeEntry),
    statusEntry
      ? statusEntry.file
          .arrayBuffer()
          .then((buffer) => decodeText(new Uint8Array(buffer)))
      : Promise.resolve(undefined),
    constantsEntry
      ? constantsEntry.file
          .arrayBuffer()
          .then((buffer) => decodeText(new Uint8Array(buffer)))
      : Promise.resolve(undefined),
  ]);

  return {
    meta: buildOneVolumeMeta(
      source,
      volumePath,
      xml,
      bounds,
      statusCsv,
      constantsXml,
    ),
  };
}
