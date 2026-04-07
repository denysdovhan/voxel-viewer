export const SUPPORTED_LOCALES = ['en', 'uk'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_STORAGE_KEY = 'voxel-viewer.locale';

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && SUPPORTED_LOCALES.includes(value as Locale)
  );
}

export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return 'en';

  const normalized = value.toLowerCase();
  if (normalized.startsWith('uk')) return 'uk';
  if (normalized.startsWith('en')) return 'en';
  return 'en';
}

export function readStoredLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function persistLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage failures.
  }
}

export function resolveBrowserLocale(
  preferredLocales: readonly string[] = typeof navigator !== 'undefined'
    ? navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language]
    : ['en'],
): Locale {
  for (const candidate of preferredLocales) {
    const resolved = normalizeLocale(candidate);
    if (resolved === 'uk') return 'uk';
    if (resolved === 'en') return 'en';
  }

  return 'en';
}

export function resolveInitialLocale(): Locale {
  return readStoredLocale() ?? resolveBrowserLocale();
}
