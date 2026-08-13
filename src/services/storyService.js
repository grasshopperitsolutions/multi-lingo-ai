/**
 * storyService.js
 *
 * Backs the Story Generator: read + listen only, with the transcript shown in
 * both the learning language and the reader's interface language. No
 * comprehension questions.
 *
 * Cache-first against a shared Firestore pool, the same contract as
 * examExerciseService/grammarService: read what exists, generate only what is
 * missing, write it back so the next reader gets it for free.
 *
 * Firestore schema:
 *
 *   stories/{storyId}
 *     level: string              // CEFR level
 *     targetLang: string         // the language the story is written in
 *     topicIds: string[]         // interest-category IDs it was themed on (may be empty)
 *     title: string              // denormalised copy of the canonical (targetLang) title,
 *                                 // so the pool can be listed/deduped without an N+1 fetch
 *     status: 'ready'
 *     aiGenerated: true
 *     source: 'ai'
 *     createdAt / updatedAt
 *
 *   stories/{storyId}/content/{locale}
 *     locale: string
 *     title: string
 *     paragraphs: string[]
 *     source: 'ai'
 *     createdAt / updatedAt
 *
 * Two languages are in play, same distinction as grammarService:
 *   targetLang — the language being learned; the story's canonical content
 *                lives in content/{targetLang} and is generated once.
 *   locale     — whichever language a reader wants to read it in.
 *                content/{locale} for any other locale is a translation,
 *                generated on demand and cached from then on.
 */

import { queryCollection, getDocument, createDocument } from './firestoreService';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { getGrammarDescription } from './examPromptTemplates';
import { parseAIJSON } from '../utils/parseAIJSON';

export const STORIES_COLLECTION = 'stories';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Short stories at higher levels can sustain more paragraphs without feeling padded. */
const PARAGRAPH_COUNT_BY_LEVEL = { A1: 3, A2: 4, B1: 5, B2: 6, C1: 7, C2: 8 };
const DEFAULT_PARAGRAPH_COUNT = 4;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

function _storySchema(paragraphCount) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      // minItems === maxItems === the exact count asked for: this is what
      // keeps a translation aligned paragraph-for-paragraph with the
      // original, which the side-by-side reader depends on.
      paragraphs: {
        type: 'array',
        items: { type: 'string' },
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
 * Report how much of the pool this reader hasn't seen yet.
 *
 * Read-only and AI-free — it exists so the UI can tell whether the cache is
 * exhausted, which is what unlocks the custom-description input for tiers that
 * don't otherwise get it.
 *
 * @param {{ token: string, level: string, targetLang: string, seenStoryIds?: string[] }} params
 * @returns {Promise<{ total: number, unseen: number, exhausted: boolean }>}
 */
export async function getStoryPoolStatus({ token, level, targetLang, seenStoryIds = [] }) {
  if (!token) throw new Error('[storyService] token is required');
  if (!level) throw new Error('[storyService] level is required');
  if (!targetLang) throw new Error('[storyService] targetLang is required');

  const pool = await _fetchReadyStories(token, { level, targetLang });
  const seen = new Set(seenStoryIds);
  const unseen = pool.filter((s) => !seen.has(s.id)).length;
  return { total: pool.length, unseen, exhausted: unseen === 0 };
}

/**
 * Fetch the next unseen story, or generate one if the pool is exhausted.
 *
 * Pool order is left as-is — interests theme a story only at the moment it's
 * generated (that AI call is already happening, so theming it is free); they
 * don't reorder the cached pool. See useInterestTopics for why reordering a
 * shared pool has a real AI-economics cost that theming doesn't.
 *
 * A `description` bypasses the pool entirely and generates to order. Whether a
 * given user is allowed to do that is a tier decision made by the caller (see
 * useTierAccess().hasUnlimitedAI) — this service just honours the request.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.level        - CEFR level
 * @param {string} params.targetLang   - language the story is written in
 * @param {Array<{id: string, label: string}>} [params.interests] - from useInterestTopics().topics
 * @param {string[]} [params.seenStoryIds]
 * @param {string} [params.description] - custom topic; skips the cache when set
 * @returns {Promise<{ storyId: string, level: string, targetLang: string, title: string, paragraphs: string[], source: 'db'|'ai' }>}
 */
export async function getStory({ token, level, targetLang, interests = [], seenStoryIds = [], description = '' }) {
  if (!token) throw new Error('[storyService] token is required');
  if (!level) throw new Error('[storyService] level is required');
  if (!targetLang) throw new Error('[storyService] targetLang is required');

  const seenSet = new Set(seenStoryIds);
  const pool = await _fetchReadyStories(token, { level, targetLang });

  // A custom description is a specific request — go straight to generation.
  // The result still lands in the shared pool, so it isn't wasted on one reader.
  if (description.trim()) {
    return _generateStory({
      token, level, targetLang, interests,
      existingTitles: pool.map((s) => s.title),
      description: description.trim(),
    });
  }

  for (const story of pool) {
    if (seenSet.has(story.id)) continue;

    const content = await _getDocumentOrNull(`${STORIES_COLLECTION}/${story.id}/content`, targetLang, token);
    if (!content) continue; // root doc without its canonical content — skip rather than error

    return {
      storyId: story.id,
      level,
      targetLang,
      title: content.title,
      paragraphs: content.paragraphs,
      source: 'db',
    };
  }

  // Pool exhausted for this level/language — generate a new one.
  return _generateStory({ token, level, targetLang, interests, existingTitles: pool.map((s) => s.title) });
}

/**
 * Fetch a story's content in one locale, generating and caching a translation
 * when that locale hasn't been written yet.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.storyId
 * @param {string} params.sourceLang         - the story's canonical (targetLang) language
 * @param {string} params.sourceTitle
 * @param {string[]} params.sourceParagraphs
 * @param {string} params.locale             - the language to read it in
 * @returns {Promise<{ title: string, paragraphs: string[], locale: string, source: 'canonical'|'db'|'ai' }>}
 */
export async function getStoryTranslation({ token, storyId, sourceLang, sourceTitle, sourceParagraphs, locale }) {
  if (!token) throw new Error('[storyService] token is required');
  if (!storyId) throw new Error('[storyService] storyId is required');
  if (!sourceLang) throw new Error('[storyService] sourceLang is required');
  if (!locale) throw new Error('[storyService] locale is required');

  // Reading the story in its own language — nothing to translate.
  if (locale === sourceLang) {
    return { title: sourceTitle, paragraphs: sourceParagraphs, locale: sourceLang, source: 'canonical' };
  }

  const collection = `${STORIES_COLLECTION}/${storyId}/content`;

  const existing = await _getDocumentOrNull(collection, locale, token);
  if (existing) {
    return { title: existing.title, paragraphs: existing.paragraphs, locale, source: 'db' };
  }

  const paragraphCount = sourceParagraphs.length;
  const promptDoc = await getPrompt('story-translate-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    sourceLang,
    targetLocale: locale,
    title: sourceTitle,
    paragraphsJson: JSON.stringify(sourceParagraphs),
    paragraphCount,
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.3,
    jsonMode: true,
    responseSchema: _storySchema(paragraphCount),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.title || !Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length !== paragraphCount) {
    throw new Error('[storyService] Translation did not match the expected paragraph count');
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

  await createDocument(collection, translated, locale, token);

  return { title: translated.title, paragraphs: translated.paragraphs, locale, source: 'ai' };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

async function _generateStory({ token, level, targetLang, interests, existingTitles, description = '' }) {
  const paragraphCount = PARAGRAPH_COUNT_BY_LEVEL[level] ?? DEFAULT_PARAGRAPH_COUNT;
  const grammarDescription = getGrammarDescription(level);
  // An explicit description wins over interests: the reader asked for
  // something specific, so interests would only dilute it.
  const interestsLine = description
    ? description
    : interests.map((t) => t.label).join(', ');
  const avoidTitles = existingTitles.filter(Boolean).join('; ') || '(none yet)';

  const promptDoc = await getPrompt('story-generate-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    level,
    interests: interestsLine,
    grammarDescription,
    avoidTitles,
    paragraphCount,
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.8,
    jsonMode: true,
    responseSchema: _storySchema(paragraphCount),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.title || !Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length === 0) {
    throw new Error('[storyService] AI returned an incomplete story');
  }

  const now = new Date().toISOString();
  const title = String(parsed.title).trim();
  const paragraphs = parsed.paragraphs.map(String);

  const written = await createDocument(STORIES_COLLECTION, {
    level,
    targetLang,
    // Only tag with interests when interests actually shaped the story — a
    // description-driven story isn't about those topics.
    topicIds: description ? [] : interests.map((t) => t.id),
    title,
    status: 'ready',
    aiGenerated: true,
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  }, undefined, token);

  const storyId = written?.id;
  if (!storyId) throw new Error('[storyService] Story write did not return an ID');

  await createDocument(`${STORIES_COLLECTION}/${storyId}/content`, {
    locale: targetLang,
    title,
    paragraphs,
    source: 'ai',
    createdAt: now,
    updatedAt: now,
  }, targetLang, token);

  return { storyId, level, targetLang, title, paragraphs, source: 'ai' };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function _fetchReadyStories(token, { level, targetLang }) {
  const result = await queryCollection(
    STORIES_COLLECTION,
    { level, targetLang, status: 'ready' },
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
