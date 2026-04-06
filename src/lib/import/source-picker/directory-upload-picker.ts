import { fromFileList } from '../scan-folder';
import type { ScanFolderPicker } from './types';

type DirectoryUploadInput = HTMLInputElement & {
  showPicker?: () => void;
  webkitdirectory?: boolean;
};

const MIN_IOS_DIRECTORY_UPLOAD_VERSION = {
  major: 18,
  minor: 4,
};

function createDirectoryUploadInput(document: Document): DirectoryUploadInput {
  const input = document.createElement('input') as DirectoryUploadInput;
  input.type = 'file';
  input.multiple = true;
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  input.style.position = 'fixed';
  input.style.top = '0';
  input.style.left = '0';
  input.style.width = '1px';
  input.style.height = '1px';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  return input;
}

function resolveIOSVersion(navigator: Navigator): {
  major: number;
  minor: number;
} | null {
  const isiOSDevice =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isiOSDevice) return null;

  const match = navigator.userAgent.match(/OS (\d+)(?:[._](\d+))?/i);
  if (!match) return null;

  return {
    major: Number.parseInt(match[1] ?? '0', 10),
    minor: Number.parseInt(match[2] ?? '0', 10),
  };
}

function isAtLeastVersion(
  current: { major: number; minor: number },
  minimum: { major: number; minor: number },
) {
  return (
    current.major > minimum.major ||
    (current.major === minimum.major && current.minor >= minimum.minor)
  );
}

function supportsDirectoryUpload(document: Document, navigator: Navigator) {
  if (!('webkitdirectory' in createDirectoryUploadInput(document))) {
    return false;
  }

  const iosVersion = resolveIOSVersion(navigator);
  if (!iosVersion) return true;

  return isAtLeastVersion(iosVersion, MIN_IOS_DIRECTORY_UPLOAD_VERSION);
}

function pickDirectoryFiles(
  targetDocument: Document,
): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = createDirectoryUploadInput(targetDocument);
    let settled = false;

    const cleanup = () => {
      input.remove();
    };

    const finish = (files: FileList | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(files);
    };

    input.addEventListener(
      'change',
      () => {
        finish(input.files && input.files.length > 0 ? input.files : null);
      },
      { once: true },
    );
    input.addEventListener(
      'cancel',
      () => {
        finish(null);
      },
      { once: true },
    );

    targetDocument.body.append(input);
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
    input.click();
  });
}

export function createDirectoryUploadPicker(
  targetNavigator: Navigator,
  targetDocument: Document,
): ScanFolderPicker {
  const supported = supportsDirectoryUpload(targetDocument, targetNavigator);

  return {
    supported,
    async pickSource() {
      if (!supported) return null;

      const files = await pickDirectoryFiles(targetDocument);
      return files ? fromFileList(files) : null;
    },
  };
}
