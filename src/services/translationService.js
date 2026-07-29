/**
 * translationService.js
 *
 * Manages dynamic loading and seeding of UI translation strings from Firestore.
 * en-US is kept as a local fallback; all other locales are fetched from
 * Firestore and cached in memory.
 */

import { getDocument, createDocument, patchDocument, getTokenOrAnonymous } from "./firestoreService";
import { askAI } from "./aiService";
import { loadRemoteTranslations } from "../i18n";
import enTranslation from "../locales/en/translation.json";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCALES_COLLECTION = "appConfig/config/locales";

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

/** @type {Map<string, object>} */
const _cache = new Map();

// In-flight fillMissingTranslations calls, keyed by locale — de-dupes
// concurrent triggers (a single render can hit several missing keys at once).
/** @type {Map<string, Promise<number>>} */
const _fillInFlight = new Map();

// ---------------------------------------------------------------------------
// Deep-diff / dot-notation helpers (for fillMissingTranslations)
// ---------------------------------------------------------------------------

function isPlainObject(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Nested object containing everything present in `source` but absent from
 * `target`, recursing into matching plain-object subtrees so a single new
 * leaf key inside an already-existing section is detected too (not just
 * whole new top-level sections).
 */
function findMissingDeep(source, target) {
  const missing = {};
  for (const key of Object.keys(source)) {
    if (!(key in target)) {
      missing[key] = source[key];
    } else if (isPlainObject(source[key]) && isPlainObject(target[key])) {
      const nested = findMissingDeep(source[key], target[key]);
      if (Object.keys(nested).length > 0) missing[key] = nested;
    }
  }
  return missing;
}

/** Flattens a nested object into Firestore dot-notation { "a.b.c": value } pairs. */
function flattenToDotPaths(obj, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(out, flattenToDotPaths(value, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

/** Deep-merges nested `patch` into a clone of `base`. */
function deepMergeClone(base, patch) {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? deepMergeClone(result[key], value)
      : value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch UI translations for a given locale.
 *
 * 1. Checks the in-memory cache first.
 * 2. Falls back to Firestore.
 * 3. Falls back to the local en-US bundle if nothing else is available.
 *
 * @param {string} locale - BCP-47 locale code, e.g. "pt-PT".
 * @param {string} token  - Firebase ID token.
 * @returns {Promise<object>} The translation key-value map.
 */
export async function getTranslations(locale, token) {
  // 1. In-memory cache
  if (_cache.has(locale)) {
    return _cache.get(locale);
  }

  // 2. Firestore — guests get an anonymous token so translations still load
  try {
    const authToken = token ?? (await getTokenOrAnonymous());
    const doc = await getDocument(LOCALES_COLLECTION, locale, authToken);
    if (doc?.data) {
      _cache.set(locale, doc.data);
      return doc.data;
    }
  } catch (err) {
    console.error(`[translationService] Firestore fetch failed for "${locale}": ${err.message}`);
    throw err; // Let the caller handle the error (e.g. show "app unavailable")
  }

  // 3. Fallback to local en-US
  if (locale !== "en-US") {
    console.warn(`[translationService] No translations found for "${locale}" — falling back to en-US`);
    return enTranslation;
  }

  return enTranslation;
}

/**
 * Clear the in-memory translation cache.
 * Call this when the user switches interface language so stale strings
 * are replaced on the next fetch.
 */
export function clearTranslationsCache() {
  _cache.clear();
}

/**
 * Check if a locale's translations are missing any keys that exist in en-US.
 * If missing keys are found, use AI to translate them and update Firestore.
 *
 * This keeps the Firestore cache populated as new UI strings are added to
 * the en-US source over time.
 *
 * @param {string} locale - BCP-47 locale to check, e.g. "pt-PT".
 * @param {string} token  - Firebase ID token.
 * @returns {Promise<number>} Number of missing keys that were added.
 */
export async function fillMissingTranslations(locale, token) {
  if (!token || locale === "en-US") return 0;

  // De-dupe concurrent calls for the same locale (a single render can
  // trigger several missing-key callbacks at once).
  if (_fillInFlight.has(locale)) return _fillInFlight.get(locale);

  const run = async () => {
    // 1. Get the canonical en-US translations
    let sourceData;
    try {
      const doc = await getDocument(LOCALES_COLLECTION, "en-US", token);
      sourceData = doc?.data ?? enTranslation;
    } catch {
      sourceData = enTranslation;
    }

    // 2. Get the current locale translations
    let localeData;
    try {
      const doc = await getDocument(LOCALES_COLLECTION, locale, token);
      localeData = doc?.data ?? {};
    } catch {
      // Locale doesn't exist yet — nothing to fill
      return 0;
    }

    // 3. Find everything missing — recursively, so a single new leaf key
    // inside an already-existing section (e.g. "settings.some_new_string")
    // is caught, not just whole new top-level sections.
    const missingTree = findMissingDeep(sourceData, localeData);
    if (Object.keys(missingTree).length === 0) return 0;

    // 4. Build a prompt to translate only what's missing
    const sourceJson = JSON.stringify(missingTree, null, 2);
    const prompt = `You are a professional translator. Below is a JSON object containing new UI strings that need to be added to an existing ${locale} translation file.

\`\`\`json
${sourceJson}
\`\`\`

Translate ALL string values to the locale "${locale}".

CRITICAL RULES:
- Keep the exact same JSON structure and keys — do NOT change any keys.
- Only translate the string VALUES, not the keys.
- For arrays, translate each element.
- Preserve any {{placeholders}} or interpolation variables exactly as-is.
- Return ONLY the translated JSON object — no markdown, no backticks, no commentary.`;

    // 5. Ask AI
    const aiResponse = await askAI(
      token,
      prompt,
      { provider: "gemini", model: "gemini-3.5-flash-lite", temperature: 0.1 }
    );

    const translatedTree = typeof aiResponse?.text === "string"
      ? JSON.parse(aiResponse.text)
      : aiResponse;

    if (!translatedTree || typeof translatedTree !== "object") {
      throw new Error(
        "[translationService] AI response did not return a valid JSON object"
      );
    }

    // 6. Persist only the new leaves — a surgical dot-notation patch, no
    // read-modify-write race on the full document.
    const dotPatch = flattenToDotPaths(translatedTree);
    await patchDocument(LOCALES_COLLECTION, locale, dotPatch, token);

    // 7. Update cache and push the fill live into i18next so the
    // currently-open session reflects it immediately, no reload needed.
    const mergedData = deepMergeClone(localeData, translatedTree);
    _cache.set(locale, mergedData);
    loadRemoteTranslations(locale, mergedData);

    return Object.keys(dotPatch).length;
  };

  const promise = run();
  _fillInFlight.set(locale, promise);
  try {
    return await promise;
  } finally {
    _fillInFlight.delete(locale);
  }
}

/**
 * Seed UI translations for a new language by asking AI to translate the
 * canonical en-US strings.
 *
 * Flow:
 * 1. Fetch en-US translations from Firestore (or use local fallback).
 * 2. Send the en-US JSON to AI with a translation prompt.
 * 3. Parse the AI response and persist to Firestore.
 *
 * @param {string} locale - BCP-47 locale to seed, e.g. "pt-BR".
 * @param {string} token  - Firebase ID token.
 * @returns {Promise<object>} The created Firestore document data.
 */
export async function seedLanguageTranslations(locale, token) {
  if (!token) {
    throw new Error("[translationService] Firebase ID token is required for seeding");
  }

  // 1. Get the canonical en-US translations
  let sourceData;
  try {
    const doc = await getDocument(LOCALES_COLLECTION, "en-US", token);
    sourceData = doc?.data ?? enTranslation;
  } catch {
    // Firestore unavailable — use local fallback
    sourceData = enTranslation;
  }

  // 2. Build the AI prompt
  const sourceJson = JSON.stringify(sourceData, null, 2);
  const prompt = `You are a professional translator. Below is a JSON object containing all UI strings for an application in English (en-US).

\`\`\`json
${sourceJson}
\`\`\`

Translate ALL string values to the locale "${locale}".

CRITICAL RULES:
- Keep the exact same JSON structure and keys — do NOT change any keys.
- Only translate the string VALUES, not the keys.
- For arrays (like "home.marquee"), translate each element.
- Preserve any {{placeholders}} or interpolation variables exactly as-is.
- Return ONLY the translated JSON object — no markdown, no backticks, no commentary.`;

  // 3. Ask AI
  const aiResponse = await askAI(
    token,
    prompt,
    { provider: "gemini", model: "gemini-3.5-flash-lite", temperature: 0.1 }
  );

  // The API returns the JSON string inside the \`text\` field
  const translatedData = typeof aiResponse?.text === "string"
    ? JSON.parse(aiResponse.text)
    : aiResponse;

  if (!translatedData || typeof translatedData !== "object") {
    throw new Error(
      "[translationService] AI response did not return a valid JSON object"
    );
  }

  // 4. Persist to Firestore
  const created = await createDocument(LOCALES_COLLECTION, translatedData, locale, token);

  // Warm the cache
  _cache.set(locale, translatedData);

  return created?.data ?? translatedData;
}