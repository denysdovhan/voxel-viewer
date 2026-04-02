import type {
  ImportProgress,
  LoadedVolume,
  ParsedVolumeMeta,
  PreparedVolumeFor3D,
  ScanFolderSource,
  ScanFormat,
} from '../../types';

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
  format: ScanFormat;
  files: VolumeWorkerFile[];
  meta: ParsedVolumeMeta;
}

export interface ImportFailure extends Error {
  code: string;
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

export interface ParsedImportResult {
  meta: ParsedVolumeMeta;
}

export interface ImportFormatAdapter {
  id: ScanFormat;
  label: string;
  matches(source: ScanFolderSource): boolean;
  parse(source: ScanFolderSource): Promise<ParsedImportResult>;
  buildWorkerRequest(
    source: ScanFolderSource,
    parsed: ParsedImportResult,
  ): Promise<VolumeWorkerRequest>;
}
