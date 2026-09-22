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
 *     topicIds: string[]          // interest-category IDs (appConfig/config/categories doc IDs)
 *                                 // this word belongs to; a word can belong to several.
 *                                 // Absent on anything created before interests existed.
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
 *     baseForm: string | null     // dictionary form of `word` in its own language
 *                                 // ("ir" for "foram"). Metadata only — nothing reads it
 *                                 // yet; it exists so the forms of one verb can be
 *                                 // related later. Null on everything AI-generated.
 *     source: string              // "human" | "ai" | "seed" | "user"
 *                                 // "user" = promoted from somebody's dictionary lookup,
 *                                 // which is the one source no model wrote. Unverified
 *                                 // like the rest, and the field to filter on if the
 *                                 // pool's quality ever slips.
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
 *   2. Filter client-side: if maxLength provided, keep only concepts whose
 *      normalizedKey length is <= maxLength.
 *   3. If preferTopics is non-empty, sort concepts whose `topicIds` intersect it
 *      to the front. This is a preference, not a filter — everything else stays
 *      in the list behind them, so the pool never shrinks and a user can never
 *      be pushed into an AI call they wouldn't otherwise have made.
 *   4. Find the first concept whose ID is not in seenConceptIds.
 *
 *   BRANCH A — Unseen concept found:
 *     a. Fetch translations/{learningDialect} for that concept.
 *     b. Translation exists → check translated word length fits maxLength
 *        → resolve hint → patch if missing → return.
 *     c. Translation missing → AI generates word + hints[userDialect],
 *        check length, write full translation doc, return.
 *
 *   BRANCH B — All concepts seen (pool exhausted for this user):
 *     a. AI generates a brand-new concept + translation with hints[userDialect].
 *        The prompt includes maxLength constraint so AI produces short words.
 *     b. Write wordPool/{newConceptId} + translations/{learningDialect}.
 *     c. Return the fresh word.
 *
 * @module getWordService
 */

/**
 * Theme handed to the AI when the user has picked neither an interest nor a
 * free-text subject. A value, not a sentence — the prompt template decides how
 * to phrase it.
 */
const DEFAULT_THEME = 'generic local noun';

/**
 * How many times to ask for a new concept before accepting one that is longer
 * than requested. Length is no longer constrained in the prompt, so it is
 * checked here instead; a retry costs an AI call, which is the trade the
 * shorter, admin-editable prompt buys.
 */
const MAX_LENGTH_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Types (JSDoc only — no runtime cost)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} InterestTopic
 * @property {string} id    - Interest category ID (an appConfig/config/categories doc ID),
 *                            as stored in the concept's `topicIds`
 * @property {string} label - Human-readable label, used to theme the AI prompt
 */

/**
 * @typedef {Object} GetWordParams
 * @property {string}   token            - Firebase ID token
 * @property {string}   userDialect      - BCP-47 native language, e.g. 'en-US'
 * @property {string}   learningDialect  - BCP-47 target language, e.g. 'pt-PT'
 * @property {string[]} seenConceptIds   - Already-seen concept IDs for this game
 * @property {number}   [maxLength]      - Optional max character length for the translated word
 * @property {InterestTopic[]} [topics]  - Themes a newly generated word. Free — it rides
 *                                         along on a call that was happening anyway — so
 *                                         this is passed for every tier.
 * @property {InterestTopic[]} [preferTopics] - Reorders the cached pool to surface matching
 *                                         words first. Empty for Explorer: see
 *                                         useInterestTopics() for why the tiers differ.
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

import { parseAIJSON } from '../utils/parseAIJSON';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { getSkippedConceptIds } from '../utils/skippedConcepts';

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
/**
 * The pool is read whole and filtered in code, not paged.
 *
 * It was 200, which was also the server's hard cap, and the two together were
 * silently wrong: past 200 concepts every user walked the same arbitrary slice,
 * exhausted it, and generated past it for ever — and the avoid-list handed to
 * the model only ever named that slice, so the generation duplicated words the
 * pool already held. `getWordPoolCount` read the same capped page, so the
 * sidebar's total plateaued at 200 as well.
 *
 * One large request beats paging here: the whole pool is a few hundred small
 * documents, and every filter it needs (length, topic, seen) is applied in
 * code afterwards.
 */
const POOL_LIMIT   = 100_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the next unseen word for the given dialect.
 *
 * When maxLength is provided:
 *   - The full word pool is fetched (up to POOL_LIMIT).
 *   - Concepts are filtered client-side: only those whose normalizedKey
 *     (source English word) has length <= maxLength are considered.
 *   - After fetching a translation, its word length is also checked; if it
 *     exceeds maxLength the concept is skipped.
 *   - If no qualifying unseen concept exists in the pool, the AI is asked
 *     to generate a new word with an explicit length constraint.
 *
 * @param {GetWordParams} params
 * @returns {Promise<WordResult>}
 */
export async function getWord({
  token,
  userDialect,
  learningDialect,
  seenConceptIds,
  maxLength,
  topics = [],
  preferTopics = [],
  filterTopicIds = [],
  customTheme = null,
  themeLabel = null,
}) {
  // Skips ride alongside seen ids rather than being a second filter, because
  // for pool purposes they mean the same thing — do not offer me this one. The
  // difference is where they live and how long they last: a seen id is on the
  // profile and permanent, a skip is in this browser and disposable. Honoured
  // here rather than per game so a word skipped in Hangman is not handed
  // straight back in Scrambled Word. See utils/skippedConcepts.
  const seenSet = new Set([
    ...(seenConceptIds ?? []),
    ...getSkippedConceptIds(learningDialect),
  ]);

  const allConcepts = await _fetchReadyConcepts(token);

  // A free-text theme cannot match a pooled word — nothing in the pool is
  // tagged "medieval castles" — so honouring it means generating. That is a
  // deliberate AI call, gated upstream by the `custom_requests` feature, and
  // the pool is skipped entirely rather than serving an unrelated word.
  if (customTheme) {
    return _generateThemedConcept({
      allConcepts, userDialect, learningDialect, maxLength,
      topic: { id: null, label: customTheme },
      token,
    });
  }

  // Client-side filter: exclude concepts whose source word is too long.
  // This is a fast pre-filter; the translated word length is checked separately
  // after fetching the translation (it may differ from the English source).
  const lengthFiltered = (maxLength != null)
    ? allConcepts.filter((c) => (c.normalizedKey ?? c.sourceWord ?? '').length <= maxLength)
    : allConcepts;

  // A picked interest *filters* rather than reorders: the user asked for that
  // subject, so serving them something else would ignore the request. Falling
  // out of the bottom of a filtered pool lands on generation, themed the same
  // way, so the request is still honoured.
  const topicFiltered = _filterByTopicIds(lengthFiltered, filterTopicIds);

  const concepts = _sortByPreferredTopics(topicFiltered, preferTopics);

  // Walk unseen concepts in order, skipping any whose translation is too long.
  for (const concept of concepts) {
    if (seenSet.has(concept.id)) continue;

    const translation = await _fetchTranslation(concept.id, learningDialect, token);

    if (translation) {
      // Skip if the translated word itself exceeds maxLength
      if (maxLength != null && translation.word.length > maxLength) continue;

      let hint = _resolveHint(translation.hints, userDialect);

      if (!hint) {
        hint = await _generateHintForDialect(concept.sourceWord, userDialect, token);
        _patchHint(concept.id, learningDialect, userDialect, hint, token)
          .catch((err) => console.warn('[getWordService] hint patch failed:', err));
      }

      return {
        word:      translation.word,
        hint:      hint || '',
        conceptId: concept.id,
        source:    'db',
      };
    }

    // No translation yet — generate one via AI
    const generated = await _generateTranslation(
      concept.sourceWord,
      { userDialect, learningDialect },
      token
    );

    // Skip if AI returned a word that's still too long
    if (maxLength != null && generated.word.length > maxLength) continue;

    await _writeTranslation(concept.id, learningDialect, generated, token);

    return {
      word:      generated.word,
      hint:      generated.hints[userDialect] || '',
      conceptId: concept.id,
      source:    'ai',
    };
  }

  // Pool exhausted for this user (all qualifying concepts seen) —
  // ask AI to generate a brand-new concept with the length constraint.
  // One interest is picked rather than all of them: the AI produces a single
  // word, so theming it on one subject lets us tag the new concept with
  // exactly the topic it was built from instead of guessing.
  // A filtered pool ran dry, or the user has no interests at all. Either way
  // the new concept is themed on whatever the user asked for.
  // The caller's resolved theme wins. Only when there is none does this fall
  // back to rolling one of the user's interests, which is what happened before
  // the theme picker existed.
  const chosenTopic = themeLabel
    ? { id: filterTopicIds[0] ?? null, label: themeLabel }
    : (topics.length > 0 ? topics[Math.floor(Math.random() * topics.length)] : null);

  return _generateThemedConcept({
    allConcepts, userDialect, learningDialect, maxLength, topic: chosenTopic, token,
  });
}

/**
 * File a word somebody looked up into the shared pool, unless it is there already.
 *
 * ── Why the dictionary feeds the pool ──────────────────────────────────────
 *
 * Until now the pool only ever grew one way: a game exhausted it and asked a
 * model to invent a word. That is the most expensive way to learn a word
 * exists — and meanwhile every reader tapping a word mid-story was handing the
 * app a real word, chosen by a real learner, and the app threw it away.
 *
 * **This costs no AI call at all.** The only thing the pool needs that a
 * lookup does not already have is the English anchor, and that rides along on
 * the lookup's own response schema. Nothing here can touch anyone's daily
 * allowance, which is why it can run on every tap rather than being gated.
 *
 * ── Inflected forms are kept, not folded into the lemma ────────────────────
 *
 * `englishKey` describes the form that was looked up, so "foram" arrives as
 * "went" and "ir" as "to go" — two concepts, both playable. Folding them onto
 * one lemma would mean the pool keeps whichever was looked up first and a
 * learner could never meet the conjugated form in a game. `baseForm` records
 * the relationship without enforcing it.
 *
 * ── What it does not do ────────────────────────────────────────────────────
 *
 * No definition and no synonyms are stored: this grows the pool, it is not a
 * dictionary cache, and the dictionary still calls the AI on every lookup.
 * Nor does it write a hint — the translation lands with `hints: {}` and the
 * existing on-demand path fills one in the first time a player of that
 * language meets the word, exactly as it already does for any concept missing
 * a hint in the viewer's dialect.
 *
 * **Never throws.** Silence is the right failure here; see `_growWordPool` in
 * dictionaryService for the caller's half of that argument.
 *
 * @param {Object} params
 * @param {string} params.token      - Firebase ID token
 * @param {string} params.word       - The word as looked up, in `locale`
 * @param {string} params.englishKey - English equivalent of that exact form
 * @param {string} [params.baseForm] - Dictionary form in `locale`, if known
 * @param {string} [params.pos]      - Grammatical category, from the lookup's `wordType`
 * @param {string} params.locale     - BCP-47 locale the word is in
 * @returns {Promise<{conceptId: string, created: boolean} | null>} null when
 *          nothing was written — skipped, already present, or failed.
 */
export async function ensureConceptForWord({ token, word, englishKey, baseForm, pos, locale }) {
  const localWord = String(word ?? '').trim();
  const key       = String(englishKey ?? '').trim();

  // A phrase is not playable in any of the games the pool feeds.
  if (!localWord || /\s/.test(localWord)) return null;
  // No anchor, no concept. A lookup that could not name an English equivalent
  // did not identify the word — a typo, a fragment, a proper noun — and a word
  // nobody can place is worse than one the pool does not have.
  if (!key || !locale || !token) return null;

  const entry = {
    sourceWord: key.toLowerCase(),
    // The lookup's `wordType` is already constrained to a fixed enum by its
    // own response schema, so this needs no normalising here.
    pos:        String(pos ?? '').trim() || null,
    word:       localWord.toLowerCase(),
    hints:      {},
    baseForm:   String(baseForm ?? '').trim().toLowerCase() || null,
    source:     'user',
  };

  try {
    // The same guard the generate path uses, for the same reason — and here it
    // is doing more than deduping: a concept that already exists gains this
    // language for free, which is the quiet win. The word somebody looked up
    // *is* the translation, so a concept sitting in the pool with only an
    // English label becomes playable in another language at no cost.
    const existing = await _findConceptByKey(entry.sourceWord, token);

    if (existing) {
      // Already translated here. The pooled wording wins, as it does
      // everywhere else — it is what other players have seen.
      if (await _fetchTranslation(existing.id, locale, token)) return null;

      await _writeTranslation(existing.id, locale, entry, token);
      return { conceptId: existing.id, created: false };
    }

    const conceptId = await _writeNewConcept(entry, locale, token, null);
    return { conceptId, created: true };
  } catch (err) {
    console.warn('[getWordService] pool promotion failed:', err);
    return null;
  }
}

/**
 * Keep only concepts carrying one of `topicIds`.
 *
 * Unlike _sortByPreferredTopics this really does shrink the pool, because a
 * user who picked an interest asked for that subject specifically. Concepts
 * written before interests existed have no `topicIds` and drop out — which is
 * correct here: an untagged word is not known to be on-theme.
 *
 * @param {Array<object>} concepts
 * @param {string[]} topicIds
 * @returns {Array<object>}
 */
function _filterByTopicIds(concepts, topicIds) {
  if (!topicIds?.length) return concepts;
  const wanted = new Set(topicIds);
  return concepts.filter((concept) =>
    (Array.isArray(concept.topicIds) ? concept.topicIds : []).some((id) => wanted.has(id)),
  );
}

/**
 * Generate, store and return a brand-new concept on a given theme.
 *
 * Shared by the two paths that reach the AI: a free-text theme (which skips
 * the pool by design) and an exhausted pool.
 */
async function _generateThemedConcept({
  allConcepts, userDialect, learningDialect, maxLength, topic, token,
}) {
  const knownWords = allConcepts.map((c) => c.normalizedKey);

  // The prompt no longer carries a length rule, so enforce it here: ask again
  // if the word came back too long, and keep the shortest attempt as the
  // fallback rather than failing the round outright.
  let generated = null;
  for (let attempt = 0; attempt < MAX_LENGTH_ATTEMPTS; attempt += 1) {
    const candidate = await _generateNewConcept(
      { userDialect, learningDialect, knownWords, topic },
      token,
    );
    if (maxLength == null || candidate.word.length <= maxLength) {
      generated = candidate;
      break;
    }
    if (!generated || candidate.word.length < generated.word.length) generated = candidate;
  }

  // Only a real interest id tags the new concept; a free-text theme has none
  // to tag it with, so it enters the pool untagged.
  const tagTopic = topic?.id ? topic : null;

  return _adoptOrCreateConcept({
    generated, userDialect, learningDialect, token, topic: tagTopic,
  });
}

/**
 * Write the generated concept — unless the pool already has it.
 *
 * **This is what keeps the pool unique, and it has to be code.** The prompt
 * does carry an avoid list and the model is genuinely told not to repeat; it
 * repeats anyway. One build of nine words produced seven `passport` documents
 * in thirteen seconds, each with its own reworded hint, every one of them
 * generated while "passport" was sitting in the avoid list it had just been
 * handed. A hard instruction ("must be about travel") and a soft one (a long
 * negative list) is not a fair fight, and uniqueness is not something to ask
 * a language model for politely.
 *
 * So the last word before the write belongs to a lookup. One indexed equality
 * on `normalizedKey`, on the generate path only — the pool path never reaches
 * here.
 *
 * Reuse is preferred over regenerating: another AI call to dodge a collision
 * costs the user a call from their daily allowance to produce a word they
 * could have been given for free.
 */
async function _adoptOrCreateConcept({ generated, userDialect, learningDialect, token, topic }) {
  const existing = await _findConceptByKey(generated.sourceWord, token);

  if (existing) {
    const translation = await _fetchTranslation(existing.id, learningDialect, token);

    if (translation) {
      // The pooled wording wins over the freshly generated one: it is what
      // other players have already seen for this concept.
      return {
        word:      translation.word,
        hint:      _resolveHint(translation.hints, userDialect) || generated.hints[userDialect] || '',
        conceptId: existing.id,
        source:    'db',
      };
    }

    // The concept exists in English but not yet in this language, which is
    // exactly what was just generated. It lands on the existing concept
    // instead of a second copy of it.
    await _writeTranslation(existing.id, learningDialect, generated, token);
    return {
      word:      generated.word,
      hint:      generated.hints[userDialect] || '',
      conceptId: existing.id,
      source:    'ai',
    };
  }

  const conceptId = await _writeNewConcept(generated, learningDialect, token, topic);
  return {
    word:      generated.word,
    hint:      generated.hints[userDialect] || '',
    conceptId,
    source:    'ai',
  };
}

/**
 * The concept already holding this English word, or null.
 *
 * Matched on `normalizedKey` with the same transform `_writeNewConcept` uses
 * to build it, so the two cannot disagree about what counts as the same word.
 *
 * **Never throws.** A failed lookup degrades to the old behaviour — a possible
 * duplicate — which is a far better outcome than costing somebody the word
 * they were waiting for.
 */
async function _findConceptByKey(sourceWord, token) {
  const key = String(sourceWord ?? '').toLowerCase().trim();
  if (!key) return null;

  try {
    const params = new URLSearchParams({
      collection: 'wordPool',
      filters: JSON.stringify([{ field: 'normalizedKey', op: '==', value: key }]),
      limit: '1',
    });
    const response = await fetch(`${PROXY_URL}/api/firestore?${params}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json?.data?.documents?.[0] ?? null;
  } catch (err) {
    console.warn('[getWordService] duplicate check failed, writing anyway:', err);
    return null;
  }
}

/**
 * Move concepts matching the user's interests to the front of the pool.
 *
 * A *preference*, not a filter: unmatched concepts keep their relative order
 * behind the matched ones, so the walk still has the whole pool available.
 * Filtering instead would shrink the pool, exhaust it sooner, and push users
 * into extra AI calls — the opposite of what a cache is for.
 *
 * A concept may carry several `topicIds`; matching any one of the user's
 * interests is enough. Concepts written before interests existed have no
 * `topicIds` at all and simply never match.
 *
 * @param {Array<object>} concepts
 * @param {InterestTopic[]} preferTopics
 * @returns {Array<object>} A new array; the input is not mutated.
 */
function _sortByPreferredTopics(concepts, preferTopics) {
  if (!preferTopics?.length) return concepts;

  const wanted = new Set(preferTopics.map((t) => t.id));
  const matched = [];
  const rest    = [];

  for (const concept of concepts) {
    const topicIds = Array.isArray(concept.topicIds) ? concept.topicIds : [];
    (topicIds.some((id) => wanted.has(id)) ? matched : rest).push(concept);
  }

  return [...matched, ...rest];
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
        baseForm:      data.baseForm ?? null,
        // Defaults to 'ai' because that is what every caller but
        // `ensureConceptForWord` is: a model wrote this word.
        source:        data.source ?? 'ai',
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

async function _writeNewConcept(generated, learningDialect, token, topic = null) {
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
        // Null on the generate path, which has never asked a model for it. A
        // dictionary lookup does know, because its own schema returns a
        // `wordType` for every entry.
        pos:           generated.pos ?? null,
        normalizedKey: generated.sourceWord.toLowerCase().trim(),
        // Interest categories this word belongs to, so _sortByPreferredTopics
        // can surface it to users who share them. An array because a word can
        // belong to several; generation themes on one, but these are curated
        // by hand afterwards.
        topicIds:      topic ? [topic.id] : [],
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

/**
 * Generate a translation for an existing English concept.
 *
 * Length is no longer asked for in the prompt. The caller checks the result and
 * moves on to another concept if it is too long — one wasted call now and then
 * is cheaper than a template carrying a sentence only the code can edit.
 */
async function _generateTranslation(sourceWord, { userDialect, learningDialect }, token) {

  const promptDoc = await getPrompt('get-word-translate-concept-prompt');
  const prompt = renderTemplate(promptDoc.template, { sourceWord, learningDialect, userDialect });

  const providerParams = {
    provider:    'gemini',
    model:       promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
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
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);

  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.word || !parsed?.hint)
    throw new Error('[getWordService] AI response missing word or hint');

  const word = parsed.word.trim().toLowerCase();
  return {
    word,
    hints: { [userDialect]: parsed.hint.trim() },
  };
}

async function _generateHintForDialect(sourceWord, userDialect, token) {
  const promptDoc = await getPrompt('get-word-generate-hint-prompt');
  const prompt = renderTemplate(promptDoc.template, { userDialect, sourceWord });

  const providerParams = {
    provider:    'gemini',
    model:       promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    temperature: 0.7,
    jsonMode:    true,
    responseSchema: {
      type:       'object',
      properties: { hint: { type: 'string' } },
      required:   ['hint'],
    },
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);

  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.hint) throw new Error('[getWordService] AI response missing hint');
  return parsed.hint.trim();
}

/**
 * Generate a completely new concept + translation.
 * When maxLength is provided, both the English source word and translated word
 * are constrained to that length in the prompt.
 */
async function _generateNewConcept({ userDialect, learningDialect, knownWords, topic }, token) {
  // Values, not sentences. Every one of these is always defined so the
  // template can phrase them however an admin likes without the app needing a
  // rebuild — and without a placeholder ever resolving to an empty string.
  const avoidList = knownWords.length > 0 ? knownWords.join(', ') : 'none';

  const interestOrTopic = topic?.label || DEFAULT_THEME;

  const promptDoc = await getPrompt('get-word-generate-new-concept-prompt');
  const prompt = renderTemplate(promptDoc.template, { learningDialect, userDialect, avoidList, interestOrTopic });

  const providerParams = {
    provider:    'gemini',
    model:       promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
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
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);

  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.sourceWord || !parsed?.word || !parsed?.hint)
    throw new Error('[getWordService] AI response missing required fields');

  const word = parsed.word.trim().toLowerCase();
  return {
    sourceWord: parsed.sourceWord.trim().toLowerCase(),
    word,
    hints: { [userDialect]: parsed.hint.trim() },
  };
}

