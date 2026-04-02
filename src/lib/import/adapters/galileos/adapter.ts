import type { ScanFolderSource } from '../../../../types';
import {
  type ImportFormatAdapter,
  type ParsedImportResult,
  VolumeWorkerRequestType,
} from '../../types';
import { buildWorkerFilesForPaths } from '../utils';
import { matchesGalileosFolder, parseGalileosFolder } from './parser';

async function buildGalileosWorkerRequest(
  source: ScanFolderSource,
  parsed: ParsedImportResult,
) {
  return {
    type: VolumeWorkerRequestType.AssembleVolume,
    format: 'galileos',
    files: await buildWorkerFilesForPaths(source, parsed.meta.sliceFiles),
    meta: parsed.meta,
  } as const;
}

export const galileosFormatAdapter: ImportFormatAdapter = {
  id: 'galileos',
  label: 'GALILEOS',
  matches: matchesGalileosFolder,
  async parse(source) {
    const parsed = await parseGalileosFolder(source);
    return { meta: parsed.meta };
  },
  buildWorkerRequest: buildGalileosWorkerRequest,
};
