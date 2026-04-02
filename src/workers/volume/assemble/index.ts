import type { LoadedVolume, ScanFormat } from '../../../types';
import type { VolumeAssemblerContext } from '../types';
import { assembleDicomVolume } from './dicom';
import { assembleGalileosVolume } from './galileos';
import { assembleOneVolumeVolume } from './onevolume';

export async function assembleByFormat(
  format: ScanFormat,
  context: VolumeAssemblerContext,
): Promise<LoadedVolume> {
  switch (format) {
    case 'dicom':
      return assembleDicomVolume(context);
    case 'galileos':
      return assembleGalileosVolume(context);
    case 'onevolume':
      return assembleOneVolumeVolume(context);
    default:
      throw new Error(`unsupported format: ${String(format)}`);
  }
}
