import type { ScanFolderEntry, ScanFolderSource } from '../../types';

type DirectoryHandleLike = {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<FileSystemHandle>;
};

type FileHandleLike = {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
};

const isDirectoryHandle = (value: unknown): value is DirectoryHandleLike =>
  Boolean(value) && typeof value === 'object' && (value as { kind?: string }).kind === 'directory' && typeof (value as { values?: unknown }).values === 'function';

const isFileHandle = (value: unknown): value is FileHandleLike =>
  Boolean(value) && typeof value === 'object' && (value as { kind?: string }).kind === 'file' && typeof (value as { getFile?: unknown }).getFile === 'function';

async function collectDirectoryEntries(handle: DirectoryHandleLike, prefix = ''): Promise<ScanFolderEntry[]> {
  const entries: ScanFolderEntry[] = [];

  for await (const item of handle.values()) {
    if (isDirectoryHandle(item)) {
      entries.push(...await collectDirectoryEntries(item, `${prefix}${item.name}/`));
      continue;
    }

    if (isFileHandle(item)) {
      const file = await item.getFile();
      entries.push({
        name: file.name,
        relativePath: `${prefix}${file.name}`,
        file,
      });
    }
  }

  return entries;
}

export async function fromDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<ScanFolderSource> {
  const entries = await collectDirectoryEntries(handle as unknown as DirectoryHandleLike);
  return {
    kind: 'directory-handle',
    label: handle.name || 'selected folder',
    entries,
  };
}

export function fromFileList(files: FileList): ScanFolderSource {
  const entries = Array.from(files, (file) => ({
    name: file.name,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    file,
  }));

  return {
    kind: 'file-list',
    label: 'selected files',
    entries,
  };
}
