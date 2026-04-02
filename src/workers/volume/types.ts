import type {
  VolumeWorkerFile,
  VolumeWorkerRequest,
} from '../../lib/import/types';
import type { LoadedVolume } from '../../types';

export type WorkerVolumeMeta = VolumeWorkerRequest['meta'];

export interface VolumeAssemblerContext {
  meta: WorkerVolumeMeta;
  files: VolumeWorkerFile[];
}

export type VolumeAssembler = (
  context: VolumeAssemblerContext,
) => Promise<LoadedVolume>;
