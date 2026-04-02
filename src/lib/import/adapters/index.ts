import type { ImportFormatAdapter } from '../types';
import { dicomFormatAdapter } from './dicom';
import { galileosFormatAdapter } from './galileos';
import { oneVolumeFormatAdapter } from './onevolume';

export const importFormatAdapters: ImportFormatAdapter[] = [
  galileosFormatAdapter,
  dicomFormatAdapter,
  oneVolumeFormatAdapter,
];

export { dicomFormatAdapter, galileosFormatAdapter, oneVolumeFormatAdapter };
