import type { ScanFolderEntry, ScanFolderSource } from '../../../../types';

const DICM_MAGIC = 'DICM';
const HEADER_READ_BYTES = 8192;

const TAG_BITS_ALLOCATED = '00280100';
const TAG_BITS_STORED = '00280101';
const TAG_COLUMNS = '00280011';
const TAG_IMAGE_ORIENTATION = '00200037';
const TAG_IMAGE_POSITION = '00200032';
const TAG_INSTANCE_NUMBER = '00200013';
const TAG_PIXEL_DATA = '7fe00010';
const TAG_PIXEL_REPRESENTATION = '00280103';
const TAG_PIXEL_SPACING = '00280030';
const TAG_RESCALE_INTERCEPT = '00281052';
const TAG_RESCALE_SLOPE = '00281053';
const TAG_ROWS = '00280010';
const TAG_STUDY_DATE = '00080020';
const TAG_STUDY_ID = '00200010';
const TAG_STUDY_TIME = '00080030';
const TAG_WINDOW_CENTER = '00281050';
const TAG_WINDOW_WIDTH = '00281051';

export interface DicomHeader {
  bitsAllocated: number;
  bitsStored: number;
  columns: number;
  imageOrientationPatient: [number, number, number, number, number, number];
  imagePositionPatient: [number, number, number];
  instanceNumber?: number;
  pixelDataLength: number;
  pixelDataOffset: number;
  pixelRepresentation: number;
  pixelSpacing: [number, number];
  rescaleIntercept: number;
  rescaleSlope: number;
  rows: number;
  studyDate?: string;
  studyId?: string;
  studyTime?: string;
  windowCenter?: number;
  windowWidth?: number;
}

interface ParseDicomOptions {
  requirePixelData?: boolean;
}

export interface DicomSliceEntry {
  entry: ScanFolderEntry;
  header: DicomHeader;
  sliceLocation: number;
}

function decodeAscii(
  bytes: Uint8Array,
  offset: number,
  length: number,
): string {
  return new TextDecoder('ascii')
    .decode(bytes.subarray(offset, offset + length))
    .replace(/\0/g, '')
    .trim();
}

function parseNumberList(value: string): number[] {
  return value
    .split('\\')
    .map((item) => Number.parseFloat(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function parseTag(group: number, element: number): string {
  return ((group << 16) | element).toString(16).padStart(8, '0');
}

function cross(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function resolveDicomHeaderReadLength(fileSize: number): number {
  return Math.min(fileSize, HEADER_READ_BYTES);
}

export function parseImplicitLittleEndianDicom(
  buffer: ArrayBuffer,
  options?: ParseDicomOptions,
): DicomHeader {
  const requirePixelData = options?.requirePixelData ?? true;
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let offset =
    bytes.byteLength >= 132 && decodeAscii(bytes, 128, 4) === DICM_MAGIC
      ? 132
      : 0;

  let bitsAllocated = 16;
  let bitsStored = 16;
  let columns: number | undefined;
  let imageOrientationPatient:
    | [number, number, number, number, number, number]
    | undefined;
  let imagePositionPatient: [number, number, number] | undefined;
  let instanceNumber: number | undefined;
  let pixelDataLength: number | undefined;
  let pixelDataOffset: number | undefined;
  let pixelRepresentation = 1;
  let pixelSpacing: [number, number] | undefined;
  let rescaleIntercept = 0;
  let rescaleSlope = 1;
  let rows: number | undefined;
  let studyDate: string | undefined;
  let studyId: string | undefined;
  let studyTime: string | undefined;
  let windowCenter: number | undefined;
  let windowWidth: number | undefined;

  while (offset + 8 <= buffer.byteLength) {
    const group = view.getUint16(offset, true);
    const element = view.getUint16(offset + 2, true);
    offset += 4;

    const length = view.getUint32(offset, true);
    offset += 4;

    if (offset + length > buffer.byteLength) {
      if (!requirePixelData) break;
      throw new Error('truncated DICOM element');
    }

    const tag = parseTag(group, element);
    if (tag === TAG_PIXEL_DATA) {
      pixelDataOffset = offset;
      pixelDataLength = length;
      break;
    }

    if (tag === TAG_ROWS) rows = view.getUint16(offset, true);
    else if (tag === TAG_COLUMNS) columns = view.getUint16(offset, true);
    else if (tag === TAG_BITS_ALLOCATED)
      bitsAllocated = view.getUint16(offset, true);
    else if (tag === TAG_BITS_STORED) bitsStored = view.getUint16(offset, true);
    else if (tag === TAG_PIXEL_REPRESENTATION)
      pixelRepresentation = view.getUint16(offset, true);
    else if (tag === TAG_INSTANCE_NUMBER) {
      const parsed = Number.parseInt(decodeAscii(bytes, offset, length), 10);
      if (Number.isFinite(parsed)) instanceNumber = parsed;
    } else if (tag === TAG_STUDY_DATE)
      studyDate = decodeAscii(bytes, offset, length);
    else if (tag === TAG_STUDY_ID) studyId = decodeAscii(bytes, offset, length);
    else if (tag === TAG_STUDY_TIME)
      studyTime = decodeAscii(bytes, offset, length);
    else if (tag === TAG_PIXEL_SPACING) {
      const values = parseNumberList(decodeAscii(bytes, offset, length));
      if (values.length >= 2) pixelSpacing = [values[0], values[1]];
    } else if (tag === TAG_IMAGE_POSITION) {
      const values = parseNumberList(decodeAscii(bytes, offset, length));
      if (values.length >= 3) {
        imagePositionPatient = [values[0], values[1], values[2]];
      }
    } else if (tag === TAG_IMAGE_ORIENTATION) {
      const values = parseNumberList(decodeAscii(bytes, offset, length));
      if (values.length >= 6) {
        imageOrientationPatient = [
          values[0],
          values[1],
          values[2],
          values[3],
          values[4],
          values[5],
        ];
      }
    } else if (tag === TAG_WINDOW_CENTER) {
      const parsed = Number.parseFloat(decodeAscii(bytes, offset, length));
      if (Number.isFinite(parsed)) windowCenter = parsed;
    } else if (tag === TAG_WINDOW_WIDTH) {
      const parsed = Number.parseFloat(decodeAscii(bytes, offset, length));
      if (Number.isFinite(parsed)) windowWidth = parsed;
    } else if (tag === TAG_RESCALE_INTERCEPT) {
      const parsed = Number.parseFloat(decodeAscii(bytes, offset, length));
      if (Number.isFinite(parsed)) rescaleIntercept = parsed;
    } else if (tag === TAG_RESCALE_SLOPE) {
      const parsed = Number.parseFloat(decodeAscii(bytes, offset, length));
      if (Number.isFinite(parsed) && parsed !== 0) rescaleSlope = parsed;
    }

    offset += length;
  }

  if (
    rows == null ||
    columns == null ||
    pixelSpacing == null ||
    imagePositionPatient == null ||
    imageOrientationPatient == null
  ) {
    throw new Error('missing required DICOM metadata');
  }

  if (
    requirePixelData &&
    (pixelDataOffset == null || pixelDataLength == null)
  ) {
    throw new Error('missing DICOM pixel data');
  }

  return {
    bitsAllocated,
    bitsStored,
    columns,
    imageOrientationPatient,
    imagePositionPatient,
    instanceNumber,
    pixelDataLength: pixelDataLength ?? 0,
    pixelDataOffset: pixelDataOffset ?? 0,
    pixelRepresentation,
    pixelSpacing,
    rescaleIntercept,
    rescaleSlope,
    rows,
    studyDate,
    studyId,
    studyTime,
    windowCenter,
    windowWidth,
  };
}

export function computeDicomSliceLocation(header: DicomHeader): number {
  const row = header.imageOrientationPatient.slice(0, 3) as [
    number,
    number,
    number,
  ];
  const column = header.imageOrientationPatient.slice(3, 6) as [
    number,
    number,
    number,
  ];
  return dot(header.imagePositionPatient, cross(row, column));
}

export function sortDicomSlices(entries: DicomSliceEntry[]): DicomSliceEntry[] {
  return [...entries].sort((left, right) => {
    const delta = left.sliceLocation - right.sliceLocation;
    if (Math.abs(delta) > 1e-6) return delta;
    return (
      (left.header.instanceNumber ?? 0) - (right.header.instanceNumber ?? 0)
    );
  });
}

export function findDicomEntries(source: ScanFolderSource): ScanFolderEntry[] {
  return source.entries.filter((entry) => /\.dcm$/i.test(entry.name));
}
