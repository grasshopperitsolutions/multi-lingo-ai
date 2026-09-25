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
 *     theme: string              // STORY_THEMES id the reader picked ('any' when they didn't).
 *                                // Absent on every tale written before themes existed, which
 *                                // is why a themed read filters and an 'any' read does not.
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
import { parseAIJSON } from '../utils/parseAIJSON';
import {
  DEFAULT_STORY_THEME,
  CUSTOM_STORY_THEME,
  describeStoryTheme,
} from '../config/storyThemes';

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
 * **Deliberately not filtered by theme**, unlike getStory. "Exhausted" is what
 * opens a paid feature to a free tier, and a theme nobody has written for yet
 * is empty from the moment it is added — so counting per theme would let
 * anyone unlock custom requests by picking the most obscure option in the
 * list. The question this answers is "have you seen everything there is",
 * which has nothing to do with what you have currently selected.
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
 * @param {string[]} [params.requiredWords] - words from the reader's word bank the
 *   story must use; also skips the cache, since no cached story can contain them
 * @param {string} [params.theme] - a STORY_THEMES id; narrows the pool to tales
 *   written under it. 'any' (the default) filters nothing.
 * @param {string} [params.customTheme] - the reader's own theme, when `theme` is
 *   'other'; skips the cache, since no preset pool can match arbitrary words
 * @returns {Promise<{ storyId: string, level: string, targetLang: string, title: string, paragraphs: string[], source: 'db'|'ai' }>}
 */
export async function getStory({
  token, level, targetLang, interests = [], seenStoryIds = [],
  description = '', requiredWords = [],
  theme = DEFAULT_STORY_THEME, customTheme = '',
}) {
  if (!token) throw new Error('[storyService] token is required');
  if (!level) throw new Error('[storyService] level is required');
  if (!targetLang) throw new Error('[storyService] targetLang is required');

  const seenSet = new Set(seenStoryIds);
  const isCustomTheme = theme === CUSTOM_STORY_THEME;

  // Narrowing the query is what keeps themes cache-first: ten readers asking
  // for the same theme at the same level share one pool rather than paying for
  // ten generations. 'any' passes no filter at all, which is also the only way
  // the tales written before themes existed are ever served — Firestore drops
  // documents missing an equality-filtered field rather than treating it as
  // unset. A free-text theme has no pool by definition, so it doesn't query.
  const pool = await _fetchReadyStories(token, {
    level,
    targetLang,
    theme: theme === DEFAULT_STORY_THEME || isCustomTheme ? undefined : theme,
  });

  // A custom description or a set of required words is a specific request —
  // go straight to generation. No cached story can be guaranteed to contain
  // the reader's own words, so the pool cannot serve this at all. The result
  // still lands in the shared pool, so it isn't wasted on one reader.
  if (description.trim() || requiredWords.length > 0 || isCustomTheme) {
    return _generateStory({
      token, level, targetLang, interests,
      existingTitles: pool.map((s) => s.title),
      description: description.trim(),
      requiredWords,
      theme,
      customTheme,
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

  // Pool exhausted for this level/language/theme — generate a new one.
  return _generateStory({
    token, level, targetLang, interests,
    existingTitles: pool.map((s) => s.title),
    theme,
  });
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
    explorerModel: promptDoc.explorerModel,
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

async function _generateStory({
  token, level, targetLang, interests, existingTitles,
  description = '', requiredWords = [],
  theme = DEFAULT_STORY_THEME, customTheme = '',
}) {
  const paragraphCount = PARAGRAPH_COUNT_BY_LEVEL[level] ?? DEFAULT_PARAGRAPH_COUNT;
  // An explicit description wins over interests: the reader asked for
  // something specific, so interests would only dilute it.
  const interestsLine = description
    ? description
    : interests.map((t) => t.label).join(', ');
  const avoidTitles = existingTitles.filter(Boolean).join('; ') || '(none yet)';

  const promptDoc = await getPrompt('story-generate-prompt');

  // The word bank asks for specific words to appear. The template is
  // admin-edited in Firestore, so it may not carry the placeholder yet —
  // renderTemplate would silently drop the words and the reader would get a
  // story with none of them in it, which looks like the feature is broken
  // rather than like the prompt is out of date.
  if (requiredWords.length > 0 && !String(promptDoc.template).includes('{{requiredWords}}')) {
    console.warn(
      '[storyService] The "story-generate-prompt" template has no {{requiredWords}} placeholder, ' +
      `so the ${requiredWords.length} selected word(s) will not reach the model. ` +
      'Add it in Admin > Prompts.',
    );
  }

  // Same trap as {{requiredWords}}: the reader picks a theme, the template
  // drops it, and every tale comes back generic — which reads as the picker
  // being decorative rather than the prompt being out of date. Only worth
  // saying when a theme was actually chosen; 'any' changes nothing.
  if (theme !== DEFAULT_STORY_THEME && !String(promptDoc.template).includes('{{theme}}')) {
    console.warn(
      '[storyService] The "story-generate-prompt" template has no {{theme}} placeholder, ' +
      `so the chosen theme ("${theme}") will not reach the model. Add it in Admin > Prompts.`,
    );
  }

  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    level,
    interests: interestsLine,
    avoidTitles,
    paragraphCount,
    // The instruction, not the id: "underwater — the sea, the coast, boats..."
    // rather than "underwater". The id is storage; this is what the model reads.
    theme: describeStoryTheme(theme, customTheme),
    // A plain list, not a sentence: the instruction around it belongs in the
    // editable template, not baked in here.
    requiredWords: requiredWords.join(', ') || '(none)',
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
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
    // Written even for 'any', so every tale from here on is filterable. A
    // free-text tale is stored under 'other' and is never read back from the
    // pool (that path always generates) — but it still surfaces under 'any',
    // so it isn't spent on one reader either.
    theme,
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

async function _fetchReadyStories(token, { level, targetLang, theme }) {
  const result = await queryCollection(
    STORIES_COLLECTION,
    // Equality filters only, so no composite index is needed however many are
    // passed. `theme` is left out entirely when undefined rather than sent as
    // a null — a filter on a field most documents don't carry would return an
    // empty pool and quietly turn every read into a generation.
    { level, targetLang, status: 'ready', ...(theme ? { theme } : {}) },
    {},
    token
  );
  return result?.documents ?? [];
}

/**
 * getDocument throws on a missing document; cache-first reads need "not there
 * yet" to be a normal answer rather than an error.
 */
/**
 * The document's *fields*, or null.
 *
 * `getDocument` resolves to the API envelope — `{ id, data, collection }` —
 * not to a bare document, and this returned that envelope. Every caller then
 * read `.title` and `.paragraphs` straight off it and got `undefined`, which
 * is silent: a cached piece came back shaped correctly and completely empty,
 * and the only loud version was `source.paragraphs.length` throwing on the
 * translate path.
 *
 * It only ever showed up on the *cached* routes. Freshly generated content is
 * returned from the generator directly and never passes through here, so the
 * first read of anything worked and the second was blank.
 */
async function _getDocumentOrNull(collection, id, token) {
  try {
    const doc = await getDocument(collection, id, token);
    return doc?.data ?? null;
  } catch {
    return null;
  }
}
