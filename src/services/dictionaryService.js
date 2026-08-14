/**
 * dictionaryService.js
 *
 * Looks up the definition and synonyms of a word or expression using
 * the /api/ask-ai proxy backed by Gemini 3.5 Flash (JSON mode).
 *
 * - The definition is returned in the user's interface language (interfaceLang).
 * - The synonyms are returned in the learning language (learningLang).
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
 * @property {string[]} [wordTypes]  - Grammatical categories to define the word as.
 *                                     Empty = every available category; the model
 *                                     returns one entry per category. See WORD_TYPES.
 */

/**
 * @typedef {Object} LookupEntry
 * @property {string}   wordType   - One of WORD_TYPES
 * @property {string}   definition - Short, plain-language definition in interfaceLang
 * @property {string[]} synonyms   - Synonyms in learningLang
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
export const MAX_WORD_TYPES = 5;

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
function buildResponseSchema(types) {
  return {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        minItems: types.length,
        maxItems: types.length + 1,
        items: {
          type: 'object',
          properties: {
            wordType: {
              type: 'string',
              enum: WORD_TYPES,
              description: 'The grammatical category this definition describes.',
            },
            definition: { type: 'string' },
            synonyms: { type: 'array', items: { type: 'string' } },
          },
          required: ['wordType', 'definition', 'synonyms'],
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
export async function lookupWord({ token, word, interfaceLang, learningLang, wordTypes = [] }) {
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
    interfaceLang,
    learningLang,
  });

  const providerParams = {
    provider:       'gemini',
    model:          promptDoc.model || GEMINI_MODEL,
    temperature:    0.2,
    jsonMode:       true,
    responseSchema: buildResponseSchema(types),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);

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
      definition: String(e?.definition ?? '').trim(),
      synonyms: Array.isArray(e?.synonyms)
        ? e.synonyms.map((s) => String(s).trim()).filter(Boolean)
        : [],
    }))
    .filter((e) => e.definition)
    // The most-common-sense entry can land on a category that was also listed
    // explicitly, so the same wordType can come back twice. Keep the first and
    // drop the repeat rather than rendering the word twice as a noun.
    .filter((e) => !seenTypes.has(e.wordType) && seenTypes.add(e.wordType));

  if (entries.length === 0) throw new Error('[dictionaryService] No definition returned');

  return { entries };
}
