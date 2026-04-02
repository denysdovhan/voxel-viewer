import type { ScanFolderSource } from '../../../../types';
import {
  type AssembleVolumeWorkerRequest,
  type ImportFormatAdapter,
  type ParsedImportResult,
  VolumeWorkerRequestType,
} from '../../types';
import { buildWorkerFilesForPaths } from '../utils';
import { CT_VOL_NAME, findEntriesByName } from './helpers';
import { parseOneVolumeFolder } from './parser';

async function buildOneVolumeWorkerRequest(
  source: ScanFolderSource,
  parsed: ParsedImportResult,
): Promise<AssembleVolumeWorkerRequest> {
  return {
    type: VolumeWorkerRequestType.AssembleVolume,
    format: 'onevolume',
    files: await buildWorkerFilesForPaths(source, parsed.meta.sliceFiles),
    meta: parsed.meta,
  };
}

export const oneVolumeFormatAdapter: ImportFormatAdapter = {
  id: 'onevolume',
  label: 'OneVolume CT',
  matches(source) {
    return findEntriesByName(source, CT_VOL_NAME).length === 1;
  },
  parse: parseOneVolumeFolder,
  buildWorkerRequest: buildOneVolumeWorkerRequest,
};
