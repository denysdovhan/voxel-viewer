import type { DirectoryPickerWindow } from '../../../types';
import { fromDirectoryHandle } from '../scan-folder';
import type { ScanFolderPicker } from './types';

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

export function createDirectoryHandlePicker(
  targetWindow: DirectoryPickerWindow,
): ScanFolderPicker {
  const supported = typeof targetWindow.showDirectoryPicker === 'function';

  return {
    supported,
    async pickSource() {
      const picker = targetWindow.showDirectoryPicker;
      if (!picker) return null;

      try {
        const handle = await picker.call(targetWindow);
        return await fromDirectoryHandle(handle);
      } catch (error) {
        if (isAbortError(error)) return null;
        throw error;
      }
    },
  };
}
