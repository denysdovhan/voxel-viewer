export type FileMap = Map<string, File>;

export interface ScanFolderEntry {
  name: string;
  relativePath: string;
  file: File;
}

export interface ScanFolderSource {
  kind: 'directory-handle' | 'file-list';
  label: string;
  entries: ScanFolderEntry[];
}

export interface ParsedVolumeMeta {
  scanId: string;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  scalarRange: [number, number];
  sliceCount: number;
  bytesPerVoxel: number;
  headerFileName: string;
  slicePrefix: string;
  sliceFiles: string[];
}

export interface LoadedVolume {
  meta: ParsedVolumeMeta;
  voxels: Uint16Array;
  histogram: Uint32Array;
}

export interface ImportIssue {
  code: string;
  message: string;
}

export interface ImportProgress {
  stage:
    | 'idle'
    | 'scanning'
    | 'parsing-meta'
    | 'inflating-slices'
    | 'assembling'
    | 'preparing-3d'
    | 'ready'
    | 'error';
  detail: string;
  completed: number;
  total: number;
}

export interface VolumeCursor {
  x: number;
  y: number;
  z: number;
}

export interface SliceWindowLevel {
  window: number;
  level: number;
}

export interface SliceImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PreparedVolumeFor3D {
  dimensions: [number, number, number];
  sourceDimensions: [number, number, number];
  origin: [number, number, number];
  spacing: [number, number, number];
  voxels: Uint8Array;
  scalarRange: [number, number];
  downsampled: boolean;
  cropped: boolean;
  threshold: number;
}
