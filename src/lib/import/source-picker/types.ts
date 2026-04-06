import type { ScanFolderSource } from '../../../types';

export interface ScanFolderPicker {
  supported: boolean;
  pickSource(): Promise<ScanFolderSource | null>;
}
