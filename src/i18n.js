/**
 * i18n.js
 *
 * Bootstraps i18next with ONLY the en-US locale bundled statically.
 * en-US is the guest/fallback language — loaded at bundle time so the app
 * renders immediately without waiting for Firestore.
 *
 * All other locales are lazy-loaded from Firestore by localeService when
 * the authenticated user's interfaceLang is known.
 *
 * To load a locale dynamically after init, call:
 *   import { ensureLocaleLoaded } from './services/localeService';
 *   await ensureLocaleLoaded(langCode, token);
 *   i18n.changeLanguage(langCode);
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import enTranslation from './locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'en-US': { translation: enTranslation },
    },
    fallbackLng: 'en-US',
    supportedLngs: ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
