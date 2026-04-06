import { fromFileList } from '../scan-folder';
import type { ScanFolderPicker } from './types';

type DirectoryUploadInput = HTMLInputElement & {
  webkitdirectory?: boolean;
};

function createDirectoryUploadInput(document: Document): DirectoryUploadInput {
  const input = document.createElement('input') as DirectoryUploadInput;
  input.type = 'file';
  input.multiple = true;
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('aria-hidden', 'true');
  input.className = 'hidden';
  return input;
}

function supportsDirectoryUpload(document: Document) {
  return 'webkitdirectory' in createDirectoryUploadInput(document);
}

function pickDirectoryFiles(
  targetWindow: Window,
  targetDocument: Document,
): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = createDirectoryUploadInput(targetDocument);
    let settled = false;

    const cleanup = () => {
      targetWindow.removeEventListener('focus', handleWindowFocus);
      input.remove();
    };

    const finish = (files: FileList | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(files);
    };

    const handleWindowFocus = () => {
      targetWindow.setTimeout(() => {
        finish(input.files && input.files.length > 0 ? input.files : null);
      }, 0);
    };

    input.addEventListener(
      'change',
      () => {
        finish(input.files && input.files.length > 0 ? input.files : null);
      },
      { once: true },
    );

    targetDocument.body.append(input);
    targetWindow.addEventListener('focus', handleWindowFocus, { once: true });
    input.click();
  });
}

export function createDirectoryUploadPicker(
  targetWindow: Window,
  targetDocument: Document,
): ScanFolderPicker {
  const supported = supportsDirectoryUpload(targetDocument);

  return {
    supported,
    async pickSource() {
      if (!supported) return null;

      const files = await pickDirectoryFiles(targetWindow, targetDocument);
      return files ? fromFileList(files) : null;
    },
  };
}
