/**
 * HangmanService.js
 *
 * Orchestrates word retrieval for the Hangman challenge.
 *
 * Flow:
 *   1. Resolve (or create) the GameWordPool document for this
 *      game + learningDialect + category combination.
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
 * @module HangmanService
 */

import { auth } from '../firebase';
import { callAskAI } from '../services/askAiService';
import {
  getDocument,
  queryCollection,
  createDocument,
  patchDocument,
} from '../services/firestoreService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GAME_ID = 'hangman';

/**
 * Firestore collection names.
 * Centralised so a rename only needs to happen here.
 */
const COLLECTIONS = {
  /** Top-level pool documents + their words subcollections */
  GAME_WORDS: 'gameWords',
  /** Per-user seen-word tracking */
  USER_PROGRESS: 'userGameProgress',
};

/** Maximum words to fetch per query page when scanning the pool */
const WORDS_PAGE_SIZE = 100;

/** Gemini model used for all AI calls in this service */
const GEMINI_MODEL = 'gemini-2.0-flash';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve the next unseen Hangman word for a user.
 *
 * @param {import('./types').HangmanServiceParams & { token: string }} params
 * @returns {Promise<import('./types').GameWordResult>}
 *
 * @example
 * const result = await getHangmanWord({
 *   uid: user.uid,
 *   token: user.token,
 *   userDialect: 'en-US',
 *   learningDialect: 'es-MX',
 *   category: 'food',
 * });
 * // result → { word: 'manzana', hint: 'A round red or green fruit.', wordId, source: 'db' }
 */
export async function getHangmanWord({ uid, token, userDialect, learningDialect, category }) {
  // Resolve a fresh token if the caller didn't supply one
  const idToken = token ?? (await _getToken());

  const poolId = _buildPoolId(learningDialect, category);
  const progressDocId = _buildProgressDocId(learningDialect);
  const wordsCollection = _buildWordsCollection(poolId);
  const progressCollection = _buildProgressCollection(uid);

  // ── Step 1: Ensure the pool document exists ──────────────────────────────
  await _ensurePoolDoc(poolId, { learningDialect, category }, idToken);

  // ── Step 2: Load user progress (seen word IDs) ───────────────────────────
  const progress = await _getUserProgress(progressCollection, progressDocId, idToken);
  const seenWordIds = new Set(progress?.seenWordIds ?? []);

  // ── Step 3: Fetch pool words and find an unseen one ───────────────────────
  const allWords = await _fetchAllWords(wordsCollection, idToken);
  const unseenWord = allWords.find((w) => !seenWordIds.has(w.id));

  // ── BRANCH A: Word found in DB ────────────────────────────────────────────
  if (unseenWord) {
    let hint = unseenWord.hints?.[userDialect];

    // Branch A-b: hint for this userDialect is missing — generate it
    if (!hint) {
      hint = await _generateMissingHint(unseenWord.word, { userDialect, learningDialect }, idToken);
      // Patch the hint onto the word document (dot-notation, non-destructive)
      await patchDocument(
        wordsCollection,
        unseenWord.id,
        { [`hints.${userDialect}`]: hint },
        idToken
      );
    }

    // Mark as seen
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

  // Write new word to the subcollection → organic data bank growth
  const newWordId = await _saveNewWord(
    wordsCollection,
    { word, hint, userDialect },
    idToken
  );

  // Patch pool metadata
  await _patchPoolMeta(poolId, idToken);

  // Mark as seen
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
 * Ensure a GameWordPool document exists for this poolId.
 * Creates it with zero counts if absent (first-ever request for this combo).
 *
 * @param {string} poolId
 * @param {{ learningDialect: string, category: string }} params
 * @param {string} token
 */
async function _ensurePoolDoc(poolId, { learningDialect, category }, token) {
  try {
    await getDocument(COLLECTIONS.GAME_WORDS, poolId, token);
  } catch (err) {
    // 404 → pool doesn't exist yet; create it
    if (err.message?.includes('404') || err.message?.includes('not found')) {
      await createDocument(
        COLLECTIONS.GAME_WORDS,
        {
          game: GAME_ID,
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
 * Patch pool metadata after an AI word is added.
 * Increments totalCount and sets lastAIRefill to now.
 *
 * NOTE: Firestore FieldValue.increment() is not available client-side.
 * We fetch the current totalCount and write count + 1.
 * Race conditions here are acceptable — a slight totalCount inaccuracy
 * has no functional impact (it's informational only).
 *
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
    // Non-critical — pool metadata update failure should not block the game
    console.warn('[HangmanService] Failed to patch pool metadata — non-critical');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers — words subcollection
// ---------------------------------------------------------------------------

/**
 * Fetch ALL words from the pool subcollection (paginates automatically).
 * Words are returned as flat objects with their Firestore document ID
 * merged in as `id`.
 *
 * @param {string} wordsCollection
 * @param {string} token
 * @returns {Promise<Array<{ id: string, word: string, hints: Record<string, string>, usedCount: number }>>}
 */
async function _fetchAllWords(wordsCollection, token) {
  // NOTE: Pagination is intentionally omitted — a single query with a limit of
  // 100 is sufficient for current pool sizes. If pools grow beyond 100 words
  // per dialect+category, add cursor-based pagination here using the last
  // document's `createdAt` timestamp (not its document ID) as the cursor.
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
 * Write a new AI-generated word to the words subcollection.
 *
 * @param {string} wordsCollection
 * @param {{ word: string, hint: string, userDialect: string }} params
 * @param {string} token
 * @returns {Promise<string>} The new document ID
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
    undefined, // auto-generate Firestore document ID
    token
  );
  return result.id;
}

// ---------------------------------------------------------------------------
// Internal helpers — user progress
// ---------------------------------------------------------------------------

/**
 * Load the user's progress document for this game + learningDialect.
 * Returns null (not throws) when the document doesn't exist yet.
 *
 * @param {string} progressCollection
 * @param {string} progressDocId
 * @param {string} token
 * @returns {Promise<import('./types').UserGameProgress | null>}
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
 * Append a wordId to the user's seenWordIds.
 * Creates the progress document on first play; updates it on subsequent plays.
 *
 * @param {string} progressCollection
 * @param {string} progressDocId
 * @param {string} uid
 * @param {string} wordId
 * @param {import('./types').UserGameProgress | null} currentProgress
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
    // First play — create the progress document
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
    // Subsequent play — patch the seen list non-destructively
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
 * Call /api/ask-ai to generate a brand-new word + hint in the target language.
 *
 * The `knownWords` array is injected into the prompt to prevent Gemini
 * from repeating words already in the bank — this is what enables
 * organic, non-duplicate vocabulary growth.
 *
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
    throw new Error('[HangmanService] AI response missing word or hint fields');
  }

  return {
    word: parsed.word.trim().toLowerCase(),
    hint: parsed.hint.trim(),
  };
}

/**
 * Call /api/ask-ai to generate a hint for an existing word in a new userDialect.
 * Used in Branch A-b when the word exists but the hint is missing for this dialect.
 *
 * @param {string} word
 * @param {{ userDialect: string, learningDialect: string }} params
 * @param {string} token
 * @returns {Promise<string>} The generated hint
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
    throw new Error('[HangmanService] AI response missing hint field');
  }

  return parsed.hint.trim();
}

// ---------------------------------------------------------------------------
// Internal helpers — utilities
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON string returned by Gemini.
 * Strips markdown code fences if the model wraps the output despite jsonMode.
 *
 * @param {string | undefined} text
 * @returns {Record<string, unknown> | null}
 */
function _parseAIJson(text) {
  if (!text) return null;
  try {
    // Strip ```json ... ``` or ``` ... ``` wrappers just in case
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    console.error('[HangmanService] Failed to parse AI JSON:', text);
    return null;
  }
}

/** @returns {Promise<string>} Firebase ID token */
async function _getToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('[HangmanService] No authenticated user');
  return user.getIdToken();
}

// ---------------------------------------------------------------------------
// Path builders — single source of truth for all Firestore paths
//
// Pool document ID:   hangman__es-MX__food
// Words subcollection: gameWords/hangman__es-MX__food/words
// Progress collection: userGameProgress/{uid}/games
// Progress doc ID:    hangman__es-MX
// ---------------------------------------------------------------------------

/** @param {string} learningDialect @param {string} category @returns {string} */
function _buildPoolId(learningDialect, category) {
  return `${GAME_ID}__${learningDialect}__${category}`;
}

/** @param {string} poolId @returns {string} */
function _buildWordsCollection(poolId) {
  return `${COLLECTIONS.GAME_WORDS}/${poolId}/words`;
}

/** @param {string} uid @returns {string} */
function _buildProgressCollection(uid) {
  return `${COLLECTIONS.USER_PROGRESS}/${uid}/games`;
}

/** @param {string} learningDialect @returns {string} */
function _buildProgressDocId(learningDialect) {
  return `${GAME_ID}__${learningDialect}`;
}
