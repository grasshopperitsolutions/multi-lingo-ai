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
      'en-US': { translation: enTranslation },
      'pt-PT': { translation: ptPTTranslation },
      'es-MX': { translation: esTranslation },
      'fr-FR': { translation: frTranslation },
    },
    fallbackLng: 'en-US',
    supportedLngs: ['en-US', 'pt-PT', 'es-MX', 'fr-FR'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Detect from browser navigator, then html lang attribute
      order: ['localStorage', 'navigator', 'htmlTag'],
      // Cache in localStorage for persistence between sessions
      caches: ['localStorage'],
    },
  });

export default i18n;