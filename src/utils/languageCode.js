/**
 * Normalize a BCP-47-ish language code for comparison/dedup purposes:
 * lowercase the language subtag, uppercase the region subtag.
 * "en-gb" / "EN-GB" / "en-GB" all normalize to "en-GB".
 */
export function normalizeCode(code) {
  if (typeof code !== "string") return "";
  const [lang, ...rest] = code.trim().split("-");
  if (!lang) return "";
  const region = rest.join("-");
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}

/**
 * BCP-47 locale → the language's name in English, for prompts that have to
 * tell a model which language to answer in.
 *
 * English on purpose: the surrounding prompt is English, and a model handles
 * "answer in European Portuguese" far more reliably than the same instruction
 * written in Portuguese. Lifted out of examWritingExerciseService so the
 * professional tools share one map rather than copying it a third time.
 */
export const LOCALE_TO_LANGUAGE_NAME = {
  en: "English", "en-US": "English", "en-GB": "English", "en-AU": "English",
  es: "Spanish", "es-ES": "Spanish", "es-MX": "Mexican Spanish",
  fr: "French", "fr-FR": "French", "fr-CA": "Canadian French",
  pt: "European Portuguese", "pt-PT": "European Portuguese", "pt-BR": "Brazilian Portuguese",
  de: "German", "de-DE": "German",
  it: "Italian", "it-IT": "Italian",
  nl: "Dutch", "nl-NL": "Dutch",
  ca: "Catalan", "ca-ES": "Catalan",
};

/**
 * Falls back to the bare language subtag, then to English — a prompt with no
 * language named at all is worse than one naming the wrong one.
 *
 * @param {string} locale
 * @returns {string}
 */
export function resolveLanguageName(locale) {
  if (!locale) return "English";
  return (
    LOCALE_TO_LANGUAGE_NAME[locale] ??
    LOCALE_TO_LANGUAGE_NAME[locale.split("-")[0]] ??
    "English"
  );
}
