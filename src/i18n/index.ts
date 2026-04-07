import i18n, { type Resource } from 'i18next';
import { initReactI18next, Trans, useTranslation } from 'react-i18next';
import {
  type Locale,
  normalizeLocale,
  persistLocale,
  resolveInitialLocale,
  SUPPORTED_LOCALES,
} from './locale';
import en from './locales/en.json';
import uk from './locales/uk.json';

const resources = {
  en: {
    translation: en,
  },
  uk: {
    translation: uk,
  },
} as const satisfies Resource;

const initialLocale = resolveInitialLocale();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LOCALES],
  nonExplicitSupportedLngs: true,
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
  returnNull: false,
});

persistLocale(initialLocale);

i18n.on('languageChanged', (language) => {
  persistLocale(normalizeLocale(language));
});

export {
  normalizeLocale,
  persistLocale,
  readStoredLocale,
  resolveBrowserLocale,
  resolveInitialLocale,
  SUPPORTED_LOCALES,
} from './locale';
export type { Locale };
export { i18n, Trans, useTranslation };
