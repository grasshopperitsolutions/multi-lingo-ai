// Single source of truth for all language lists and interest categories.
// To add a new language: add an entry here — all dropdowns and guards update automatically.

// All learning dialects the app can serve (used in onboarding + settings dropdowns)
export const LEARNING_LANGUAGES = [
  { value: "pt-PT", labelKey: "settings.lang_pt_pt", flag: "🇵🇹" },
  { value: "pt-BR", labelKey: "settings.lang_pt_br", flag: "🇧🇷" },
  { value: "es-ES", labelKey: "settings.lang_es_es", flag: "🇪🇸" },
  { value: "es-MX", labelKey: "settings.lang_es_mx", flag: "🇲🇽" },
  { value: "en-US", labelKey: "settings.lang_en_us", flag: "🇺🇸" },
  { value: "en-GB", labelKey: "settings.lang_en_gb", flag: "🇬🇧" },
  { value: "fr-FR", labelKey: "settings.lang_fr_fr", flag: "🇫🇷" },
  { value: "de-DE", labelKey: "settings.lang_de_de", flag: "🇩🇪" },
];

// Interface languages (UI translation files available)
export const INTERFACE_LANGUAGES = [
  { value: "en-US", labelKey: "nav.lang_en" },
  { value: "pt-PT", labelKey: "nav.lang_pt" },
  { value: "es-ES", labelKey: "nav.lang_es" },
  { value: "fr-FR", labelKey: "nav.lang_fr" },
  { value: "de-DE", labelKey: "nav.lang_de" },
];

// Dialects where Exam Training Hub is fully supported.
// Add new dialects here when exam content is ready for them.
export const EXAM_SUPPORTED_LANGUAGES = ["pt-PT"];

// Fixed interest categories — stored on the user profile for future content personalisation.
export const INTEREST_CATEGORIES = [
  { value: "general",  labelKey: "categories.general" },
  { value: "food",     labelKey: "categories.food" },
  { value: "travel",   labelKey: "categories.travel" },
  { value: "sports",   labelKey: "categories.sports" },
  { value: "tech",     labelKey: "categories.tech" },
  { value: "nature",   labelKey: "categories.nature" },
];
