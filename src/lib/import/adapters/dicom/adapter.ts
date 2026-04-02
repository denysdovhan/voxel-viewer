import type { ScanFolderSource } from '../../../../types';
import {
  type AssembleVolumeWorkerRequest,
  type ImportFormatAdapter,
  type ParsedImportResult,
  VolumeWorkerRequestType,
} from '../../types';
import { buildWorkerFilesForPaths } from '../utils';
import { parseDicomFolder } from './parser';
import { findDicomEntries } from './reader';

async function buildDicomWorkerRequest(
  source: ScanFolderSource,
  parsed: ParsedImportResult,
): Promise<AssembleVolumeWorkerRequest> {
  return {
    type: VolumeWorkerRequestType.AssembleVolume,
    format: 'dicom',
    files: await buildWorkerFilesForPaths(source, parsed.meta.sliceFiles),
    meta: parsed.meta,
  };
}

export const dicomFormatAdapter: ImportFormatAdapter = {
  id: 'dicom',
  label: 'DICOM CT',
  matches(source) {
    return findDicomEntries(source).length >= 2;
  },
  parse: parseDicomFolder,
  buildWorkerRequest: buildDicomWorkerRequest,
};
