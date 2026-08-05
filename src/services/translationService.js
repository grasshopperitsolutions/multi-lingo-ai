/**
 * translationService.js
 *
 * Manages dynamic loading and seeding of UI translation strings from Firestore.
 * en-US is always the local bundled file (the canonical source — it ships
 * with the deployed code and is never read from or written to Firestore).
 * All other locales are AI-translated from that local en-US source and
 * cached/persisted in Firestore.
 */

import { getDocument, createDocument, patchDocument, queryCollection, getTokenOrAnonymous } from "./firestoreService";
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

/** Renders dot-path keys as a readable, length-capped list for log lines. */
function formatKeyList(keys, limit = 15) {
  if (keys.length <= limit) return keys.join(", ");
  return `${keys.slice(0, limit).join(", ")}, +${keys.length - limit} more`;
}

// Per-chunk source size budget for seedLanguageTranslations(). Splitting the
// translation into several smaller ask-ai calls (instead of one call for the
// full ~56KB document) keeps every call well within the standard ask-ai
// timeout on its own — no dependency on raising Vercel's maxDuration or
// Fluid Compute being enabled.
const CHUNK_SIZE_BUDGET_BYTES = 10000;

/**
 * Groups the top-level sections of `sourceData` into batches whose combined
 * JSON size stays under CHUNK_SIZE_BUDGET_BYTES, so many small sections
 * (nav, common, login, ...) get sent together in one AI call while a
 * section that's already larger than the budget on its own (e.g. terms,
 * privacy) becomes its own chunk rather than being split further. Order is
 * preserved so chunking stays deterministic across runs.
 *
 * @param {object} sourceData
 * @returns {object[]} Array of chunk objects, each a subset of sourceData's top-level keys.
 */
function splitIntoChunks(sourceData) {
  const chunks = [];
  let current = {};
  let currentSize = 0;

  for (const [key, value] of Object.entries(sourceData)) {
    const size = JSON.stringify(value).length;
    if (currentSize > 0 && currentSize + size > CHUNK_SIZE_BUDGET_BYTES) {
      chunks.push(current);
      current = {};
      currentSize = 0;
    }
    current[key] = value;
    currentSize += size;
  }
  if (Object.keys(current).length > 0) chunks.push(current);

  return chunks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch UI translations for a given locale.
 *
 * 1. en-US always returns the local bundled file directly (canonical, no Firestore).
 * 2. Other locales: checks the in-memory cache first.
 * 3. Falls back to Firestore.
 * 4. Falls back to the local en-US bundle if no Firestore doc exists yet.
 *
 * @param {string} locale - BCP-47 locale code, e.g. "pt-PT".
 * @param {string} token  - Firebase ID token.
 * @returns {Promise<object>} The translation key-value map.
 */
export async function getTranslations(locale, token) {
  // en-US is always the local bundled file — it ships with the deployed
  // code, so it's the canonical source and can never drift from what's
  // actually running. Never read it from Firestore (which is only ever
  // seeded once and has no write path keeping it in sync).
  if (locale === "en-US") {
    return enTranslation;
  }

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

  // 3. No Firestore doc yet for this (non-English) locale — fall back to
  // the local en-US bundle until it's seeded.
  console.warn(`[translationService] "${locale}" has no Firestore doc yet — falling back to local en-US until it's seeded`);
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

    // 1. The canonical en-US translations are always the local bundled
    // file — never Firestore, which is only ever seeded once and has no
    // write path keeping it in sync with the deployed code.
    const sourceData = enTranslation;

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
    const missingKeyNames = Object.keys(flattenToDotPaths(missingTree));
    console.info(`[translationService] fillMissingTranslations("${locale}") — found ${missingKeyNames.length} missing key(s), translating via AI: ${formatKeyList(missingKeyNames)}`);

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
    const patchKeyNames = Object.keys(dotPatch);
    console.info(`[translationService] fillMissingTranslations("${locale}") — writing ${patchKeyNames.length} key(s) to Firestore: ${formatKeyList(patchKeyNames)}`);
    try {
      await patchDocument(LOCALES_COLLECTION, locale, dotPatch, token);
    } catch (err) {
      console.error(`[translationService] fillMissingTranslations("${locale}") — Firestore write FAILED for ${patchKeyNames.length} key(s) (${formatKeyList(patchKeyNames)}): ${err.message}`);
      throw err;
    }
    console.info(`[translationService] fillMissingTranslations("${locale}") — Firestore write confirmed for ${patchKeyNames.length} key(s): ${formatKeyList(patchKeyNames)}`);

    // 7. Update cache and push the fill live into i18next so the
    // currently-open session reflects it immediately, no reload needed.
    const mergedData = deepMergeClone(localeData, translatedTree);
    _cache.set(locale, mergedData);
    loadRemoteTranslations(locale, mergedData);

    return patchKeyNames.length;
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
 * 1. Use the local en-US bundle as the canonical source.
 * 2. Split it into small chunks (splitIntoChunks) and translate each via a
 *    separate ask-ai call — the full ~56KB source in one call kept running
 *    past the standard ask-ai timeout regardless of Vercel duration/plan
 *    settings, so several small calls replace the one big one.
 * 3. Merge the translated chunks in memory and persist the full document to
 *    Firestore in a single write (same "hard overwrite" semantics as before —
 *    no partial doc is ever visible to readers).
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

  // 1. The canonical en-US translations are always the local bundled
  // file — never Firestore, which is only ever seeded once and has no
  // write path keeping it in sync with the deployed code.
  const sourceData = enTranslation;

  // 2. Translate in small chunks, one ask-ai call per chunk — same
  // JSON-subtree-in/JSON-subtree-out prompt already used successfully by
  // fillMissingTranslations for arbitrary subtrees.
  const chunks = splitIntoChunks(sourceData);
  const promptDoc = await getPrompt('translation-fill-missing-prompt');

  console.info(`[translationService] seedLanguageTranslations("${locale}") — translating in ${chunks.length} chunk(s)`);

  const translatedData = {};
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const missingKeysJson = JSON.stringify(chunk, null, 2);
    const prompt = renderTemplate(promptDoc.template, { locale, missingKeysJson });

    const aiResponse = await askAI(
      token,
      prompt,
      {
        provider: "gemini",
        model: promptDoc.model || "gemini-3.5-flash-lite",
        temperature: 0.1,
        jsonMode: true,
        maxOutputTokens: promptDoc.maxTokens ?? 8192,
      }
    );

    // The API returns the JSON string inside the `text` field
    let translatedChunk;
    try {
      translatedChunk = typeof aiResponse?.text === "string"
        ? parseAIJSON(aiResponse.text)
        : aiResponse;
    } catch (err) {
      console.error(`[translationService] seedLanguageTranslations("${locale}") — failed to parse AI response for chunk ${i + 1}/${chunks.length}: ${err.message}. Raw: ${String(aiResponse?.text).slice(0, 300)}`);
      throw err;
    }

    if (!translatedChunk || typeof translatedChunk !== "object") {
      throw new Error(
        `[translationService] AI response for chunk ${i + 1}/${chunks.length} did not return a valid JSON object`
      );
    }

    Object.assign(translatedData, translatedChunk);
    console.info(`[translationService] seedLanguageTranslations("${locale}") — chunk ${i + 1}/${chunks.length} done (${Object.keys(translatedChunk).length} section(s))`);
  }

  // 3. Persist to Firestore — one write of the fully-merged document.
  const created = await createDocument(LOCALES_COLLECTION, translatedData, locale, token);

  // Warm the cache
  _cache.set(locale, translatedData);

  console.info(`[translationService] seedLanguageTranslations("${locale}") — created locale doc with ${Object.keys(flattenToDotPaths(translatedData)).length} key(s)`);

  return created?.data ?? translatedData;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Re-translate the full local en-US source and hard-overwrite every given
 * language's Firestore locale doc from scratch (admin "force resync" action).
 *
 * Unlike fillMissingTranslations() (incremental, presence-only diff), this
 * always re-translates and replaces the entire document — the only way to
 * propagate an edited (not just newly-added) English string into every
 * other locale. Languages are processed strictly sequentially (never
 * concurrently) to avoid hammering the AI backend with parallel requests;
 * a failure on one language is caught and recorded, never aborting the
 * batch.
 *
 * `languages` is passed in (not fetched here via getLanguages()) to avoid a
 * circular import — supportedLanguagesService.js already imports
 * seedLanguageTranslations from this file.
 *
 * @param {Array<{code: string, label?: string}>} languages - Supported languages (from getLanguages()).
 * @param {string} token - Firebase ID token.
 * @param {{ onProgress?: (update: object) => void }} [options]
 * @returns {Promise<{ total: number, succeeded: number, failed: number, results: object[] }>}
 */
export async function forceOverwriteAllTranslations(languages, token, { onProgress } = {}) {
  const targets = (languages ?? []).filter((lang) => lang.code !== "en-US");
  const total = targets.length;

  if (total === 0) {
    console.info("[translationService] forceOverwriteAllTranslations — no languages to process");
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  // Know upfront which locales already have a doc, so each result can be
  // labeled "created" vs "overwritten" instead of a generic "success".
  const existingResult = await queryCollection(LOCALES_COLLECTION, {}, {}, token);
  const existingCodes = new Set((existingResult?.documents ?? []).map((d) => d.id));

  // Seed the UI's initial "pending" state for every target before any async
  // work starts, so the admin sees the full list immediately.
  targets.forEach((lang, index) => {
    onProgress?.({
      code: lang.code,
      label: lang.label ?? lang.code,
      status: "pending",
      resultType: null,
      errorMessage: null,
      index,
      total,
    });
  });

  const results = [];

  for (let index = 0; index < targets.length; index++) {
    const lang = targets[index];
    const resultType = existingCodes.has(lang.code) ? "overwritten" : "created";

    onProgress?.({
      code: lang.code,
      label: lang.label ?? lang.code,
      status: "in-progress",
      resultType,
      errorMessage: null,
      index,
      total,
    });

    const startedAt = Date.now();
    try {
      await attemptSeedWithRetry(lang.code, token);
      const item = {
        code: lang.code,
        label: lang.label ?? lang.code,
        status: "success",
        resultType,
        errorMessage: null,
        durationMs: Date.now() - startedAt,
      };
      results.push(item);
      onProgress?.({ ...item, index, total });
    } catch (err) {
      console.error(`[translationService] forceOverwriteAllTranslations — "${lang.code}" failed: ${err.message}`);
      const item = {
        code: lang.code,
        label: lang.label ?? lang.code,
        status: "error",
        resultType: null,
        errorMessage: err.message,
        durationMs: Date.now() - startedAt,
      };
      results.push(item);
      onProgress?.({ ...item, index, total });
      // Never rethrow — one bad language must not abort the batch.
    }
  }

  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.info(`[translationService] forceOverwriteAllTranslations — done: ${succeeded} succeeded, ${failed} failed (of ${total})`);

  return { total, succeeded, failed, results };
}

/**
 * seedLanguageTranslations() once, retried once more after a short delay on
 * failure — resilience against transient AI/network errors for this
 * admin-triggered batch job. Kept local (not exported) and not layered onto
 * seedLanguageTranslations() itself, since that function is also called by
 * seedLanguage() and fillMissingTranslations() — changing its retry
 * behavior would silently affect those unrelated call paths too.
 */
async function attemptSeedWithRetry(code, token) {
  try {
    return await seedLanguageTranslations(code, token);
  } catch (err) {
    console.warn(`[translationService] attemptSeedWithRetry("${code}") — first attempt failed, retrying once: ${err.message}`);
    await sleep(1500);
    return await seedLanguageTranslations(code, token);
  }
}