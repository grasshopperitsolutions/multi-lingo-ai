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
    // No supportedLngs allowlist — the app dynamically seeds an unbounded
    // set of locales via AI (see supportedLanguagesService.seedLanguage).
    // i18next's LanguageUtils caches supportedLngs once at init() and never
    // re-reads it, so appending to it at runtime (as loadRemoteTranslations
    // used to try) has no effect: every dynamically-added locale gets
    // silently rejected from t()'s resolve hierarchy and falls back to
    // en-US — translations fetch fine, i18n.language switches fine, but
    // rendered text never changes. Leaving this unset avoids the whole
    // class of bug, since any code passed to changeLanguage() already comes
    // from a controlled source (the language picker / AI seeding flow).
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
  console.info(`[i18n] loadRemoteTranslations("${locale}") — registered resource bundle (${Object.keys(translations).length} top-level key(s))`);
}

export default i18n;
