import type {
  ScanFolderEntry,
  ScanFolderSource,
  Vec3,
} from '../../../../types';
import type { ImportFailure } from '../../types';

export const CT_VOL_NAME = 'CT_0.vol';
export const CT_STATUS_NAME = 'CtStatus.csv';
export const CONSTANTS_XML_NAME = 'Constants1100.xml';
const ONEVOLUME_MARKER = 'JmVolumeVersion=1';
const ONEVOLUME_ARRAY_HEADER = 'CArray3D';
export const ONEVOLUME_WINDOW_SCALE = 100;

export interface OneVolumeCrop {
  dimensions: Vec3;
  offset: Vec3;
}

export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('shift-jis').decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes);
  }
}

export function makeError(code: string, message: string): ImportFailure {
  const error = new Error(message) as ImportFailure;
  error.name = code;
  error.code = code;
  return error;
}

export function findEntriesByName(
  source: ScanFolderSource,
  name: string,
): ScanFolderEntry[] {
  return source.entries.filter((entry) => entry.name === name);
}

export function findSiblingEntry(
  source: ScanFolderSource,
  filePath: string,
  siblingName: string,
): ScanFolderEntry | undefined {
  const parts = filePath.split('/');
  parts.pop();
  const siblingPath = [...parts, siblingName].filter(Boolean).join('/');
  return source.entries.find(
    (entry) => (entry.relativePath || entry.name) === siblingPath,
  );
}

export function parseXmlValue(xml: string, tag: string): string | undefined {
  const attributeMatch = new RegExp(`<${tag}[^>]*value="([^"]*)"`, 'i').exec(
    xml,
  );
  if (attributeMatch?.[1] != null) return attributeMatch[1].trim();

  const contentMatch = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    'i',
  ).exec(xml);
  return contentMatch?.[1]?.trim();
}

export function parseXmlNumber(xml: string, tag: string): number | undefined {
  const value = parseXmlValue(xml, tag);
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseCsvValue(csv: string, key: string): number | undefined {
  const line = csv.split(/\r?\n/).find((row) => row.startsWith(`${key},`));
  if (!line) return undefined;
  const [, rawValue] = line.split(',', 2);
  const parsed = Number.parseFloat(rawValue.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function resolveOneVolumeCrop(
  sourceDimensions: Vec3,
  bounds: [number, number, number, number, number, number],
  spacing: Vec3,
  constantsXml?: string,
): OneVolumeCrop | undefined {
  if (!constantsXml) return undefined;

  const physicalDimensions: Vec3 = [
    parseXmlNumber(constantsXml, 'dXX') ?? Number.NaN,
    parseXmlNumber(constantsXml, 'dYY') ?? Number.NaN,
    parseXmlNumber(constantsXml, 'dZZ') ?? Number.NaN,
  ];

  if (physicalDimensions.some((value) => !Number.isFinite(value))) {
    return undefined;
  }

  const targetDimensions = physicalDimensions.map((value, index) =>
    Math.max(
      1,
      Math.min(sourceDimensions[index], Math.round(value / spacing[index])),
    ),
  ) as Vec3;

  if (
    targetDimensions[0] === sourceDimensions[0] &&
    targetDimensions[1] === sourceDimensions[1] &&
    targetDimensions[2] === sourceDimensions[2]
  ) {
    return undefined;
  }

  const [xMin, xMax, yMin, yMax, zMin, zMax] = bounds;
  const asymmetryOffsets: Vec3 = [
    Math.max(0, -xMin - xMax),
    Math.max(0, -yMin - yMax),
    Math.max(0, -zMin - zMax),
  ];
  const offset = targetDimensions.map((target, index) => {
    const source = sourceDimensions[index];
    const preferred = asymmetryOffsets[index];
    return Math.max(0, Math.min(source - target, preferred));
  }) as Vec3;

  return {
    dimensions: targetDimensions,
    offset,
  };
}

export async function readOneVolumeHeader(entry: ScanFolderEntry): Promise<{
  xml: string;
  dataOffset: number;
  bounds: [number, number, number, number, number, number];
}> {
  const initial = new Uint8Array(await entry.file.slice(0, 4096).arrayBuffer());
  const markerOffset = 4;
  const markerBytes = new TextEncoder().encode(ONEVOLUME_MARKER);
  const marker = initial.subarray(
    markerOffset,
    markerOffset + markerBytes.length,
  );

  if (marker.length !== markerBytes.length) {
    throw makeError('E_ONEVOLUME_HEADER', 'invalid OneVolume header');
  }

  for (let index = 0; index < markerBytes.length; index += 1) {
    if (marker[index] !== markerBytes[index]) {
      throw makeError('E_ONEVOLUME_HEADER', 'unsupported OneVolume header');
    }
  }

  const view = new DataView(
    initial.buffer,
    initial.byteOffset,
    initial.byteLength,
  );
  const xmlLength = view.getUint32(markerOffset + markerBytes.length, true);
  const headerLength = markerOffset + markerBytes.length + 4 + xmlLength + 36;
  const headerBytes = new Uint8Array(
    await entry.file.slice(0, headerLength).arrayBuffer(),
  );
  const headerView = new DataView(
    headerBytes.buffer,
    headerBytes.byteOffset,
    headerBytes.byteLength,
  );
  const xmlStart = markerOffset + markerBytes.length + 4;
  const xmlEnd = xmlStart + xmlLength;
  const xml = decodeText(headerBytes.slice(xmlStart, xmlEnd));

  const arrayHeaderNameLength = headerView.getUint32(xmlEnd, true);
  const arrayHeaderName = decodeText(
    headerBytes.slice(xmlEnd + 4, xmlEnd + 4 + arrayHeaderNameLength),
  );

  if (arrayHeaderName !== ONEVOLUME_ARRAY_HEADER) {
    throw makeError('E_ONEVOLUME_ARRAY', 'missing OneVolume voxel header');
  }

  const boundsOffset = xmlEnd + 4 + arrayHeaderNameLength;
  const bounds = [
    headerView.getInt32(boundsOffset, true),
    headerView.getInt32(boundsOffset + 4, true),
    headerView.getInt32(boundsOffset + 8, true),
    headerView.getInt32(boundsOffset + 12, true),
    headerView.getInt32(boundsOffset + 16, true),
    headerView.getInt32(boundsOffset + 20, true),
  ] as [number, number, number, number, number, number];

  return {
    xml,
    dataOffset: boundsOffset + 24,
    bounds,
  };
}
