/**
 * getWordService.js
 *
 * Retrieves the next unseen word for a user from the shared `wordPool`
 * Firestore collection.
 *
 * The caller is responsible for fetching user game progress (seenConceptIds)
 * via userService.getUserGameProgress() and for marking the concept as seen
 * via userService.markConceptSeen() after a successful fetch.
 * This keeps the service focused on a single concern: finding and returning
 * a suitable word.
 *
 * Firestore schema consumed:
 *
 *   wordPool/{conceptId}
 *     sourceLang: string          // usually "en"
 *     sourceWord: string          // canonical English label, e.g. "bat"
 *     senseKey: string | null     // e.g. "animal", "sports_equipment"
 *     pos: string | null          // "noun", "verb", "adjective" …
 *     normalizedKey: string       // lowercase/stripped, e.g. "bat"
 *     status: string              // "draft" | "ready" | "blocked"
 *     createdAt: Timestamp
 *     updatedAt: Timestamp
 *
 *   wordPool/{conceptId}/translations/{locale}
 *     locale: string              // BCP-47, e.g. "pt-BR"
 *     language: string            // e.g. "pt"
 *     region: string | null       // e.g. "BR"
 *     script: string | null       // e.g. "Latn"
 *     word: string                // localized answer word
 *     hint: string                // localized hint (in user's native language)
 *     normalizedWord: string      // for comparisons
 *     graphemes: string[]         // pre-split for Hangman / letter-based games
 *     source: string              // "human" | "ai" | "seed"
 *     verified: boolean
 *     qualityScore: number | null
 *     createdAt: Timestamp
 *     updatedAt: Timestamp
 *
 * Flow:
 *   1. Query wordPool where status == "ready", limit 200.
 *   2. Find the first concept whose ID is not in seenConceptIds.
 *
 *   BRANCH A — Unseen concept found:
 *     a. Fetch translations/{learningDialect} for that concept.
 *     b. Translation exists → return immediately.
 *     c. Translation missing → call AI to generate word + hint,
 *        write translations/{learningDialect}, return.
 *
 *   BRANCH B — All concepts seen (pool exhausted for this user):
 *     a. Call AI to generate a brand-new concept + translation.
 *     b. Write wordPool/{newConceptId} + translations/{learningDialect}.
 *     c. Return the fresh word.
 *
 * @module getWordService
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only — no runtime cost)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GetWordParams
 * @property {string}   token            - Firebase ID token
 * @property {string}   userDialect      - BCP-47 native language, e.g. 'en'
 * @property {string}   learningDialect  - BCP-47 target language, e.g. 'pt-PT'
 * @property {string[]} seenConceptIds   - Already-seen concept IDs for this game
 */

/**
 * @typedef {Object} WordResult
 * @property {string}   word        - Localized answer word
 * @property {string}   hint        - Hint in the user's native language
 * @property {string[]} graphemes   - Pre-split grapheme array
 * @property {string}   conceptId   - wordPool document ID
 * @property {'db'|'ai'} source
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-2.0-flash';
const POOL_LIMIT   = 200;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the next unseen word for the given dialect.
 *
 * The caller owns progress tracking:
 *   1. Call userService.getUserGameProgress() to get seenConceptIds.
 *   2. Call getWord() with those IDs.
 *   3. Call userService.markConceptSeen() with the returned conceptId.
 *
 * @param {GetWordParams} params
 * @returns {Promise<WordResult>}
 *
 * @example
 * const progress = await getUserGameProgress(token, uid, 'hangman', 'pt-PT');
 * const result   = await getWord({
 *   token,
 *   userDialect:     'en',
 *   learningDialect: 'pt-PT',
 *   seenConceptIds:  progress?.seenConceptIds ?? [],
 * });
 * await markConceptSeen(token, uid, 'hangman', 'pt-PT', result.conceptId, progress);
 */
export async function getWord({ token, userDialect, learningDialect, seenConceptIds }) {
  const seenSet = new Set(seenConceptIds ?? []);

  // ── Step 1: Query ready concepts from wordPool ────────────────────────────
  const concepts = await _fetchReadyConcepts(token);

  // ── Step 2: Find first unseen concept ────────────────────────────────────
  const unseenConcept = concepts.find((c) => !seenSet.has(c.id));

  // ── BRANCH A: Unseen concept found ────────────────────────────────────────
  if (unseenConcept) {
    const translation = await _fetchTranslation(unseenConcept.id, learningDialect, token);

    if (translation) {
      return {
        word:       translation.word,
        hint:       translation.hint,
        graphemes:  translation.graphemes ?? _splitGraphemes(translation.word),
        conceptId:  unseenConcept.id,
        source:     'db',
      };
    }

    // Translation missing — generate it via AI and persist
    const generated = await _generateTranslation(
      unseenConcept.sourceWord,
      { userDialect, learningDialect },
      token
    );
    await _writeTranslation(unseenConcept.id, learningDialect, generated, token);

    return {
      word:      generated.word,
      hint:      generated.hint,
      graphemes: generated.graphemes,
      conceptId: unseenConcept.id,
      source:    'ai',
    };
  }

  // ── BRANCH B: Pool exhausted — generate a brand-new concept ──────────────
  const knownWords = concepts.map((c) => c.normalizedKey);
  const generated  = await _generateNewConcept(
    { userDialect, learningDialect, knownWords },
    token
  );

  const conceptId = await _writeNewConcept(generated, learningDialect, token);

  return {
    word:      generated.word,
    hint:      generated.hint,
    graphemes: generated.graphemes,
    conceptId,
    source:    'ai',
  };
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/**
 * Query wordPool for status == "ready", up to POOL_LIMIT concepts.
 *
 * @param {string} token
 * @returns {Promise<Array<{ id: string, sourceWord: string, normalizedKey: string }>>}
 */
async function _fetchReadyConcepts(token) {
  const response = await fetch(
    `${PROXY_URL}/api/firestore?collection=wordPool&filters=${encodeURIComponent(JSON.stringify([{ field: 'status', op: '==', value: 'ready' }]))}&limit=${POOL_LIMIT}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to fetch word pool');
  return json?.data?.documents ?? [];
}

/**
 * Fetch a single translation subdocument.
 * Returns null when the translation doesn't exist yet.
 *
 * @param {string} conceptId
 * @param {string} locale
 * @param {string} token
 * @returns {Promise<{ word: string, hint: string, graphemes: string[] } | null>}
 */
async function _fetchTranslation(conceptId, locale, token) {
  const collection = `wordPool/${conceptId}/translations`;
  const response   = await fetch(
    `${PROXY_URL}/api/firestore?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(locale)}`,
    {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  );
  if (response.status === 404) return null;
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to fetch translation');
  return json?.data?.data ?? null;
}

/**
 * Write (create) a translation subdocument.
 *
 * @param {string} conceptId
 * @param {string} locale
 * @param {{ word: string, hint: string, graphemes: string[] }} data
 * @param {string} token
 */
async function _writeTranslation(conceptId, locale, data, token) {
  const collection = `wordPool/${conceptId}/translations`;
  const now        = new Date().toISOString();

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection,
      id: locale,
      data: {
        locale,
        language:       locale.split('-')[0],
        region:         locale.includes('-') ? locale.split('-')[1] : null,
        script:         null,
        word:           data.word,
        hint:           data.hint,
        normalizedWord: data.word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
        graphemes:      data.graphemes,
        source:         'ai',
        verified:       false,
        qualityScore:   null,
        createdAt:      now,
        updatedAt:      now,
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to write translation');
}

/**
 * Write a new concept document + its first translation subdocument.
 *
 * @param {{ sourceWord: string, word: string, hint: string, graphemes: string[] }} generated
 * @param {string} learningDialect
 * @param {string} token
 * @returns {Promise<string>} The new conceptId
 */
async function _writeNewConcept(generated, learningDialect, token) {
  const now = new Date().toISOString();

  // Create the concept document (auto-generated ID)
  const conceptResponse = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: 'wordPool',
      data: {
        sourceLang:    'en',
        sourceWord:    generated.sourceWord,
        senseKey:      null,
        pos:           null,
        normalizedKey: generated.sourceWord.toLowerCase().trim(),
        status:        'ready',
        createdAt:     now,
        updatedAt:     now,
      },
    }),
  });
  const conceptJson = await conceptResponse.json();
  if (!conceptResponse.ok)
    throw new Error(conceptJson?.error || conceptJson?.message || 'Failed to create concept');

  const conceptId = conceptJson?.data?.id;
  if (!conceptId) throw new Error('[getWordService] Concept write did not return an ID');

  // Write the first translation for this concept
  await _writeTranslation(conceptId, learningDialect, generated, token);

  return conceptId;
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

/**
 * Ask AI to generate a translation (word + hint) for an existing concept.
 *
 * @param {string} sourceWord     - Canonical English word
 * @param {{ userDialect: string, learningDialect: string }} params
 * @param {string} token
 * @returns {Promise<{ word: string, hint: string, graphemes: string[] }>}
 */
async function _generateTranslation(sourceWord, { userDialect, learningDialect }, token) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        `You are a language learning assistant.`,
        `Translate the English word "${sourceWord}" into ${learningDialect}.`,
        `Return a JSON object with:`,
        `  - "word": the translated word, lowercase, no leading/trailing spaces.`,
        `  - "hint": one sentence in ${userDialect} describing the word without saying it. Suitable for a guessing game.`,
        `Return ONLY valid JSON. No markdown, no explanation.`,
      ].join('\n'),
      providerParams: {
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.7,
        jsonMode:    true,
        responseSchema: {
          type: 'object',
          properties: {
            word: { type: 'string' },
            hint: { type: 'string' },
          },
          required: ['word', 'hint'],
        },
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'AI translation failed');

  const parsed = _parseAIJson(json?.text ?? json?.data?.text);
  if (!parsed?.word || !parsed?.hint)
    throw new Error('[getWordService] AI response missing word or hint');

  const word = parsed.word.trim().toLowerCase();
  return { word, hint: parsed.hint.trim(), graphemes: _splitGraphemes(word) };
}

/**
 * Ask AI to generate a brand-new concept + translation.
 * knownWords is passed to avoid duplicating existing pool entries.
 *
 * @param {{ userDialect: string, learningDialect: string, knownWords: string[] }} params
 * @param {string} token
 * @returns {Promise<{ sourceWord: string, word: string, hint: string, graphemes: string[] }>}
 */
async function _generateNewConcept({ userDialect, learningDialect, knownWords }, token) {
  const avoidList = knownWords.length > 0
    ? `Do NOT use any of these (already in the database): ${knownWords.join(', ')}`
    : '';

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        `You are a language learning assistant.`,
        `Generate exactly ONE common vocabulary word.`,
        `Return a JSON object with:`,
        `  - "sourceWord": the English label for the concept, lowercase.`,
        `  - "word": the translation in ${learningDialect}, lowercase.`,
        `  - "hint": one sentence in ${userDialect} describing the word without saying it. Suitable for a guessing game.`,
        avoidList,
        `Return ONLY valid JSON. No markdown, no explanation.`,
      ].filter(Boolean).join('\n'),
      providerParams: {
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.9,
        jsonMode:    true,
        responseSchema: {
          type: 'object',
          properties: {
            sourceWord: { type: 'string' },
            word:       { type: 'string' },
            hint:       { type: 'string' },
          },
          required: ['sourceWord', 'word', 'hint'],
        },
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'AI concept generation failed');

  const parsed = _parseAIJson(json?.text ?? json?.data?.text);
  if (!parsed?.sourceWord || !parsed?.word || !parsed?.hint)
    throw new Error('[getWordService] AI response missing required fields');

  const word = parsed.word.trim().toLowerCase();
  return {
    sourceWord: parsed.sourceWord.trim().toLowerCase(),
    word,
    hint:       parsed.hint.trim(),
    graphemes:  _splitGraphemes(word),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Safely parse a JSON string returned by an AI model.
 * Strips markdown code fences if present despite jsonMode.
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

/**
 * Split a word into its grapheme clusters.
 * Uses Intl.Segmenter when available (modern browsers) and falls back
 * to Array.from() which correctly handles most Unicode characters.
 *
 * @param {string} word
 * @returns {string[]}
 */
function _splitGraphemes(word) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter().segment(word)].map((s) => s.segment);
  }
  return Array.from(word);
}
