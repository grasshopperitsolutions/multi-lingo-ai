/**
 * getWordService.js
 *
 * Game-agnostic word retrieval service.
 * Replaces the game-specific HangmanService — the caller passes `gameId`
 * instead of it being hardcoded, making this reusable by any word-based
 * challenge (hangman, crosswords, word quiz, word search, etc.).
 *
 * Flow:
 *   1. Resolve (or create) the GameWordPool document for this
 *      gameId + learningDialect + category combination.
 *   2. Load the user's progress to get their list of seen word IDs.
 *   3. Fetch words from the pool subcollection and pick the first
 *      one the user has not yet seen (client-side exclusion to avoid
 *      Firestore NOT-IN limit of 10).
 *
 *   BRANCH A — Unseen word found in DB:
 *     a. If the hint for userDialect exists → return immediately.
 *     b. If the hint is missing → ask AI for just the hint,
 *        patch it onto the word document (dot-notation), then return.
 *     c. Mark word as seen in user progress.
 *
 *   BRANCH B — Pool exhausted (no unseen words):
 *     a. Collect all known words to pass to AI (dedup prompt).
 *     b. Call /api/ask-ai for a brand-new word + hint.
 *     c. Save the new word document to the subcollection  ← organic growth
 *     d. Patch pool totalCount + lastAIRefill timestamp.
 *     e. Mark word as seen in user progress.
 *     f. Return the fresh word.
 *
 * @module getWordService
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only — no runtime cost)
// ---------------------------------------------------------------------------

/**
 * @typedef {'general'|'food'|'travel'|'sports'|'tech'|'nature'} WordCategory
 */

/**
 * @typedef {Object} GetWordParams
 * @property {string} uid
 * @property {string} token                  - Firebase ID token
 * @property {string} gameId                 - e.g. 'hangman', 'crosswords'
 * @property {string} userDialect            - BCP-47 native language, e.g. 'en-US'
 * @property {string} learningDialect        - BCP-47 target language, e.g. 'pt-PT'
 * @property {WordCategory} category
 */

/**
 * @typedef {Object} WordResult
 * @property {string} word
 * @property {string} hint
 * @property {string} wordId
 * @property {'db'|'ai'} source
 */

/**
 * @typedef {Object} UserWordProgress
 * @property {string[]} seenWordIds
 * @property {number} totalPlayed
 * @property {string} lastPlayedAt
 */

/**
 * @typedef {Object} GeminiParams
 * @property {'gemini'} provider
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [maxOutputTokens]
 * @property {number} [topP]
 * @property {number} [topK]
 * @property {boolean} [jsonMode]
 * @property {Record<string, unknown>} [responseSchema]
 * @property {string} [systemInstruction]
 */

/**
 * @typedef {Object} OpenAIParams
 * @property {'openai'} provider
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [max_tokens]
 */

/**
 * @typedef {Object} PerplexityParams
 * @property {'perplexity'} provider
 * @property {string} [model]
 * @property {number} [temperature]
 * @property {number} [max_tokens]
 * @property {number} [top_p]
 */

/**
 * @typedef {GeminiParams | OpenAIParams | PerplexityParams} ProviderParams
 */

/**
 * @typedef {Object} ChatMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} AskAIRequest
 * @property {string} [prompt]
 * @property {ChatMessage[]} [messages]
 * @property {ProviderParams} providerParams
 */

/**
 * @typedef {Object} AskAIResponse
 * @property {string} text
 * @property {string} provider
 * @property {string} model
 */

/**
 * @typedef {Object} FirestoreGetOneResult
 * @property {string} id
 * @property {Record<string, unknown>} data
 * @property {string} collection
 */

/**
 * @typedef {Object} FirestoreQueryResult
 * @property {Array<{id: string} & Record<string, unknown>>} documents
 * @property {string} collection
 * @property {boolean} hasMore
 * @property {string|null} lastDocumentId
 */

/**
 * @typedef {Object} FirestoreWriteResult
 * @property {string} id
 * @property {string} collection
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { auth } from '../firebase';
import { callAskAI } from './askAiService';
import {
  getDocument,
  queryCollection,
  createDocument,
  patchDocument,
} from './firestoreService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTIONS = {
  GAME_WORDS: 'gameWords',
  USER_PROGRESS: 'userGameProgress',
};

const WORDS_PAGE_SIZE = 100;
const GEMINI_MODEL = 'gemini-2.0-flash';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the next unseen word for a user in a given game + dialect + category.
 *
 * @param {GetWordParams} params
 * @returns {Promise<WordResult>}
 *
 * @example
 * const result = await getWord({
 *   uid: user.uid,
 *   token: user.token,
 *   gameId: 'hangman',
 *   userDialect: 'en-US',
 *   learningDialect: 'pt-PT',
 *   category: 'food',
 * });
 * // result → { word: 'maçã', hint: 'A round red or green fruit.', wordId, source: 'db' }
 */
export async function getWord({ uid, token, gameId, userDialect, learningDialect, category }) {
  const idToken = token ?? (await _getToken());

  const poolId            = _buildPoolId(gameId, learningDialect, category);
  const progressDocId     = _buildProgressDocId(gameId, learningDialect);
  const wordsCollection   = _buildWordsCollection(poolId);
  const progressCollection = _buildProgressCollection(uid);

  // ── Step 1: Ensure the pool document exists ──────────────────────────────
  await _ensurePoolDoc(poolId, { gameId, learningDialect, category }, idToken);

  // ── Step 2: Load user progress (seen word IDs) ───────────────────────────
  const progress = await _getUserProgress(progressCollection, progressDocId, idToken);
  const seenWordIds = new Set(progress?.seenWordIds ?? []);

  // ── Step 3: Fetch pool words and find an unseen one ───────────────────────
  const allWords = await _fetchAllWords(wordsCollection, idToken);
  const unseenWord = allWords.find((w) => !seenWordIds.has(w.id));

  // ── BRANCH A: Word found in DB ────────────────────────────────────────────
  if (unseenWord) {
    let hint = unseenWord.hints?.[userDialect];

    if (!hint) {
      hint = await _generateMissingHint(unseenWord.word, { userDialect, learningDialect }, idToken);
      await patchDocument(
        wordsCollection,
        unseenWord.id,
        { [`hints.${userDialect}`]: hint },
        idToken
      );
    }

    await _markWordSeen(progressCollection, progressDocId, uid, unseenWord.id, progress, idToken);

    return {
      word: unseenWord.word,
      hint,
      wordId: unseenWord.id,
      source: 'db',
    };
  }

  // ── BRANCH B: Pool exhausted — call AI and persist the new word ───────────
  const knownWords = allWords.map((w) => w.word);
  const { word, hint } = await _generateNewWord(
    { userDialect, learningDialect, category, knownWords },
    idToken
  );

  const newWordId = await _saveNewWord(wordsCollection, { word, hint, userDialect }, idToken);

  await _patchPoolMeta(poolId, idToken);
  await _markWordSeen(progressCollection, progressDocId, uid, newWordId, progress, idToken);

  return {
    word,
    hint,
    wordId: newWordId,
    source: 'ai',
  };
}

// ---------------------------------------------------------------------------
// Internal helpers — pool
// ---------------------------------------------------------------------------

/**
 * @param {string} poolId
 * @param {{ gameId: string, learningDialect: string, category: string }} params
 * @param {string} token
 */
async function _ensurePoolDoc(poolId, { gameId, learningDialect, category }, token) {
  try {
    await getDocument(COLLECTIONS.GAME_WORDS, poolId, token);
  } catch (err) {
    if (err.message?.includes('404') || err.message?.includes('not found')) {
      await createDocument(
        COLLECTIONS.GAME_WORDS,
        {
          game: gameId,
          learningDialect,
          category,
          totalCount: 0,
          lastAIRefill: null,
        },
        poolId,
        token
      );
    } else {
      throw err;
    }
  }
}

/**
 * @param {string} poolId
 * @param {string} token
 */
async function _patchPoolMeta(poolId, token) {
  try {
    const poolDoc = await getDocument(COLLECTIONS.GAME_WORDS, poolId, token);
    const currentCount = poolDoc?.data?.totalCount ?? 0;
    await patchDocument(
      COLLECTIONS.GAME_WORDS,
      poolId,
      {
        totalCount: currentCount + 1,
        lastAIRefill: new Date().toISOString(),
      },
      token
    );
  } catch {
    console.warn('[getWordService] Failed to patch pool metadata — non-critical');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers — words subcollection
// ---------------------------------------------------------------------------

/**
 * @param {string} wordsCollection
 * @param {string} token
 * @returns {Promise<Array<{ id: string, word: string, hints: Record<string, string>, usedCount: number }>>}
 */
async function _fetchAllWords(wordsCollection, token) {
  const result = await queryCollection(
    wordsCollection,
    {},
    {
      orderBy: 'createdAt',
      order: 'asc',
      limit: WORDS_PAGE_SIZE,
    },
    token
  );
  return result?.documents ?? [];
}

/**
 * @param {string} wordsCollection
 * @param {{ word: string, hint: string, userDialect: string }} params
 * @param {string} token
 * @returns {Promise<string>}
 */
async function _saveNewWord(wordsCollection, { word, hint, userDialect }, token) {
  const result = await createDocument(
    wordsCollection,
    {
      word,
      hints: { [userDialect]: hint },
      addedBy: 'ai',
      usedCount: 0,
    },
    undefined,
    token
  );
  return result.id;
}

// ---------------------------------------------------------------------------
// Internal helpers — user progress
// ---------------------------------------------------------------------------

/**
 * @param {string} progressCollection
 * @param {string} progressDocId
 * @param {string} token
 * @returns {Promise<UserWordProgress | null>}
 */
async function _getUserProgress(progressCollection, progressDocId, token) {
  try {
    const result = await getDocument(progressCollection, progressDocId, token);
    return result?.data ?? null;
  } catch (err) {
    if (err.message?.includes('404') || err.message?.includes('not found')) {
      return null;
    }
    throw err;
  }
}

/**
 * @param {string} progressCollection
 * @param {string} progressDocId
 * @param {string} uid
 * @param {string} wordId
 * @param {UserWordProgress | null} currentProgress
 * @param {string} token
 */
async function _markWordSeen(
  progressCollection,
  progressDocId,
  uid,
  wordId,
  currentProgress,
  token
) {
  const now = new Date().toISOString();

  if (!currentProgress) {
    await createDocument(
      progressCollection,
      {
        seenWordIds: [wordId],
        totalPlayed: 1,
        lastPlayedAt: now,
      },
      progressDocId,
      token
    );
  } else {
    const updatedSeenIds = [...new Set([...(currentProgress.seenWordIds ?? []), wordId])];
    await patchDocument(
      progressCollection,
      progressDocId,
      {
        seenWordIds: updatedSeenIds,
        totalPlayed: (currentProgress.totalPlayed ?? 0) + 1,
        lastPlayedAt: now,
      },
      token
    );
  }
}

// ---------------------------------------------------------------------------
// Internal helpers — AI prompts
// ---------------------------------------------------------------------------

/**
 * @param {{ userDialect: string, learningDialect: string, category: string, knownWords: string[] }} params
 * @param {string} token
 * @returns {Promise<{ word: string, hint: string }>}
 */
async function _generateNewWord({ userDialect, learningDialect, category, knownWords }, token) {
  const avoidList =
    knownWords.length > 0
      ? `\nDo NOT use any of these words (already in the database): ${knownWords.join(', ')}`
      : '';

  const response = await callAskAI(
    {
      prompt: [
        `You are a language learning assistant.`,
        `Generate exactly ONE vocabulary word in ${learningDialect} from the topic "${category}".`,
        `Return a JSON object with two fields:`,
        `  - "word": a single common noun, 4 to 12 characters, lowercase, no leading/trailing spaces.`,
        `  - "hint": one sentence in ${userDialect} that describes the word without saying it.`,
        `The hint should be suitable for a guessing game.`,
        avoidList,
        `Return ONLY valid JSON. No markdown, no explanation.`,
      ]
        .filter(Boolean)
        .join('\n'),
      providerParams: {
        provider: 'gemini',
        model: GEMINI_MODEL,
        temperature: 0.9,
        jsonMode: true,
        responseSchema: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            hint: { type: 'string' },
          },
          required: ['word', 'hint'],
        },
      },
    },
    token
  );

  const parsed = _parseAIJson(response?.text);

  if (!parsed?.word || !parsed?.hint) {
    throw new Error('[getWordService] AI response missing word or hint fields');
  }

  return {
    word: parsed.word.trim().toLowerCase(),
    hint: parsed.hint.trim(),
  };
}

/**
 * @param {string} word
 * @param {{ userDialect: string, learningDialect: string }} params
 * @param {string} token
 * @returns {Promise<string>}
 */
async function _generateMissingHint(word, { userDialect, learningDialect }, token) {
  const response = await callAskAI(
    {
      prompt: [
        `You are a language learning assistant.`,
        `The word "${word}" is a vocabulary word in ${learningDialect}.`,
        `Write exactly one sentence in ${userDialect} that describes what this word means`,
        `without saying the word itself. It will be used as a hint in a guessing game.`,
        `Return ONLY valid JSON with one field: { "hint": string }. No markdown, no explanation.`,
      ].join('\n'),
      providerParams: {
        provider: 'gemini',
        model: GEMINI_MODEL,
        temperature: 0.7,
        jsonMode: true,
        responseSchema: {
          type: 'object',
          properties: { hint: { type: 'string' } },
          required: ['hint'],
        },
      },
    },
    token
  );

  const parsed = _parseAIJson(response?.text);

  if (!parsed?.hint) {
    throw new Error('[getWordService] AI response missing hint field');
  }

  return parsed.hint.trim();
}

// ---------------------------------------------------------------------------
// Internal helpers — utilities
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON string returned by an AI model.
 * Strips markdown code fences if the model wraps the output despite jsonMode.
 *
 * @param {string | undefined} text
 * @returns {Record<string, unknown> | null}
 */
function _parseAIJson(text) {
  if (!text) return null;
  try {
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    console.error('[getWordService] Failed to parse AI JSON:', text);
    return null;
  }
}

/** @returns {Promise<string>} Firebase ID token */
async function _getToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('[getWordService] No authenticated user');
  return user.getIdToken();
}

// ---------------------------------------------------------------------------
// Path builders
//
// Pool document ID:    hangman__pt-PT__food
// Words subcollection: gameWords/hangman__pt-PT__food/words
// Progress collection: userGameProgress/{uid}/games
// Progress doc ID:     hangman__pt-PT
// ---------------------------------------------------------------------------

/** @param {string} gameId @param {string} learningDialect @param {string} category */
function _buildPoolId(gameId, learningDialect, category) {
  return `${gameId}__${learningDialect}__${category}`;
}

/** @param {string} poolId */
function _buildWordsCollection(poolId) {
  return `${COLLECTIONS.GAME_WORDS}/${poolId}/words`;
}

/** @param {string} uid */
function _buildProgressCollection(uid) {
  return `${COLLECTIONS.USER_PROGRESS}/${uid}/games`;
}

/** @param {string} gameId @param {string} learningDialect */
function _buildProgressDocId(gameId, learningDialect) {
  return `${gameId}__${learningDialect}`;
}
