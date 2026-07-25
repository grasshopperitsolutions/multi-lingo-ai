/**
 * localeService.js
 *
 * Handles fetching, caching, seeding, and registering i18n locale bundles.
 *
 * Cache strategy:
 *   - Check sessionStorage first (locale:{langCode}) — avoids repeat Firestore reads
 *     within the same tab session.
 *   - On miss: fetch from Firestore appConfig/config/locales/{langCode}, store in
 *     sessionStorage, then register with i18next addResourceBundle.
 *
 * Seeding:
 *   - seedLocaleIfMissing: one-shot seed from a provided translation object.
 *   - seedLocaleForNewLanguage: AI-generated translation via Gemini when a new
 *     supported language is added by an admin.
 */

import { getDocument, createDocument } from './firestoreService';
import { askAI } from './aiService';

const LOCALES_COLLECTION = 'appConfig/config/locales';
const SESSION_KEY = (code) => `locale:${code}`;

// ---------------------------------------------------------------------------
// getLocale
// Fetch a raw locale translation object from Firestore.
// Returns the data object or null.
// ---------------------------------------------------------------------------
export async function getLocale(langCode, token) {
  const result = await getDocument(LOCALES_COLLECTION, langCode, token);
  return result?.data ?? null;
}

// ---------------------------------------------------------------------------
// ensureLocaleLoaded
// The main entry point for lazy-loading a locale into i18next.
//
// Flow:
//   1. If i18next already has the bundle → no-op.
//   2. Check sessionStorage → register from cache if present.
//   3. Otherwise fetch from Firestore → cache → register.
//
// Returns true if the locale was successfully loaded, false otherwise.
// ---------------------------------------------------------------------------
export async function ensureLocaleLoaded(langCode, token) {
  const i18n = (await import('../i18n')).default;

  if (i18n.hasResourceBundle(langCode, 'translation')) {
    return true;
  }

  // Try sessionStorage cache first
  try {
    const cached = sessionStorage.getItem(SESSION_KEY(langCode));
    if (cached) {
      const data = JSON.parse(cached);
      i18n.addResourceBundle(langCode, 'translation', data, true, true);
      return true;
    }
  } catch {
    // sessionStorage unavailable — continue to Firestore
  }

  // Fetch from Firestore
  const data = await getLocale(langCode, token);
  if (data) {
    try {
      sessionStorage.setItem(SESSION_KEY(langCode), JSON.stringify(data));
    } catch {
      // sessionStorage write failed — continue without cache
    }
    i18n.addResourceBundle(langCode, 'translation', data, true, true);
    return true;
  }

  console.warn(`[localeService] Locale not found in Firestore: ${langCode}`);
  return false;
}

// ---------------------------------------------------------------------------
// seedLocaleIfMissing
// One-shot seed from a provided data object.
// Used for the initial migration from bundled JSON files to Firestore.
// Does nothing if the document already exists.
// ---------------------------------------------------------------------------
export async function seedLocaleIfMissing(langCode, translationData, token) {
  const existing = await getDocument(LOCALES_COLLECTION, langCode, token);
  if (existing?.data) return { seeded: false };
  await createDocument(LOCALES_COLLECTION, translationData, langCode, token);
  return { seeded: true };
}

// ---------------------------------------------------------------------------
// seedLocaleForNewLanguage
// AI-generated translation scaffold for a newly added supported language.
// Calls Gemini (gemini-3.5-flash-lite) to translate the en-US baseline.
// Seeds the result into appConfig/config/locales/{langCode}.
// ---------------------------------------------------------------------------
export async function seedLocaleForNewLanguage(langCode, langLabel, token) {
  // Check if locale already exists
  const existing = await getDocument(LOCALES_COLLECTION, langCode, token);
  if (existing?.data) return { seeded: false };

  // Fetch en-US as the translation baseline
  const baseline = await getLocale('en-US', token);
  if (!baseline) {
    console.warn('[localeService] en-US baseline not found in Firestore — skipping AI seed');
    return { seeded: false };
  }

  const prompt = `You are a professional translator.
Translate the following JSON translation object from English into ${langLabel} (BCP-47 code: ${langCode}).

Rules:
- Keep ALL JSON keys exactly as-is (do NOT translate keys).
- Translate ONLY the string VALUES.
- Preserve all interpolation placeholders exactly (e.g. {{name}}, {{count}}, {{lang}}).
- Preserve all arrays — translate each string element inside them.
- Do NOT add or remove any keys.
- Return ONLY the translated JSON object with no markdown, no backticks, no commentary.

Source JSON:
${JSON.stringify(baseline, null, 2)}`;

  let translated;
  try {
    const aiResponse = await askAI(token, prompt, {
      provider: 'gemini',
      model: 'gemini-3.5-flash-lite',
      temperature: 0.2,
    });
    const raw = typeof aiResponse?.text === 'string' ? aiResponse.text.trim() : null;
    if (!raw) throw new Error('Empty AI response');
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    translated = JSON.parse(cleaned);
  } catch (err) {
    console.error(`[localeService] AI translation failed for ${langCode}:`, err);
    return { seeded: false };
  }

  await createDocument(LOCALES_COLLECTION, translated, langCode, token);
  return { seeded: true, langCode };
}
