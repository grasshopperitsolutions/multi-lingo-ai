import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import ptPTTranslation from './locales/pt-PT/translation.json';
import esTranslation from './locales/es/translation.json';
import frTranslation from './locales/fr/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      'pt-PT': { translation: ptPTTranslation },
      es: { translation: esTranslation },
      fr: { translation: frTranslation },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'pt-PT', 'es', 'fr'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Detect from browser navigator, then html lang attribute
      order: ['navigator', 'htmlTag'],
      // No caching — avoids localStorage (blocked in SSG/sandboxed contexts)
      caches: [],
    },
  });

export default i18n;
