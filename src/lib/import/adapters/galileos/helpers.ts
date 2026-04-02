import type { ScanFolderEntry } from '../../../../types';

const GZIP_MAGIC = 0x1f8b;

export const DEFAULT_WINDOW_LEVEL = {
  window: 3200,
  level: 1600,
} as const;

export function issue(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.name = code;
  error.code = code;
  return error;
}

export const extractText = (input: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(
    input,
  );
  return match?.[1]?.trim();
};

export const extractNumber = (
  input: string,
  tag: string,
): number | undefined => {
  const value = extractText(input, tag);
  if (!value) return undefined;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const readMaybeGzipText = async (
  entry: ScanFolderEntry,
): Promise<string> => {
  const buffer = await entry.file.arrayBuffer();
  const view = new Uint8Array(buffer);
  const isGzip = view.length >= 2 && ((view[0] << 8) | view[1]) === GZIP_MAGIC;
  if (!isGzip) return new TextDecoder().decode(view);

  const { gunzipSync } = await import('fflate');
  return new TextDecoder().decode(gunzipSync(view));
};
