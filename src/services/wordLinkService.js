const PROXY_URL       = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL    = 'gemini-3.5-flash';
const MAX_CLUES       = 5;
const POOL_COLLECTION = 'wordLinkGamePool';
const POOL_LIMIT      = 200;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the next unseen Word Link puzzle.
 *
 * Strategy (cache-first):
 *   1. Query wordLinkGamePool for puzzles matching learningDialect + userDialect.
 *   2. Filter out already-seen puzzle IDs client-side.
 *   3. Return first unseen cached puzzle if found.
 *   4. Otherwise generate a new one via AI, cache it silently, return it.
 *
 * @param {object}   params
 * @param {string}   params.token            - Firebase ID token
 * @param {string}   params.userDialect      - BCP-47 interface language (e.g. 'en-US')
 * @param {string}   params.learningDialect  - BCP-47 learning language (e.g. 'pt-PT')
 * @param {string[]} params.seenPuzzleIds    - Already-seen puzzle IDs from seenWordLinkPuzzleIds
 * @returns {Promise<{ puzzleId: string, theme: string, themeTranslation: string, clues: string[], keywords: string[] }>}
 */
export const fetchWordLinkPuzzle = async ({ token, userDialect, learningDialect, seenPuzzleIds = [] }) => {
  const seenSet = new Set(seenPuzzleIds);

  // ── Step 1: try to find an unseen cached puzzle ──────────────────────────
  try {
    const cached = await _fetchCachedPuzzles(token, userDialect, learningDialect);
    const unseen = cached.find((p) => !seenSet.has(p.id));

    if (unseen) {
      return {
        puzzleId:         unseen.id,
        theme:            unseen.theme,
        themeTranslation: unseen.themeTranslation,
        clues:            unseen.clues,
        keywords:         unseen.keywords,
      };
    }
  } catch (err) {
    console.warn('[wordLinkService] Pool fetch failed, falling back to AI:', err);
  }

  // ── Step 2: generate via AI ──────────────────────────────────────────────
  const puzzle = await _generateFromAI({ token, userDialect, learningDialect });

  // ── Step 3: cache silently (fire-and-forget) ─────────────────────────────
  let puzzleId = `ai_${Date.now()}`;
  try {
    const savedId = await _cachePuzzle({ token, puzzle, userDialect, learningDialect });
    if (savedId) puzzleId = savedId;
  } catch (err) {
    console.warn('[wordLinkService] Cache write failed (non-fatal):', err);
  }

  return { puzzleId, ...puzzle };
};

/**
 * Return the total number of cached puzzles for a given dialect pair.
 * Used by the sidebar to show pool size.
 *
 * @param {string} token
 * @param {string} userDialect
 * @param {string} learningDialect
 * @returns {Promise<number>}
 */
export const getWordLinkPoolCount = async (token, userDialect, learningDialect) => {
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
    `You are generating a "Word Link" language-learning puzzle.`,
    ``,
    `The puzzle consists of:`,
    `- A hidden THEME (2–5 words) describing a category, e.g. "Names of fruits"`,
    `- Exactly 5 CLUE WORDS in ${learningDialect} that belong to that category,`,
    `  ordered from hardest to easiest (last clue = most obvious giveaway)`,
    `- ACCEPTED KEYWORDS: single words a learner could type to correctly guess the theme`,
    ``,
    `Rules:`,
    `- All 5 clue words must be in ${learningDialect}`,
    `- "theme" must be in ${userDialect}`,
    `- "themeTranslation" must be the same theme expressed in ${learningDialect}`,
    `- "keywords" must include the key noun(s) from the theme in BOTH ${userDialect} AND ${learningDialect},`,
    `  including singular and plural forms of each`,
    `  e.g. for "Names of fruits": ["fruit", "fruits", "fruta", "frutas"]`,
    `- Clues must be genuine members of the theme category`,
    `- First clue = least obvious, last clue = most obvious`,
    `- Provide at least 4 accepted keywords (both languages, singular + plural)`,
  ].join('\n');

  const res = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.9,
        jsonMode:    true,
        responseSchema: {
          type: 'object',
          properties: {
            theme:            { type: 'string' },
            themeTranslation: { type: 'string' },
            clues:            { type: 'array', items: { type: 'string' } },
            keywords:         { type: 'array', items: { type: 'string' } },
          },
          required: ['theme', 'themeTranslation', 'clues', 'keywords'],
        },
      },
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || j?.message || 'Failed to generate Word Link puzzle');
  }

  const json = await res.json();
  const data = json?.data ?? json;

  const theme            = data?.theme;
  const themeTranslation = data?.themeTranslation;
  const clues            = data?.clues;
  const keywords         = data?.keywords;

  if (!theme || !themeTranslation || !Array.isArray(clues) || !Array.isArray(keywords)) {
    throw new Error('Invalid puzzle format from AI');
  }
  if (clues.length !== MAX_CLUES) {
    throw new Error(`AI returned ${clues.length} clues, expected ${MAX_CLUES}`);
  }
  if (keywords.length < 1) {
    throw new Error('AI returned no accepted keywords');
  }

  return {
    theme,
    themeTranslation,
    clues:    clues.slice(0, MAX_CLUES),
    keywords,
  };
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
        theme:            puzzle.theme,
        themeTranslation: puzzle.themeTranslation,
        clues:            puzzle.clues,
        keywords:         puzzle.keywords,
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || json?.message || 'Failed to cache puzzle');

  return json?.data?.id ?? null;
}
