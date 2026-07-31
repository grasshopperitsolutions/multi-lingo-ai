/**
 * translationService.js
 *
 * Manages dynamic loading and seeding of UI translation strings from Firestore.
 * en-US is kept as a local fallback; all other locales are fetched from
 * Firestore and cached in memory.
 */

import { getDocument, createDocument, patchDocument, getTokenOrAnonymous } from "./firestoreService";
import { getPrompt, renderTemplate } from "./promptService";
import { askAI } from "./aiService";
import { loadRemoteTranslations } from "../i18n";
import { parseAIJSON } from "../utils/parseAIJSON";
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
    console.info(`[translationService] getTranslations("${locale}") — cache hit`);
    return _cache.get(locale);
  }

  // 2. Firestore — guests get an anonymous token so translations still load
  try {
    const authToken = token ?? (await getTokenOrAnonymous());
    const doc = await getDocument(LOCALES_COLLECTION, locale, authToken);
    if (doc?.data) {
      console.info(`[translationService] getTranslations("${locale}") — loaded from Firestore`);
      _cache.set(locale, doc.data);
      return doc.data;
    }
    console.warn(`[translationService] getTranslations("${locale}") — no Firestore doc found`);
  } catch (err) {
    console.error(`[translationService] Firestore fetch failed for "${locale}": ${err.message}`);
    throw err; // Let the caller handle the error (e.g. show "app unavailable")
  }

  // 3. Fallback to local en-US
  if (locale !== "en-US") {
    console.warn(`[translationService] "${locale}" has no Firestore doc yet — falling back to local en-US until it's seeded`);
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
  if (_fillInFlight.has(locale)) {
    console.info(`[translationService] fillMissingTranslations("${locale}") — already in flight, reusing`);
    return _fillInFlight.get(locale);
  }

  const run = async () => {
    console.info(`[translationService] fillMissingTranslations("${locale}") — starting`);

    // 1. Get the canonical en-US translations
    let sourceData;
    try {
      const doc = await getDocument(LOCALES_COLLECTION, "en-US", token);
      sourceData = doc?.data ?? enTranslation;
    } catch (err) {
      console.warn(`[translationService] fillMissingTranslations("${locale}") — failed to fetch en-US source, using local bundle: ${err.message}`);
      sourceData = enTranslation;
    }

    // 2. Get the current locale translations. getDocument() resolves to
    // `null` (not a throw) on a 404, so a genuinely-missing locale doc is
    // detected here explicitly — patchDocument() below requires the doc to
    // already exist (Firestore .update()), so a missing doc must be routed
    // to seedLanguageTranslations() (full create) instead, not filled.
    let localeData;
    try {
      const doc = await getDocument(LOCALES_COLLECTION, locale, token);
      if (!doc) {
        console.warn(`[translationService] fillMissingTranslations("${locale}") — no locale doc exists yet, seeding from en-US instead of patching`);
        const seeded = await seedLanguageTranslations(locale, token);
        const seededKeyCount = Object.keys(flattenToDotPaths(seeded)).length;
        console.info(`[translationService] fillMissingTranslations("${locale}") — seeded ${seededKeyCount} keys via seedLanguageTranslations`);
        return seededKeyCount;
      }
      localeData = doc?.data ?? {};
    } catch (err) {
      console.error(`[translationService] fillMissingTranslations("${locale}") — failed to fetch existing locale doc: ${err.message}`);
      return 0;
    }

    // 3. Find everything missing — recursively, so a single new leaf key
    // inside an already-existing section (e.g. "settings.some_new_string")
    // is caught, not just whole new top-level sections.
    const missingTree = findMissingDeep(sourceData, localeData);
    if (Object.keys(missingTree).length === 0) {
      console.info(`[translationService] fillMissingTranslations("${locale}") — up to date, nothing to fill`);
      return 0;
    }
    console.info(`[translationService] fillMissingTranslations("${locale}") — found ${Object.keys(flattenToDotPaths(missingTree)).length} missing key(s), translating via AI`);

    // 4. Build a prompt to translate only what's missing
    const missingKeysJson = JSON.stringify(missingTree, null, 2);
    const promptDoc = await getPrompt('translation-fill-missing-prompt');
    const prompt = renderTemplate(promptDoc.template, { locale, missingKeysJson });

    // 5. Ask AI. maxOutputTokens is raised well above the SDK default (1024)
    // because even a "missing keys" patch can span several sections at once
    // — 1024 was silently truncating the JSON response (see seedLanguageTranslations).
    const aiResponse = await askAI(
      token,
      prompt,
      {
        provider: "gemini",
        model: promptDoc.model || "gemini-3.5-flash-lite",
        temperature: 0.1,
        jsonMode: true,
        maxOutputTokens: promptDoc.maxTokens ?? 4096,
      }
    );

    let translatedTree;
    try {
      translatedTree = typeof aiResponse?.text === "string"
        ? parseAIJSON(aiResponse.text)
        : aiResponse;
    } catch (err) {
      console.error(`[translationService] fillMissingTranslations("${locale}") — failed to parse AI response as JSON: ${err.message}. Raw: ${String(aiResponse?.text).slice(0, 300)}`);
      throw err;
    }

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

    console.info(`[translationService] fillMissingTranslations("${locale}") — patched ${Object.keys(dotPatch).length} key(s)`);
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

  console.info(`[translationService] seedLanguageTranslations("${locale}") — starting`);

  // 1. Get the canonical en-US translations
  let sourceData;
  try {
    const doc = await getDocument(LOCALES_COLLECTION, "en-US", token);
    sourceData = doc?.data ?? enTranslation;
  } catch (err) {
    // Firestore unavailable — use local fallback
    console.warn(`[translationService] seedLanguageTranslations("${locale}") — failed to fetch en-US source, using local bundle: ${err.message}`);
    sourceData = enTranslation;
  }

  // 2. Build the AI prompt
  const sourceJson = JSON.stringify(sourceData, null, 2);
  const promptDoc = await getPrompt('translation-seed-language-prompt');
  const prompt = renderTemplate(promptDoc.template, { locale, sourceJson });

  // 3. Ask AI. The full en-US source is ~34KB; translated output can run
  // close to that size too. The SDK's default maxOutputTokens (1024) badly
  // truncated the response — even 8192 wasn't enough (confirmed live: cut
  // off at ~29KB/34KB). Raised further with headroom for verbose target
  // languages.
  const aiResponse = await askAI(
    token,
    prompt,
    {
      provider: "gemini",
      model: promptDoc.model || "gemini-3.5-flash-lite",
      temperature: 0.1,
      jsonMode: true,
      maxOutputTokens: promptDoc.maxTokens ?? 16384,
    }
  );

  // The API returns the JSON string inside the \`text\` field
  let translatedData;
  try {
    translatedData = typeof aiResponse?.text === "string"
      ? parseAIJSON(aiResponse.text)
      : aiResponse;
  } catch (err) {
    console.error(`[translationService] seedLanguageTranslations("${locale}") — failed to parse AI response as JSON: ${err.message}. Raw: ${String(aiResponse?.text).slice(0, 300)}`);
    throw err;
  }

  if (!translatedData || typeof translatedData !== "object") {
    throw new Error(
      "[translationService] AI response did not return a valid JSON object"
    );
  }

  // 4. Persist to Firestore
  const created = await createDocument(LOCALES_COLLECTION, translatedData, locale, token);

  // Warm the cache
  _cache.set(locale, translatedData);

  console.info(`[translationService] seedLanguageTranslations("${locale}") — created locale doc with ${Object.keys(flattenToDotPaths(translatedData)).length} key(s)`);

  return created?.data ?? translatedData;
}