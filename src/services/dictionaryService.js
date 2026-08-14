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
 *                                     Empty = let the model pick the single most
 *                                     common sense. See WORD_TYPES.
 */

/**
 * @typedef {Object} LookupEntry
 * @property {string}   wordType   - One of WORD_TYPES
 * @property {string}   definition - Short, plain-language definition in interfaceLang
 * @property {string[]} synonyms   - Synonyms in learningLang
 */

/**
 * @typedef {Object} LookupResult
 * @property {LookupEntry[]} entries - One per requested word type, or a single
 *                                     entry when no types were requested.
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
 * Build the response schema for a lookup.
 *
 * When the user has toggled specific types, the enum is narrowed to exactly
 * those and the array length is pinned to their count — so the model cannot
 * return a category that wasn't asked for, nor skip one that was. With no
 * selection the enum opens to every type and exactly one entry comes back,
 * letting the model pick the word's most common sense.
 *
 * @param {string[]} types - selected word types; empty means "you choose, just one"
 */
function buildResponseSchema(types) {
  const count = types.length > 0 ? types.length : 1;
  return {
    type: 'object',
    properties: {
      entries: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          properties: {
            wordType: {
              type: 'string',
              enum: types.length > 0 ? types : WORD_TYPES,
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

  // Ignore anything not in the known set — a stale pill from an older build
  // would otherwise end up in the schema enum and break the call.
  const types = wordTypes.filter((tp) => WORD_TYPES.includes(tp));

  // Rendered like lengthConstraintLine elsewhere: a whole sentence, or nothing
  // at all, so the template reads correctly either way.
  const wordTypeLine = types.length > 0
    ? `Return one entry for each of these grammatical categories, in this order: ${types.join(', ')}. If the word does not genuinely function as one of them, still return that entry and say so plainly in its definition rather than inventing a meaning.`
    : 'Return exactly one entry, for the word\'s most common grammatical category.';

  const promptDoc = await getPrompt('dictionary-lookup-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    word: word.trim(),
    interfaceLang,
    learningLang,
    wordTypeLine,
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

  const entries = (Array.isArray(parsed?.entries) ? parsed.entries : [])
    .map((e) => ({
      wordType: WORD_TYPES.includes(e?.wordType) ? e.wordType : 'other',
      definition: String(e?.definition ?? '').trim(),
      synonyms: Array.isArray(e?.synonyms)
        ? e.synonyms.map((s) => String(s).trim()).filter(Boolean)
        : [],
    }))
    .filter((e) => e.definition);

  if (entries.length === 0) throw new Error('[dictionaryService] No definition returned');

  return { entries };
}
