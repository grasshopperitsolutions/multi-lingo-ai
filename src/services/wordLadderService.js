import { parseAIJSON } from '../utils/parseAIJSON';
import { askAI } from './aiService';

const PROXY_URL       = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL    = 'gemini-3.5-flash-lite';
const MIN_WORDS       = 4;
const MAX_WORDS       = 6;
const POOL_COLLECTION = 'wordLadderGamePool';
const POOL_LIMIT      = 200;
const MAX_STRIKES     = 3;

export { MAX_STRIKES };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the next unseen Word Ladder puzzle.
 *
 * Strategy (cache-first):
 *   1. Query wordLadderGamePool for puzzles matching learningDialect + userDialect.
 *   2. Filter out already-seen puzzle IDs client-side.
 *   3. Return first unseen cached puzzle if found.
 *   4. Otherwise generate a new one via AI, cache it silently, return it.
 *
 * @param {object}   params
 * @param {string}   params.token            - Firebase ID token
 * @param {string}   params.userDialect      - BCP-47 interface language (e.g. 'en-US')
 * @param {string}   params.learningDialect  - BCP-47 learning language (e.g. 'pt-PT')
 * @param {string[]} params.seenPuzzleIds    - Already-seen puzzle IDs from seenWordLadderPuzzleIds
 * @returns {Promise<{ puzzleId: string, words: string[], clues: string[], wordLength: number }>}
 */
export const fetchWordLadderPuzzle = async ({ token, userDialect, learningDialect, seenPuzzleIds = [] }) => {
  const seenSet = new Set(seenPuzzleIds);

  // ── Step 1: try to find an unseen cached puzzle ──────────────────────────
  try {
    const cached = await _fetchCachedPuzzles(token, userDialect, learningDialect);
    const unseen = cached.find((p) => !seenSet.has(p.id));

    if (unseen) {
      return {
        puzzleId:   unseen.id,
        words:      unseen.words,
        clues:      unseen.clues,
        wordLength: unseen.wordLength,
      };
    }
  } catch (err) {
    console.warn('[wordLadderService] Pool fetch failed, falling back to AI:', err);
  }

  // ── Step 2: generate via AI ──────────────────────────────────────────────
  const puzzle = await _generateFromAI({ token, userDialect, learningDialect });

  // ── Step 3: cache silently (fire-and-forget) ─────────────────────────────
  let puzzleId = `ai_${Date.now()}`;
  try {
    const savedId = await _cachePuzzle({ token, puzzle, userDialect, learningDialect });
    if (savedId) puzzleId = savedId;
  } catch (err) {
    console.warn('[wordLadderService] Cache write failed (non-fatal):', err);
  }

  return { puzzleId, ...puzzle };
};

/**
 * Return the total number of cached puzzles for a given dialect pair.
 *
 * @param {string} token
 * @param {string} userDialect
 * @param {string} learningDialect
 * @returns {Promise<number>}
 */
export const getWordLadderPoolCount = async (token, userDialect, learningDialect) => {
  try {
    const puzzles = await _fetchCachedPuzzles(token, userDialect, learningDialect);
    return puzzles.length;
  } catch {
    return 0;
  }
};

// ---------------------------------------------------------------------------
// Private — AI generation
// ---------------------------------------------------------------------------

async function _generateFromAI({ token, userDialect, learningDialect }) {
  const prompt = [
    `You are generating a "Word Ladder" language-learning puzzle in ${learningDialect}.`,
    ``,
    `Rules:`,
    `- Generate a chain of ${MIN_WORDS}–${MAX_WORDS} words, all the SAME length (4–6 letters preferred).`,
    `- Each adjacent pair of words must differ by EXACTLY ONE letter.`,
    `- Every word must be a real, standalone dictionary word in ${learningDialect}.`,
    `- No proper nouns, no abbreviations, no vulgar words.`,
    `- For each word, provide a SHORT clue/definition in ${userDialect} (max 8 words).`,
    `- "words" array and "clues" array must have the same length.`,
    `- "wordLength" must be the letter count of each word (they are all the same).`,
    ``,
    `Return JSON with keys: words (string[]), clues (string[]), wordLength (number).`,
  ].join('\n');

  const data = await askAI(token, prompt, {
    provider:    'gemini',
    model:       GEMINI_MODEL,
    temperature: 0.7,
    jsonMode:    true,
    responseSchema: {
      type: 'object',
      properties: {
        words:      { type: 'array', items: { type: 'string' } },
        clues:      { type: 'array', items: { type: 'string' } },
        wordLength: { type: 'number' },
      },
      required: ['words', 'clues', 'wordLength'],
    },
  });

  const parsed = parseAIJSON(data?.text ?? '');

  const words      = parsed?.words;
  const clues      = parsed?.clues;
  const wordLength = parsed?.wordLength;

  if (!Array.isArray(words) || !Array.isArray(clues) || typeof wordLength !== 'number') {
    throw new Error('Invalid puzzle format from AI');
  }
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) {
    throw new Error(`AI returned ${words.length} words, expected ${MIN_WORDS}–${MAX_WORDS}`);
  }
  if (words.length !== clues.length) {
    throw new Error('words and clues arrays must be the same length');
  }

  // Validate adjacency: each pair must differ by exactly 1 letter
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].toLowerCase();
    const b = words[i + 1].toLowerCase();
    if (a.length !== b.length) throw new Error(`Words "${words[i]}" and "${words[i+1]}" differ in length`);
    const diffs = [...a].filter((ch, idx) => ch !== b[idx]).length;
    if (diffs !== 1) throw new Error(`Words "${words[i]}" and "${words[i+1]}" differ by ${diffs} letters, expected 1`);
  }

  return { words, clues, wordLength };
}

// ---------------------------------------------------------------------------
// Private — Firestore helpers
// ---------------------------------------------------------------------------

async function _fetchCachedPuzzles(token, userDialect, learningDialect) {
  const params = new URLSearchParams({
    collection: POOL_COLLECTION,
    filters: JSON.stringify([
      { field: 'learningDialect', op: '==', value: learningDialect },
      { field: 'userDialect',     op: '==', value: userDialect },
    ]),
    limit: String(POOL_LIMIT),
  });

  const res = await fetch(`${PROXY_URL}/api/firestore?${params}`, {
    method:  'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to fetch puzzle pool');

  return json?.data?.documents ?? [];
}

async function _cachePuzzle({ token, puzzle, userDialect, learningDialect }) {
  const res = await fetch(`${PROXY_URL}/api/firestore`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: POOL_COLLECTION,
      data: {
        learningDialect,
        userDialect,
        words:      puzzle.words,
        clues:      puzzle.clues,
        wordLength: puzzle.wordLength,
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to cache puzzle');

  return json?.data?.id ?? null;
}
