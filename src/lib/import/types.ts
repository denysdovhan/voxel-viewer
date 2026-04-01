import type {
  ImportProgress,
  LoadedVolume,
  ParsedVolumeMeta,
  PreparedVolumeFor3D,
} from '../../types';
import type { ImportFailure } from './parse-galileos';

export enum VolumeWorkerRequestType {
  AssembleVolume = 'assemble-volume',
}

export interface VolumeWorkerFile {
  name: string;
  path: string;
  buffer: ArrayBuffer;
}

export interface AssembleVolumeWorkerRequest {
  type: VolumeWorkerRequestType.AssembleVolume;
  files: VolumeWorkerFile[];
  meta: ParsedVolumeMeta;
}

export type VolumeWorkerRequest = AssembleVolumeWorkerRequest;

export interface VolumeWorkerProgressEvent {
  type: 'progress';
  progress: ImportProgress;
}

export interface VolumeWorkerResultEvent {
  type: 'result';
  volume: LoadedVolume;
  meta: ParsedVolumeMeta;
  prepared3D: PreparedVolumeFor3D;
}

export interface VolumeWorkerErrorPayload {
  code: string;
  message: string;
}

export interface VolumeWorkerErrorEvent {
  type: 'error';
  error: ImportFailure | VolumeWorkerErrorPayload;
}

export type VolumeWorkerEvent =
  | VolumeWorkerProgressEvent
  | VolumeWorkerResultEvent
  | VolumeWorkerErrorEvent;

export interface LoadedImport {
  volume: LoadedVolume;
  meta: ParsedVolumeMeta;
  prepared3D: PreparedVolumeFor3D;
}
