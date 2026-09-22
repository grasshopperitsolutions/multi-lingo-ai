/**
 * dictionaryService.js
 *
 * Looks up the definition and synonyms of a word or expression using
 * the /api/ask-ai proxy backed by Gemini 3.5 Flash (JSON mode).
 *
 * - The definition is returned in the user's interface language (interfaceLang).
 * - The synonyms are returned in the learning language (learningLang).
 *
 * **It also has a side effect: single words grow the shared word pool.** The
 * definition and the synonyms are not stored anywhere — every lookup is still
 * a fresh AI call — but a one-word lookup is handed to
 * `getWordService.ensureConceptForWord`, which files it in `wordPool` for the
 * word games. That costs no AI call: the anchor it needs (`englishKey`) rides
 * along on the response schema of the call already being made.
 *
 * Usage:
 *   import { lookupWord } from '../services/dictionaryService';
 *
 *   const { definition, synonyms } = await lookupWord({
 *     token:         user.token,
 *     word:          'efémero',
 *     interfaceLang: 'en-US',
 *     learningLang:  'pt-PT',
 *   });
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} LookupParams
 * @property {string} token          - Firebase ID token
 * @property {string} word           - Word or expression to look up
 * @property {string} interfaceLang  - BCP-47 locale for the definition, e.g. 'en-US'
 * @property {string} learningLang   - BCP-47 locale for the synonyms, e.g. 'pt-PT'
 * @property {number} [commonSenses] - When no wordTypes are given, how many of the
 *                                     word's most common senses to return (default 1,
 *                                     capped at MAX_ENTRIES).
 * @property {string[]} [wordTypes]  - Grammatical categories to define the word as.
 *                                     Empty = every available category; the model
 *                                     returns one entry per category. See WORD_TYPES.
 */

/**
 * @typedef {Object} LookupEntry
 * @property {string}   wordType    - One of WORD_TYPES
 * @property {string}   translation - The word itself in interfaceLang, one or two
 *                                    words, no explanation. May be empty when the
 *                                    stored prompt predates this field.
 * @property {string}   definition  - Short, plain-language definition in interfaceLang
 * @property {string[]} synonyms    - Synonyms in learningLang
 * @property {string}   englishKey  - English equivalent of this exact form, the
 *                                    anchor a word pool concept is filed under.
 *                                    Empty when the stored prompt predates it.
 * @property {string}   baseForm    - Dictionary form in learningLang ('ir' for
 *                                    'foram'). Metadata only; nothing depends on it.
 */

/**
 * @typedef {Object} LookupResult
 * @property {LookupEntry[]} entries - One per resolved grammatical category, or
 *                                     one per available category when none were
 *                                     selected.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

import { parseAIJSON } from '../utils/parseAIJSON';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { ensureConceptForWord } from './getWordService';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Grammatical categories a lookup can be narrowed to. Surfaced in the UI as
 * toggle pills and sent to Gemini as a schema `enum`, so the model can only
 * ever answer with one of these — no free-text part-of-speech labels to
 * normalise afterwards.
 */
export const WORD_TYPES = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'expression',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'other',
];

/**
 * Ceiling on how many categories a user may tick.
 *
 * No real word functions as all ten, so the upper range is only ever reached
 * by accident — and each extra category is another definition the model has to
 * write. Exported so the UI enforces the same number the service does rather
 * than the two drifting apart.
 */
export const MAX_WORD_TYPES = 3;

/**
 * Hard ceiling on definitions returned by a single lookup.
 *
 * A wall of six senses is not a dictionary entry anyone reads — the useful
 * ones are the first few. Enforced in the schema (so the model never writes
 * more than we intend to show) and again on the parsed result, since a
 * response can still arrive with extras.
 */
export const MAX_ENTRIES = 3;

/**
 * Build the response schema for a lookup.
 *
 * `types` is what the prompt explicitly lists — exactly the user's ticked
 * pills, possibly none. On top of those the prompt asks for one entry for the
 * word's most common category, which is why the enum stays open to every
 * category (that entry could be any of them) and the upper bound is one more
 * than the listed count.
 *
 * The lower bound is `types.length`, so every explicitly listed category comes
 * back even when it doesn't apply — that's what lets the UI show "not used as
 * a verb" for a pill the user deliberately ticked. With nothing ticked the
 * bounds are 0-1, i.e. just the most common sense.
 *
 * @param {string[]} types - grammatical categories named in the prompt
 */
function buildResponseSchema(types, commonSenses) {
  // With nothing ticked the bounds come from `commonSenses`: the caller says
  // how many of the word's most common senses it wants, and the schema forces
  // exactly that many. This is what lets a tap-to-look-up ask for two — the
  // "bebe = baby / bebe = drinks" case, where one sense is actively
  // misleading. With categories ticked the listed ones set the floor and the
  // most-common extra sets the ceiling, both capped at MAX_ENTRIES.
  const minItems = types.length > 0 ? types.length : commonSenses;
  const maxItems = Math.min(Math.max(types.length + 1, minItems), MAX_ENTRIES);

  return {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        minItems: Math.min(minItems, maxItems),
        maxItems,
        items: {
          type: 'object',
          properties: {
            wordType: {
              type: 'string',
              enum: WORD_TYPES,
              description: 'The grammatical category this definition describes.',
            },
            // The one- or two-word equivalent, before the explanation. A
            // reader who tapped a word mid-story usually wants "what does
            // this mean" answered in a glance; the definition is what they
            // read next, if they still need it.
            translation: { type: 'string' },
            definition: { type: 'string' },
            synonyms: { type: 'array', items: { type: 'string' } },
            // The two fields the word pool needs, and the only reason they are
            // asked for: the pool is keyed on English concepts, so a word
            // looked up in the practice language has to be filed under one.
            //
            // `englishKey` describes **this form**, not the dictionary form,
            // and that distinction is the whole design. Keyed on the lemma,
            // "foram" and "ir" would collide on one concept and the pool would
            // keep whichever arrived first — so a learner could never meet the
            // conjugated form in a game. Keyed on the form, they are two
            // concepts ("went" and "to go") and both are playable.
            englishKey: {
              type: 'string',
              description:
                'The English equivalent of this exact form of the word, not of its '
                + 'dictionary form: an inflected form keeps its inflection, so Portuguese '
                + '"foram" is "went" rather than "go". One or two words, no article, no '
                + 'explanation. Empty if the word cannot be identified.',
            },
            baseForm: {
              type: 'string',
              description:
                'The dictionary form of the word in its own language — the infinitive '
                + 'for a verb, the masculine singular for an adjective. The word itself '
                + 'when it is already in its dictionary form.',
            },
          },
          required: ['wordType', 'translation', 'definition', 'synonyms', 'englishKey', 'baseForm'],
        },
      },
    },
    required: ['entries'],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up `word` and return:
 *   - its definition written in `interfaceLang`
 *   - its synonyms written in `learningLang`
 *
 * @param {LookupParams} params
 * @returns {Promise<LookupResult>}
 */
export async function lookupWord({ token, word, interfaceLang, learningLang, wordTypes = [], commonSenses = 1 }) {
  if (!word?.trim())      throw new Error('[dictionaryService] word is required');
  if (!token)             throw new Error('[dictionaryService] token is required');
  if (!interfaceLang)     throw new Error('[dictionaryService] interfaceLang is required');
  if (!learningLang)      throw new Error('[dictionaryService] learningLang is required');

  // Exactly what the user ticked, nothing added. Only known types survive — a
  // stale pill from an older build would otherwise reach the schema. Truncated
  // here as well as in the UI, since the cap protects the response size and
  // can't depend on a caller having enforced it.
  //
  // An empty list is a valid state: the prompt then falls through to asking
  // only for the word's most common sense. The template owns all the wording,
  // including how it phrases an empty list — only the raw list is injected.
  const types = wordTypes
    .filter((tp) => WORD_TYPES.includes(tp))
    .slice(0, MAX_WORD_TYPES);

  const promptDoc = await getPrompt('dictionary-lookup-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    word: word.trim(),
    // The template injects this as plain text in a grammatical-category list
    // ("noun, verb, ..."), so it's joined into a human-readable string here.
    wordTypes: types.join(', '),
    // Only meaningful when no categories were ticked. The stored template does
    // not have to reference it — the response schema already forces the count —
    // but exposing it lets the prompt be reworded to ask for N senses without
    // another code change.
    commonSenses,
    interfaceLang,
    learningLang,
  });

  const providerParams = {
    provider:       'gemini',
    model:          promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    temperature:    0.2,
    jsonMode:       true,
    responseSchema: buildResponseSchema(types, commonSenses),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  // Exempt from the generation prompt, same reasoning as the translator: this
  // also backs WordLookupSheet, so a prompt here would fire every time a
  // student taps a word mid-exercise.
  const data = await askAI(token, prompt, providerParams, { skipConfirm: true });

  const raw = data?.text ?? '';

  if (!raw) throw new Error('[dictionaryService] Empty response returned');

  let parsed;
  try {
    parsed = parseAIJSON(raw);
  } catch {
    throw new Error('[dictionaryService] Could not parse AI response as JSON');
  }

  const seenTypes = new Set();
  const entries = (Array.isArray(parsed?.entries) ? parsed.entries : [])
    .map((e) => ({
      wordType: WORD_TYPES.includes(e?.wordType) ? e.wordType : 'other',
      // Optional on the way in: the prompt template is admin-edited, so a
      // template that predates this field still returns usable entries —
      // they just render without the gloss line.
      translation: String(e?.translation ?? '').trim(),
      definition: String(e?.definition ?? '').trim(),
      synonyms: Array.isArray(e?.synonyms)
        ? e.synonyms.map((s) => String(s).trim()).filter(Boolean)
        : [],
      // Optional on the way in for the same reason `translation` is: the
      // template is admin-edited and the schema is what actually enforces
      // these, so a response that predates them still renders. An entry
      // without an englishKey simply never reaches the pool.
      englishKey: String(e?.englishKey ?? '').trim(),
      baseForm: String(e?.baseForm ?? '').trim(),
    }))
    .filter((e) => e.definition)
    // The most-common-sense entry can land on a category that was also listed
    // explicitly, so the same wordType can come back twice. Keep the first and
    // drop the repeat rather than rendering the word twice as a noun.
    .filter((e) => !seenTypes.has(e.wordType) && seenTypes.add(e.wordType))
    .slice(0, MAX_ENTRIES);

  if (entries.length === 0) throw new Error('[dictionaryService] No definition returned');

  _growWordPool({ token, word, learningLang, entry: entries[0] });

  return { entries };
}

// ---------------------------------------------------------------------------
// Word pool
// ---------------------------------------------------------------------------

/**
 * Hand a looked-up word to the shared pool, in the background.
 *
 * **Deliberately not awaited and deliberately unable to fail the lookup.** A
 * reader tapped a word to find out what it means; they did not ask to
 * contribute to a word game, and a Firestore write going wrong must not cost
 * them the answer they were waiting for.
 *
 * Only the first entry is offered. Further entries are other senses of the
 * same word — the pool holds one word per concept, so the most common sense is
 * the one worth filing, and the rest would only ever collide with it.
 *
 * Only single words are offered. The pool exists for the word games, and a
 * phrase is not playable in a crossword, hangman or a word search.
 *
 * @param {{token: string, word: string, learningLang: string, entry: LookupEntry}} params
 */
function _growWordPool({ token, word, learningLang, entry }) {
  const bare = word.trim();
  if (!bare || /\s/.test(bare)) return;

  ensureConceptForWord({
    token,
    word: bare,
    locale: learningLang,
    englishKey: entry.englishKey,
    baseForm: entry.baseForm,
    pos: entry.wordType,
  }).catch(() => { /* never the reader's problem */ });
}
