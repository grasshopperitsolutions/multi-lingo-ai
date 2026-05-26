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
 *   wordPool/{conceptId}/translations/{learningLocale}
 *     locale: string              // BCP-47, e.g. "pt-PT"
 *     language: string            // e.g. "pt"
 *     region: string | null       // e.g. "PT"
 *     script: string | null       // e.g. "Latn"
 *     word: string                // localized answer word
 *     hints: Record<string,string> // hint keyed by viewer's native locale (open-ended map)
 *     normalizedWord: string      // for comparisons
 *     graphemes: string[]         // pre-split for legacy; no longer consumed by the frontend
 *     source: string              // "human" | "ai" | "seed"
 *     verified: boolean
 *     qualityScore: number | null
 *     createdAt: Timestamp
 *     updatedAt: Timestamp
 *
 * Hint strategy:
 *   - The hints map is open-ended. No locale list is hardcoded here.
 *   - When a translation is fetched, _resolveHint() picks the best available
 *     hint for userDialect using a 4-step fallback chain.
 *   - If no hint exists for userDialect, _generateHintForDialect() asks the AI
 *     for exactly one hint in that language and _patchHint() merges it into
 *     the existing Firestore document without overwriting other keys.
 *   - When the AI creates a brand-new translation it only generates
 *     hints[userDialect] — nothing else. Other dialects are populated on demand
 *     the first time a user of that language encounters the word.
 *
 * Flow:
 *   1. Query wordPool where status == "ready", limit 200.
 *   2. Find the first concept whose ID is not in seenConceptIds.
 *
 *   BRANCH A — Unseen concept found:
 *     a. Fetch translations/{learningDialect} for that concept.
 *     b. Translation exists → resolve hint → if missing, await AI generation
 *        and patch into Firestore for future users → return.
 *     c. Translation missing → AI generates word + hints[userDialect],
 *        write full translation doc, return.
 *
 *   BRANCH B — All concepts seen (pool exhausted for this user):
 *     a. AI generates a brand-new concept + translation with hints[userDialect].
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
 * @property {string}   userDialect      - BCP-47 native language, e.g. 'en-US'
 * @property {string}   learningDialect  - BCP-47 target language, e.g. 'pt-PT'
 * @property {string[]} seenConceptIds   - Already-seen concept IDs for this game
 */

/**
 * @typedef {Object} WordResult
 * @property {string}    word       - Localized answer word
 * @property {string}    hint       - Hint in the user's native language
 * @property {string}    conceptId  - wordPool document ID
 * @property {'db'|'ai'} source
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-2.5-flash';
const POOL_LIMIT   = 200;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the next unseen word for the given dialect.
 *
 * @param {GetWordParams} params
 * @returns {Promise<WordResult>}
 */
export async function getWord({ token, userDialect, learningDialect, seenConceptIds }) {
  const seenSet = new Set(seenConceptIds ?? []);

  const concepts = await _fetchReadyConcepts(token);

  const unseenConcept = concepts.find((c) => !seenSet.has(c.id));

  if (unseenConcept) {
    const translation = await _fetchTranslation(unseenConcept.id, learningDialect, token);

    if (translation) {
      let hint = _resolveHint(translation.hints, userDialect);

      // No hint found for userDialect — generate one now so the current user
      // sees it immediately, then patch it into Firestore for future users.
      if (!hint) {
        hint = await _generateHintForDialect(unseenConcept.sourceWord, userDialect, token);
        _patchHint(unseenConcept.id, learningDialect, userDialect, hint, token)
          .catch((err) => console.warn('[getWordService] hint patch failed:', err));
      }

      return {
        word:      translation.word,
        hint:      hint || '',
        conceptId: unseenConcept.id,
        source:    'db',
      };
    }

    const generated = await _generateTranslation(
      unseenConcept.sourceWord,
      { userDialect, learningDialect },
      token
    );
    await _writeTranslation(unseenConcept.id, learningDialect, generated, token);

    return {
      word:      generated.word,
      hint:      generated.hints[userDialect] || '',
      conceptId: unseenConcept.id,
      source:    'ai',
    };
  }

  const knownWords = concepts.map((c) => c.normalizedKey);
  const generated  = await _generateNewConcept(
    { userDialect, learningDialect, knownWords },
    token
  );

  const conceptId = await _writeNewConcept(generated, learningDialect, token);

  return {
    word:      generated.word,
    hint:      generated.hints[userDialect] || '',
    conceptId,
    source:    'ai',
  };
}

/**
 * Return the total number of "ready" concepts in the word pool.
 * Used by the sidebar to compute the seen-words percentage.
 *
 * This intentionally reuses the same API endpoint as _fetchReadyConcepts
 * but only extracts the count — keeping all Firestore logic in the frontend
 * service layer, not the proxy API.
 *
 * @param {string} token - Firebase ID token
 * @returns {Promise<number>}
 */
export async function getWordPoolCount(token) {
  const concepts = await _fetchReadyConcepts(token);
  return concepts.length;
}

// ---------------------------------------------------------------------------
// Hint resolution
// ---------------------------------------------------------------------------

/**
 * Pick the best stored hint for userDialect using a 3-step chain:
 *   1. Exact locale match  (e.g. "en-US")
 *   2. Language-only match (e.g. "en-GB" satisfies "en-US")
 *   3. Return '' — caller will generate the hint on demand.
 *
 * Intentionally does NOT fall back to an arbitrary language so users never
 * receive a hint in the wrong language.
 */
function _resolveHint(hints, userDialect) {
  if (!hints || typeof hints !== 'object') return '';
  if (hints[userDialect]) return hints[userDialect];
  const lang      = userDialect.split('-')[0];
  const langMatch = Object.keys(hints).find((k) => k.startsWith(`${lang}-`));
  if (langMatch) return hints[langMatch];
  // No suitable hint found — return '' so the caller triggers on-demand generation.
  return '';
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

async function _fetchReadyConcepts(token) {
  const params = new URLSearchParams({
    collection: 'wordPool',
    filters: JSON.stringify([{ field: 'status', op: '==', value: 'ready' }]),
    limit: String(POOL_LIMIT),
  });
  const response = await fetch(
    `${PROXY_URL}/api/firestore?${params}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to fetch word pool');
  return json?.data?.documents ?? [];
}

async function _fetchTranslation(conceptId, locale, token) {
  const col      = `wordPool/${conceptId}/translations`;
  const response = await fetch(
    `${PROXY_URL}/api/firestore?collection=${encodeURIComponent(col)}&id=${encodeURIComponent(locale)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  if (response.status === 404) return null;
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to fetch translation');
  return json?.data?.data ?? null;
}

async function _writeTranslation(conceptId, locale, data, token) {
  const col      = `wordPool/${conceptId}/translations`;
  const now      = new Date().toISOString();
  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: col,
      id:   locale,
      data: {
        locale,
        language:      locale.split('-')[0],
        region:        locale.includes('-') ? locale.split('-')[1] : null,
        script:        null,
        word:          data.word,
        hints:         data.hints,
        normalizedWord: data.word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
        source:        'ai',
        verified:      false,
        qualityScore:  null,
        createdAt:     now,
        updatedAt:     now,
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to write translation');
}

async function _patchHint(conceptId, learningLocale, hintLocale, hintText, token) {
  const col      = `wordPool/${conceptId}/translations`;
  const now      = new Date().toISOString();
  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      collection: col,
      id:   learningLocale,
      data: {
        [`hints.${hintLocale}`]: hintText,
        updatedAt:               now,
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to patch hint');
}

async function _writeNewConcept(generated, learningDialect, token) {
  const now = new Date().toISOString();

  const conceptResponse = await fetch(`${PROXY_URL}/api/firestore`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

  await _writeTranslation(conceptId, learningDialect, generated, token);

  return conceptId;
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

async function _generateTranslation(sourceWord, { userDialect, learningDialect }, token) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        `You are a language learning assistant.`,
        `Translate the English word "${sourceWord}" into ${learningDialect}.`,
        `Return a JSON object with:`,
        `  - "word": the translated word in ${learningDialect}, lowercase, no extra spaces.`,
        `  - "hint": one sentence in ${userDialect} describing the word without saying it, suitable for a guessing game.`,
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
  return {
    word,
    hints: { [userDialect]: parsed.hint.trim() },
  };
}

async function _generateHintForDialect(sourceWord, userDialect, token) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        `You are a language learning assistant.`,
        `Write exactly one sentence in ${userDialect} that describes the word "${sourceWord}" without saying it.`,
        `The sentence should be suitable as a hint in a word-guessing game.`,
        `Return a JSON object with a single "hint" field.`,
        `Return ONLY valid JSON. No markdown, no explanation.`,
      ].join('\n'),
      providerParams: {
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.7,
        jsonMode:    true,
        responseSchema: {
          type:       'object',
          properties: { hint: { type: 'string' } },
          required:   ['hint'],
        },
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'AI hint generation failed');

  const parsed = _parseAIJson(json?.text ?? json?.data?.text);
  if (!parsed?.hint) throw new Error('[getWordService] AI response missing hint');
  return parsed.hint.trim();
}

async function _generateNewConcept({ userDialect, learningDialect, knownWords }, token) {
  const avoidList = knownWords.length > 0
    ? `Do NOT use any of these (already in the database): ${knownWords.join(', ')}`
    : '';

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        `You are a language learning assistant.`,
        `Generate exactly ONE common vocabulary word.`,
        `Return a JSON object with:`,
        `  - "sourceWord": the English label for the concept, lowercase.`,
        `  - "word": the translation in ${learningDialect}, lowercase.`,
        `  - "hint": one sentence in ${userDialect} describing the word without saying it, suitable for a guessing game.`,
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
    hints: { [userDialect]: parsed.hint.trim() },
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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
