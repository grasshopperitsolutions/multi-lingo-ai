/**
 * storyService.js
 *
 * Two public exports:
 *
 * 1. fetchOrGenerateStory() — Firebase-first orchestrator.
 *    - Queries `storyPool` for unseen stories in the user's learning language & level.
 *    - If found, returns a cached story and marks it as seen (optimistic context update
 *      + background Firestore PATCH on the users doc).
 *    - If the pool is exhausted (all stories seen or collection empty), calls the AI,
 *      saves the result to `storyPool`, and marks it as seen.
 *
 * 2. generateStory() — raw AI call (kept for direct use / testing).
 *    - Returns only { storyText, wordsUsed } — no translation.
 */

import {
  queryCollection,
  createDocument,
  patchDocument,
} from './firestoreService';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {'beginner' | 'intermediate' | 'advanced'} DifficultyLevel
 */

/**
 * @typedef {Object} FetchOrGenerateParams
 * @property {string}          token        - Firebase ID token
 * @property {string}          uid          - Firebase user UID (for seenStoryIds patch)
 * @property {string[]}        words        - Vocabulary words to weave into the story
 * @property {string}          learningLang - BCP-47 locale for the story, e.g. 'pt-PT'
 * @property {DifficultyLevel} [level]      - Story complexity (default: 'intermediate')
 * @property {string[]}        [seenStoryIds] - IDs already seen by this user
 * @property {function}        [onSeenUpdate] - Callback(storyId) to update context optimistically
 */

/**
 * @typedef {Object} StoryResult
 * @property {string}   id         - Firestore document ID (null for AI-fresh if save fails)
 * @property {string}   storyText  - The full story written in learningLang
 * @property {string[]} wordsUsed  - Subset of the requested words that appear in the story
 * @property {boolean}  fromCache  - true if served from storyPool, false if AI-generated
 */

/**
 * @typedef {Object} GenerateStoryParams
 * @property {string}          token         - Firebase ID token
 * @property {string[]}        words         - Vocabulary words to weave into the story
 * @property {string}          learningLang  - BCP-47 locale for the story
 * @property {DifficultyLevel} [level]       - Story complexity (default: 'intermediate')
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-2.5-flash';
const STORY_POOL_COLLECTION = 'storyPool';

const LEVEL_INSTRUCTIONS = {
  beginner: [
    'Use very short, simple sentences (max 8 words each).',
    'Use only common, everyday vocabulary. Avoid idioms or complex grammar.',
    'The story should be 4–6 sentences long.',
  ],
  intermediate: [
    'Use moderately complex sentences with some variety in structure.',
    'You may use common idioms where natural, but keep them accessible.',
    'The story should be 6–9 sentences long.',
  ],
  advanced: [
    'Use rich, varied sentence structures including subordinate clauses.',
    'You may use idiomatic expressions, literary devices, and nuanced vocabulary.',
    'The story should be 8–12 sentences long.',
  ],
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    storyText: { type: 'string' },
    wordsUsed: { type: 'array', items: { type: 'string' } },
  },
  required: ['storyText', 'wordsUsed'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats the word list for the prompt in a human-readable way.
 * @param {string[]} words
 * @returns {string}
 */
function formatWordList(words) {
  return words.map((w) => `"${w.trim()}"`).join(', ');
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Persist a new storyId into the user's seenStoryIds array in Firestore.
 * Fire-and-forget — errors are silently swallowed so they never block the UI.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string[]} currentSeenIds - The already-known list (from context)
 * @param {string} newId
 */
async function persistSeenStoryId(token, uid, currentSeenIds, newId) {
  try {
    const merged = Array.from(new Set([...currentSeenIds, newId]));
    await patchDocument('users', uid, { seenStoryIds: merged }, token);
  } catch {
    // Non-critical — context is already updated optimistically
  }
}

// ---------------------------------------------------------------------------
// Public API — fetchOrGenerateStory
// ---------------------------------------------------------------------------

/**
 * Firebase-first story fetcher.
 *
 * 1. Queries storyPool for unseen stories matching language + level.
 * 2. If found → returns a random unseen one, marks it as seen.
 * 3. If pool is exhausted → generates via AI, saves to storyPool, marks as seen.
 *
 * @param {FetchOrGenerateParams} params
 * @returns {Promise<StoryResult>}
 */
export async function fetchOrGenerateStory({
  token,
  uid,
  words,
  learningLang,
  level = 'intermediate',
  seenStoryIds = [],
  onSeenUpdate,
}) {
  if (!token)       throw new Error('[storyService] token is required');
  if (!uid)         throw new Error('[storyService] uid is required');
  if (!learningLang) throw new Error('[storyService] learningLang is required');

  // ── Step 1: query storyPool ──────────────────────────────────────────────
  let poolDocs = [];
  try {
    const result = await queryCollection(
      STORY_POOL_COLLECTION,
      { language: learningLang, level },
      { limit: 100 },
      token,
    );
    poolDocs = result?.documents ?? result?.data ?? [];
  } catch {
    // If the collection doesn't exist yet or query fails, treat as empty pool
    poolDocs = [];
  }

  // ── Step 2: filter out already-seen stories ──────────────────────────────
  const seenSet   = new Set(seenStoryIds);
  const unseen    = poolDocs.filter((doc) => !seenSet.has(doc.id));

  // ── Step 3: serve from cache if possible ────────────────────────────────
  if (unseen.length > 0) {
    const picked = pickRandom(unseen);
    const storyId = picked.id;
    const data    = picked.data ?? picked;

    // Optimistic context update
    onSeenUpdate?.(storyId);
    // Background Firestore persist
    persistSeenStoryId(token, uid, seenStoryIds, storyId);

    return {
      id:        storyId,
      storyText: data.storyText ?? '',
      wordsUsed: Array.isArray(data.wordsUsed) ? data.wordsUsed : [],
      fromCache: true,
    };
  }

  // ── Step 4: pool exhausted — generate via AI ─────────────────────────────
  if (!Array.isArray(words) || words.length === 0) {
    throw new Error('[storyService] words must be a non-empty array when generating a new story');
  }

  const { storyText, wordsUsed } = await generateStory({
    token,
    words,
    learningLang,
    level,
  });

  // ── Step 5: save to storyPool ────────────────────────────────────────────
  let savedId = null;
  try {
    const saved = await createDocument(
      STORY_POOL_COLLECTION,
      {
        language:  learningLang,
        level,
        words,
        storyText,
        wordsUsed,
        createdAt: new Date().toISOString(),
        createdBy: uid,
      },
      undefined, // auto-generate Firestore ID
      token,
    );
    savedId = saved?.id ?? saved?.docId ?? null;
  } catch {
    // Non-critical — story is still returned even if save fails
  }

  // ── Step 6: mark as seen ─────────────────────────────────────────────────
  if (savedId) {
    onSeenUpdate?.(savedId);
    persistSeenStoryId(token, uid, seenStoryIds, savedId);
  }

  return {
    id:        savedId,
    storyText,
    wordsUsed,
    fromCache: false,
  };
}

// ---------------------------------------------------------------------------
// Public API — generateStory (raw AI call)
// ---------------------------------------------------------------------------

/**
 * Generate a short story that incorporates the given vocabulary words.
 * Returns only the story text and words used — no translation.
 *
 * @param {GenerateStoryParams} params
 * @returns {Promise<{ storyText: string, wordsUsed: string[] }>}
 */
export async function generateStory({
  token,
  words,
  learningLang,
  level = 'intermediate',
}) {
  if (!token)                          throw new Error('[storyService] token is required');
  if (!Array.isArray(words) || words.length === 0)
    throw new Error('[storyService] words must be a non-empty array');
  if (!learningLang)                   throw new Error('[storyService] learningLang is required');

  const resolvedLevel = LEVEL_INSTRUCTIONS[level] ? level : 'intermediate';
  const levelLines    = LEVEL_INSTRUCTIONS[resolvedLevel];
  const wordList      = formatWordList(words);

  const prompt = [
    `You are a creative language-learning story writer.`,
    ``,
    `Write a short, engaging, coherent story in this language (BCP-47): ${learningLang}.`,
    `The story must naturally incorporate as many of the following vocabulary words as possible:`,
    `${wordList}`,
    ``,
    `Difficulty level: ${resolvedLevel}`,
    ...levelLines,
    ``,
    `Rules:`,
    `- The story must be a single cohesive narrative with a clear beginning and end.`,
    `- Do NOT list the words separately. Weave them naturally into the prose.`,
    `- Do NOT add a title to the story.`,
    `- If a word cannot be incorporated naturally, leave it out — do not force it.`,
    ``,
    `Return a JSON object with exactly two fields:`,
    ``,
    `- "storyText": the full story written in ${learningLang}.`,
    `- "wordsUsed": an array containing only the words from the input list that`,
    `  actually appear in the story (use the exact forms provided in the input list,`,
    `  not inflected forms).`,
    ``,
    `Do NOT add any explanation, notes, translation, or extra fields outside the JSON.`,
  ].join('\n');

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:       'gemini',
        model:          GEMINI_MODEL,
        temperature:    0.8,
        jsonMode:       true,
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[storyService] Request failed (${response.status})`
    );
  }

  const raw = json?.data?.text ?? json?.text ?? '';
  if (!raw) throw new Error('[storyService] Empty response returned');

  let parsed;
  try {
    parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
  } catch {
    throw new Error('[storyService] Could not parse AI response as JSON');
  }

  const storyText = (parsed?.storyText ?? '').trim();
  const wordsUsed = Array.isArray(parsed?.wordsUsed)
    ? parsed.wordsUsed.map((w) => String(w).trim()).filter(Boolean)
    : [];

  if (!storyText) throw new Error('[storyService] No story text returned');

  return { storyText, wordsUsed };
}
