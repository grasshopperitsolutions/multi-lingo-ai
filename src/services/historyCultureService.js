/**
 * historyCultureService.js
 *
 * Backs History & Culture: short AI-written facts about the country behind the
 * language being learned, read in the user's own interface language.
 *
 * Cache-first against a shared Firestore pool, same contract as
 * storyService/grammarService: read what exists, generate only what is
 * missing, write it back so the next reader gets it for free.
 *
 * Firestore schema:
 *
 *   historyFacts/{factId}
 *     targetLang: string     // the language/country the fact is about, e.g. 'pt-PT'
 *     topicIds: string[]     // interest-category IDs it was themed on (empty when description-driven)
 *     title: string          // denormalised copy of the title in sourceLocale,
 *                            // so the pool can be listed and deduped without an N+1 fetch
 *     sourceLocale: string   // the locale the fact was originally written in
 *     status: 'ready'
 *     source: 'ai'
 *     createdAt / updatedAt
 *
 *   historyFacts/{factId}/content/{locale}
 *     locale, title, paragraphs[], source, createdAt / updatedAt
 *
 * Note the difference from storyService: a story's canonical text is in the
 * language being *learned* (that's the point — you read Portuguese). A history
 * fact is information, not reading practice, so it's written in the reader's
 * own language and `sourceLocale` records whichever language happened to be
 * first. Everything else is a translation of that.
 */

import { queryCollection, getDocument, createDocument } from './firestoreService';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { parseAIJSON } from '../utils/parseAIJSON';

export const FACTS_COLLECTION = 'historyFacts';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Short enough to read in a sitting; long enough to say something. */
const PARAGRAPH_COUNT = 3;

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

/**
 * The response shape is enforced by the Gemini API, not by asking for it in
 * the prompt: askAI sends this as `responseSchema` alongside
 * `responseMimeType: 'application/json'`, so the model cannot return markdown
 * fences, prose commentary, or the wrong field names.
 *
 * `description` is part of the schema the model sees, so per-field guidance
 * belongs here rather than as an example object pasted into the prompt.
 */
function _factSchema(paragraphCount) {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Short title, in the same language as the paragraphs.',
      },
      // Fixed count keeps a translation aligned paragraph-for-paragraph with
      // the original, the same trick storyService uses.
      paragraphs: {
        type: 'array',
        items: { type: 'string' },
        description: 'One entry per paragraph, in reading order. Plain prose, no markdown.',
        minItems: paragraphCount,
        maxItems: paragraphCount,
      },
    },
    required: ['title', 'paragraphs'],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Report how much of the pool this reader hasn't seen yet. Read-only, AI-free.
 *
 * @param {{ token: string, targetLang: string, seenFactIds?: string[] }} params
 * @returns {Promise<{ total: number, unseen: number, exhausted: boolean }>}
 */
export async function getFactPoolStatus({ token, targetLang, seenFactIds = [] }) {
  if (!token) throw new Error('[historyCultureService] token is required');
  if (!targetLang) throw new Error('[historyCultureService] targetLang is required');

  const pool = await _fetchReadyFacts(token, targetLang);
  const seen = new Set(seenFactIds);
  const unseen = pool.filter((f) => !seen.has(f.id)).length;
  return { total: pool.length, unseen, exhausted: unseen === 0 };
}

/**
 * Fetch the next unseen fact, or generate one if the pool is exhausted.
 *
 * A `description` bypasses the pool and generates to order. Whether a given
 * user may do that is a tier decision made by the caller (see
 * useTierAccess().hasUnlimitedAI) — this service just honours the request.
 *
 * Interests theme newly generated facts only; they never filter or reorder the
 * cached pool, matching the story generator.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.targetLang
 * @param {string} params.locale       - the reader's interface language
 * @param {Array<{id: string, label: string}>} [params.interests]
 * @param {string[]} [params.seenFactIds]
 * @param {string} [params.description] - custom subject; skips the cache when set
 * @returns {Promise<{ factId: string, title: string, paragraphs: string[], locale: string, source: 'db'|'ai' }>}
 */
export async function getFact({
  token,
  targetLang,
  locale,
  interests = [],
  seenFactIds = [],
  description = '',
}) {
  if (!token) throw new Error('[historyCultureService] token is required');
  if (!targetLang) throw new Error('[historyCultureService] targetLang is required');
  if (!locale) throw new Error('[historyCultureService] locale is required');

  const pool = await _fetchReadyFacts(token, targetLang);
  const existingTitles = pool.map((f) => f.title);

  if (description.trim()) {
    return _generateFact({ token, targetLang, locale, interests, existingTitles, description: description.trim() });
  }

  const seenSet = new Set(seenFactIds);

  for (const fact of pool) {
    if (seenSet.has(fact.id)) continue;

    const content = await getFactContent({
      token,
      factId: fact.id,
      sourceLocale: fact.sourceLocale,
      locale,
    });
    if (!content) continue; // no readable content and translation failed — try the next one

    return { factId: fact.id, title: content.title, paragraphs: content.paragraphs, locale: content.locale, source: 'db' };
  }

  return _generateFact({ token, targetLang, locale, interests, existingTitles });
}

/**
 * Get one fact's content in a locale, translating and caching it when that
 * locale hasn't been written yet.
 *
 * Returns null rather than throwing when the content can't be produced — the
 * caller is walking a pool and should move on to the next candidate instead of
 * failing the whole request.
 *
 * @param {{ token: string, factId: string, sourceLocale: string, locale: string }} params
 * @returns {Promise<{ title: string, paragraphs: string[], locale: string }|null>}
 */
export async function getFactContent({ token, factId, sourceLocale, locale }) {
  const collection = `${FACTS_COLLECTION}/${factId}/content`;

  const existing = await _getDocumentOrNull(collection, locale, token);
  if (existing) {
    return { title: existing.title, paragraphs: existing.paragraphs, locale };
  }

  const source = await _getDocumentOrNull(collection, sourceLocale, token);
  if (!source) return null; // root doc with no content at all — skip it

  try {
    return await _translateFact({ token, factId, source, sourceLocale, locale });
  } catch {
    // Translation failed (quota, network, malformed response). Showing the
    // fact in the language it was written in beats showing nothing.
    return { title: source.title, paragraphs: source.paragraphs, locale: sourceLocale };
  }
}

// ---------------------------------------------------------------------------
// Generation / translation
// ---------------------------------------------------------------------------

async function _generateFact({ token, targetLang, locale, interests, existingTitles, description = '' }) {
  // An explicit description wins over interests: the reader asked for
  // something specific, so interests would only dilute it.
  const subjectLine = description || interests.map((t) => t.label).join(', ');
  const avoidTitles = existingTitles.filter(Boolean).join('; ') || '(none yet)';

  const promptDoc = await getPrompt('history-culture-generate-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    explanationLang: locale,
    subject: subjectLine,
    avoidTitles,
    paragraphCount: PARAGRAPH_COUNT,
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.8,
    jsonMode: true,
    responseSchema: _factSchema(PARAGRAPH_COUNT),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.title || !Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length === 0) {
    throw new Error('[historyCultureService] AI returned an incomplete fact');
  }

  const now = new Date().toISOString();
  const title = String(parsed.title).trim();
  const paragraphs = parsed.paragraphs.map(String);

  const written = await createDocument(FACTS_COLLECTION, {
    targetLang,
    topicIds: description ? [] : interests.map((t) => t.id),
    title,
    sourceLocale: locale,
    status: 'ready',
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  }, undefined, token);

  const factId = written?.id;
  if (!factId) throw new Error('[historyCultureService] Fact write did not return an ID');

  await createDocument(`${FACTS_COLLECTION}/${factId}/content`, {
    locale,
    title,
    paragraphs,
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  }, locale, token);

  return { factId, title, paragraphs, locale, source: 'ai' };
}

async function _translateFact({ token, factId, source, sourceLocale, locale }) {
  const paragraphCount = source.paragraphs.length;

  const promptDoc = await getPrompt('history-culture-translate-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    sourceLang: sourceLocale,
    targetLocale: locale,
    title: source.title,
    paragraphsJson: JSON.stringify(source.paragraphs),
    paragraphCount,
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.3,
    jsonMode: true,
    responseSchema: _factSchema(paragraphCount),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.title || !Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length !== paragraphCount) {
    throw new Error('[historyCultureService] Translation did not match the expected paragraph count');
  }

  const now = new Date().toISOString();
  const translated = {
    locale,
    title: String(parsed.title),
    paragraphs: parsed.paragraphs.map(String),
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  };

  await createDocument(`${FACTS_COLLECTION}/${factId}/content`, translated, locale, token);

  return { title: translated.title, paragraphs: translated.paragraphs, locale };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _fetchReadyFacts(token, targetLang) {
  const result = await queryCollection(
    FACTS_COLLECTION,
    { targetLang, status: 'ready' },
    {},
    token
  );
  return result?.documents ?? [];
}

/**
 * getDocument throws on a missing document; cache-first reads need "not there
 * yet" to be a normal answer rather than an error.
 */
async function _getDocumentOrNull(collection, id, token) {
  try {
    const doc = await getDocument(collection, id, token);
    return doc ?? null;
  } catch {
    return null;
  }
}
