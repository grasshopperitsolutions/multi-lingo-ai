/**
 * grammarService.js
 *
 * Backs the Grammar feature: the structure library, the tips collection, and
 * the free-text "ask AI about grammar" tool.
 *
 * Everything is cache-first against shared Firestore pools, the same contract
 * as examExerciseService/getWordService: read what exists, generate only what
 * is missing, write it back so the next user gets it for free.
 *
 * Firestore schema:
 *
 *   grammarTopics/{targetLang}__{key}
 *     key: string           // language-neutral, e.g. "verbs-past-simple"
 *     family: string        // "verbs" | "pronouns" | "articles" | ...
 *     targetLang: string    // language being described, e.g. "pt-PT"
 *     order: number
 *     status: "ready"
 *     source: "seed" | "ai"
 *     createdAt / updatedAt
 *
 *   grammarTopics/{topicId}/content/{explanationLocale}
 *     locale: string        // the language the EXPLANATION is written in
 *     title, summary, explanation: string
 *     tables:   [{ caption, headers[], rows[][] }]
 *     examples: [{ target, native, note }]
 *     pitfalls: string[]
 *     source: "seed" | "ai"
 *
 *   grammarTips/{tipId}
 *     targetLang: string          // language the tip is about
 *     explanationLocale: string   // language the tip is written in
 *     category: string            // "pronunciation" | "expression" | ...
 *     title, body: string
 *     examples: [{ target, native, note }]
 *     source: "seed" | "ai"
 *     status: "ready"
 *
 * Two languages are in play throughout and they are NOT the same thing:
 *   targetLang        — the language being learned and described (pt-PT)
 *   explanationLocale — the language the learner reads (their interfaceLang)
 * A topic document is per target language; its content documents are per
 * explanation locale. That is what lets one pt-PT topic be read in English,
 * French or Spanish without duplicating the taxonomy.
 */

import {
  queryCollection,
  getDocument,
  createDocument,
} from './firestoreService';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { parseAIJSON } from '../utils/parseAIJSON';

export const TOPICS_COLLECTION = 'grammarTopics';
export const TIPS_COLLECTION = 'grammarTips';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Categories a tip can belong to. Mirrors the seed corpus. */
export const TIP_CATEGORIES = [
  'pronunciation',
  'spelling',
  'expression',
  'proverb',
  'tongue-twister',
  'false-friend',
  'vocabulary',
  'culture',
  'mnemonic',
];

// ---------------------------------------------------------------------------
// Shared response shapes
// ---------------------------------------------------------------------------

const EXAMPLES_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      target: { type: 'string' },
      native: { type: 'string' },
      note: { type: 'string' },
    },
    required: ['target', 'native'],
  },
};

const TOPIC_CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    explanation: { type: 'string' },
    tables: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          caption: { type: 'string' },
          headers: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
        },
        required: ['headers', 'rows'],
      },
    },
    examples: EXAMPLES_SCHEMA,
    pitfalls: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'explanation'],
};

const TIP_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
    examples: EXAMPLES_SCHEMA,
  },
  required: ['title', 'body'],
};

const ASK_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    examples: EXAMPLES_SCHEMA,
    relatedTopicKeys: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer'],
};

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

/**
 * Topic document IDs are derived, not random, so seeding twice cannot create
 * duplicates and a topic can be fetched without a query.
 */
export function buildTopicId(targetLang, key) {
  return `${targetLang}__${key}`;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/**
 * List every ready topic for a target language, ordered for display.
 *
 * @param {{ token: string, targetLang: string }} params
 * @returns {Promise<Array<object>>}
 */
export async function getTopics({ token, targetLang }) {
  if (!token) throw new Error('[grammarService] token is required');
  if (!targetLang) throw new Error('[grammarService] targetLang is required');

  const result = await queryCollection(
    TOPICS_COLLECTION,
    { targetLang, status: 'ready' },
    {},
    token
  );

  const docs = result?.documents ?? [];
  return [...docs].sort((a, b) => {
    const byOrder = (a.order ?? 0) - (b.order ?? 0);
    return byOrder !== 0 ? byOrder : String(a.key ?? '').localeCompare(String(b.key ?? ''));
  });
}

/**
 * Fetch a topic's content in one explanation locale, generating and caching it
 * when that locale has not been written yet.
 *
 * Falls back to any locale that does exist rather than showing the learner an
 * empty page if generation fails — a topic explained in the wrong language is
 * still more useful than nothing.
 *
 * @param {{ token: string, topic: object, explanationLocale: string }} params
 * @returns {Promise<{ content: object, locale: string, source: 'db'|'ai'|'fallback' }>}
 */
export async function getTopicContent({ token, topic, explanationLocale }) {
  if (!token) throw new Error('[grammarService] token is required');
  if (!topic?.id) throw new Error('[grammarService] topic is required');
  if (!explanationLocale) throw new Error('[grammarService] explanationLocale is required');

  const collection = `${TOPICS_COLLECTION}/${topic.id}/content`;

  const existing = await _getDocumentOrNull(collection, explanationLocale, token);
  if (existing) return { content: existing, locale: explanationLocale, source: 'db' };

  try {
    const generated = await seedTopicContent({ token, topic, explanationLocale });
    return { content: generated, locale: explanationLocale, source: 'ai' };
  } catch (err) {
    // Generation failed — surface whatever locale we already have rather than
    // nothing at all.
    const anyLocale = await queryCollection(collection, {}, { limit: 1 }, token);
    const fallback = anyLocale?.documents?.[0];
    if (fallback) return { content: fallback, locale: fallback.locale, source: 'fallback' };
    throw err;
  }
}

/**
 * Generate a topic's content for one explanation locale and write it back to
 * the shared pool.
 *
 * This is what makes the library language-agnostic: a locale with no
 * hand-written seed file gets an AI-written explanation of the same
 * language-neutral topic key.
 *
 * @param {{ token: string, topic: object, explanationLocale: string }} params
 * @returns {Promise<object>} The written content document.
 */
export async function seedTopicContent({ token, topic, explanationLocale }) {
  const promptDoc = await getPrompt('grammar-topic-seed-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    targetLang: topic.targetLang,
    explanationLang: explanationLocale,
    topicKey: topic.key,
    topicFamily: topic.family ?? '',
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.3,
    jsonMode: true,
    responseSchema: TOPIC_CONTENT_SCHEMA,
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.explanation) {
    throw new Error('[grammarService] AI returned no explanation for this topic');
  }

  const now = new Date().toISOString();
  const content = {
    locale: explanationLocale,
    title: String(parsed.title ?? topic.key),
    summary: String(parsed.summary ?? ''),
    explanation: String(parsed.explanation),
    tables: _sanitizeTables(parsed.tables),
    examples: _sanitizeExamples(parsed.examples),
    pitfalls: Array.isArray(parsed.pitfalls) ? parsed.pitfalls.map(String) : [],
    source: 'ai',
    verified: false,
    createdAt: now,
    updatedAt: now,
  };

  await createDocument(
    `${TOPICS_COLLECTION}/${topic.id}/content`,
    content,
    explanationLocale,
    token
  );

  return content;
}

// ---------------------------------------------------------------------------
// Tips
// ---------------------------------------------------------------------------

/**
 * List tips for a target language, written in the reader's language.
 *
 * Filtered by explanationLocale rather than falling back to another language:
 * a French learner shown English tips would be worse than an empty state with
 * a "generate one" button next to it.
 *
 * @param {{ token: string, targetLang: string, explanationLocale: string, category?: string }} params
 * @returns {Promise<Array<object>>}
 */
export async function getTips({ token, targetLang, explanationLocale, category }) {
  if (!token) throw new Error('[grammarService] token is required');
  if (!targetLang) throw new Error('[grammarService] targetLang is required');

  const filters = { targetLang, explanationLocale, status: 'ready' };
  if (category) filters.category = category;

  const result = await queryCollection(TIPS_COLLECTION, filters, {}, token);
  return result?.documents ?? [];
}

/**
 * Ask the AI for a new tip and write it into the shared pool.
 *
 * Existing titles are passed to the model so it produces something new rather
 * than rewording a tip already on the page — the same de-duplication trick
 * getWordService uses when its concept pool is exhausted.
 *
 * @param {{ token, targetLang, explanationLocale, category, knownTitles?: string[] }} params
 * @returns {Promise<object>} The newly written tip, including its id.
 */
export async function generateTip({ token, targetLang, explanationLocale, category, knownTitles = [] }) {
  if (!token) throw new Error('[grammarService] token is required');
  if (!targetLang) throw new Error('[grammarService] targetLang is required');
  if (!category) throw new Error('[grammarService] category is required');

  const promptDoc = await getPrompt('grammar-tip-generate-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    explanationLang: explanationLocale,
    category,
    knownTitles: knownTitles.length > 0 ? knownTitles.join('; ') : '(none yet)',
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    // Higher than the library seeding: a fresh tip should not be the most
    // predictable one every time the button is pressed.
    temperature: 0.9,
    jsonMode: true,
    responseSchema: TIP_SCHEMA,
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.title || !parsed?.body) {
    throw new Error('[grammarService] AI returned an incomplete tip');
  }

  const now = new Date().toISOString();
  const tip = {
    targetLang,
    explanationLocale,
    category,
    title: String(parsed.title).trim(),
    body: String(parsed.body).trim(),
    examples: _sanitizeExamples(parsed.examples),
    source: 'ai',
    verified: false,
    status: 'ready',
    createdAt: now,
    updatedAt: now,
  };

  const written = await createDocument(TIPS_COLLECTION, tip, undefined, token);
  return { id: written?.id, ...tip };
}

// ---------------------------------------------------------------------------
// Ask AI
// ---------------------------------------------------------------------------

/** Keep the pasted-text block clear of the backend's 8000-character prompt cap. */
const MAX_USER_TEXT = 4000;

/**
 * Answer a free-text grammar question, optionally about a passage the learner
 * pasted or extracted from a document.
 *
 * Per-user and not cached: questions are personal and rarely repeat, so
 * writing them to a shared pool would be noise.
 *
 * @param {{ token, question, userText?, targetLang, explanationLocale, level?, topicKeys?: string[] }} params
 * @returns {Promise<{ answer: string, examples: object[], relatedTopicKeys: string[] }>}
 */
export async function askGrammar({
  token,
  question,
  userText = '',
  targetLang,
  explanationLocale,
  level = 'A2',
  topicKeys = [],
}) {
  if (!token) throw new Error('[grammarService] token is required');
  if (!question?.trim()) throw new Error('[grammarService] question is required');
  if (!targetLang) throw new Error('[grammarService] targetLang is required');

  const promptDoc = await getPrompt('grammar-ask-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    explanationLang: explanationLocale,
    level,
    question: question.trim(),
    userText: userText.slice(0, MAX_USER_TEXT),
    topicKeys: topicKeys.length > 0 ? topicKeys.join(', ') : '(none available)',
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.3,
    jsonMode: true,
    responseSchema: ASK_SCHEMA,
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.answer) throw new Error('[grammarService] AI returned no answer');

  // The model is asked to pick from the supplied keys, but a hallucinated key
  // would render as a dead link — drop anything not on the list.
  const allowed = new Set(topicKeys);
  const relatedTopicKeys = Array.isArray(parsed.relatedTopicKeys)
    ? parsed.relatedTopicKeys.filter((k) => allowed.has(k))
    : [];

  return {
    answer: String(parsed.answer),
    examples: _sanitizeExamples(parsed.examples),
    relatedTopicKeys,
  };
}

// ---------------------------------------------------------------------------
// Seeding (used by the temporary admin seeder)
// ---------------------------------------------------------------------------

/**
 * Write the hand-written corpus into Firestore, skipping anything already
 * present. Idempotent by construction: topic IDs are derived from
 * targetLang + key, and tip IDs from targetLang + locale + slug.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.targetLang
 * @param {string} params.explanationLocale
 * @param {Array}  params.topics
 * @param {object} params.topicContent  - keyed by topic key
 * @param {Array}  params.tips
 * @param {(msg: string) => void} [params.onProgress]
 * @returns {Promise<{ topicsCreated, topicsSkipped, contentCreated, contentSkipped, tipsCreated, tipsSkipped }>}
 */
export async function seedGrammarCorpus({
  token,
  targetLang,
  explanationLocale,
  topics,
  topicContent,
  tips,
  onProgress,
}) {
  const summary = {
    topicsCreated: 0,
    topicsSkipped: 0,
    contentCreated: 0,
    contentSkipped: 0,
    tipsCreated: 0,
    tipsSkipped: 0,
  };

  const now = new Date().toISOString();

  for (const topic of topics) {
    const topicId = buildTopicId(targetLang, topic.key);

    const existingTopic = await _getDocumentOrNull(TOPICS_COLLECTION, topicId, token);
    if (existingTopic) {
      summary.topicsSkipped += 1;
    } else {
      await createDocument(TOPICS_COLLECTION, {
        key: topic.key,
        family: topic.family,
        targetLang,
        order: topic.order ?? 0,
        status: 'ready',
        source: 'seed',
        verified: true,
        createdAt: now,
        updatedAt: now,
      }, topicId, token);
      summary.topicsCreated += 1;
    }

    const content = topicContent[topic.key];
    if (!content) {
      onProgress?.(`${topic.key}: no content in the seed file, skipped`);
      continue;
    }

    const contentCollection = `${TOPICS_COLLECTION}/${topicId}/content`;
    const existingContent = await _getDocumentOrNull(contentCollection, explanationLocale, token);
    if (existingContent) {
      summary.contentSkipped += 1;
    } else {
      await createDocument(contentCollection, {
        locale: explanationLocale,
        title: content.title,
        summary: content.summary,
        explanation: content.explanation,
        tables: content.tables ?? [],
        examples: content.examples ?? [],
        pitfalls: content.pitfalls ?? [],
        source: 'seed',
        verified: true,
        createdAt: now,
        updatedAt: now,
      }, explanationLocale, token);
      summary.contentCreated += 1;
    }

    onProgress?.(`${topic.key} done`);
  }

  for (const tip of tips) {
    const tipId = `${targetLang}__${explanationLocale}__${tip.slug}`;
    const existingTip = await _getDocumentOrNull(TIPS_COLLECTION, tipId, token);
    if (existingTip) {
      summary.tipsSkipped += 1;
      continue;
    }
    await createDocument(TIPS_COLLECTION, {
      targetLang,
      explanationLocale,
      category: tip.category,
      title: tip.title,
      body: tip.body,
      examples: tip.examples ?? [],
      source: 'seed',
      verified: true,
      status: 'ready',
      createdAt: now,
      updatedAt: now,
    }, tipId, token);
    summary.tipsCreated += 1;
    onProgress?.(`tip: ${tip.title}`);
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * getDocument throws on a missing document; seeding and cache-first reads both
 * need "not there yet" to be a normal answer rather than an error.
 */
async function _getDocumentOrNull(collection, id, token) {
  try {
    const doc = await getDocument(collection, id, token);
    return doc ?? null;
  } catch {
    return null;
  }
}

/** Drop malformed examples so a bad AI response can't break the renderer. */
function _sanitizeExamples(examples) {
  if (!Array.isArray(examples)) return [];
  return examples
    .filter((e) => e && typeof e === 'object' && e.target)
    .map((e) => ({
      target: String(e.target),
      native: String(e.native ?? ''),
      note: String(e.note ?? ''),
    }));
}

/**
 * Keep only rectangular tables. The renderer maps headers to cells positionally,
 * so a row with the wrong cell count would silently misalign the data — worse
 * than not showing the table at all.
 */
function _sanitizeTables(tables) {
  if (!Array.isArray(tables)) return [];
  return tables
    .filter((t) => t && Array.isArray(t.headers) && Array.isArray(t.rows) && t.headers.length > 0)
    .map((t) => ({
      caption: String(t.caption ?? ''),
      headers: t.headers.map(String),
      rows: t.rows
        .filter((r) => Array.isArray(r) && r.length === t.headers.length)
        .map((r) => r.map(String)),
    }))
    .filter((t) => t.rows.length > 0);
}
