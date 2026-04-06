import type { DirectoryPickerWindow } from '../../../types';
import { createDirectoryHandlePicker } from './directory-handle-picker';
import { createDirectoryUploadPicker } from './directory-upload-picker';
import type { ScanFolderPicker } from './types';

export type { ScanFolderPicker } from './types';

const unsupportedPicker: ScanFolderPicker = {
  supported: false,
  async pickSource() {
    return null;
  },
};

export function createDefaultScanFolderPicker(): ScanFolderPicker {
  if (typeof window !== 'undefined') {
    const handlePicker = createDirectoryHandlePicker(
      window as DirectoryPickerWindow,
    );
    if (handlePicker.supported) return handlePicker;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const uploadPicker = createDirectoryUploadPicker(window, document);
    if (uploadPicker.supported) return uploadPicker;
  }

  return unsupportedPicker;
}
