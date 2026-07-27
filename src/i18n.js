import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';

// Store a reference to the fillMissingTranslations function so it can be
// called when i18next detects a missing key.
let _fillMissingFn = null;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enTranslation },
    },
    fallbackLng: 'en-US',
    supportedLngs: ['en-US'],
    interpolation: {
      escapeValue: false,
    },
    // When a key is missing in the current language, try to fill it
    // by calling fillMissingTranslations (which uses AI to translate
    // the missing keys and persist them to Firestore).
    saveMissing: true,
    saveMissingHandler: (lng, ns, key) => {
      if (_fillMissingFn && lng && lng !== 'en-US' && typeof key === 'string') {
        // Fire-and-forget — don't block the UI
        _fillMissingFn(lng).catch((err) =>
          console.warn(`[i18n] saveMissingHandler failed for "${lng}": ${err.message}`)
        );
      }
    },
    detection: {
      // Detect from browser navigator, then html lang attribute
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache in localStorage for persistence between sessions
      caches: ['localStorage'],
    },
  });

/**
 * Register the fillMissingTranslations function so i18next can call it
 * when a translation key is missing.
 *
 * @param {function} fn - The fillMissingTranslations function from translationService
 */
export function registerMissingKeyHandler(fn) {
  _fillMissingFn = fn;
}

/**
 * Load remote translations for a given locale and register them with i18next.
 *
 * @param {string} locale - BCP-47 locale code, e.g. "pt-PT".
 * @param {object} translations - The translation key-value map to register.
 */
export function loadRemoteTranslations(locale, translations) {
  if (!locale || !translations) return;

  i18n.addResourceBundle(locale, 'translation', translations, true, true);

  // Ensure the locale is in the supported list so i18next doesn't fall back
  const current = i18n.options.supportedLngs ?? [];
  if (!current.includes(locale)) {
    i18n.options.supportedLngs = [...current, locale];
  }
}

export default i18n;
