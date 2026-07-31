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
 * @property {string} token         - Firebase ID token
 * @property {string} word          - Word or expression to look up
 * @property {string} interfaceLang - BCP-47 locale for the definition, e.g. 'en-US'
 * @property {string} learningLang  - BCP-47 locale for the synonyms, e.g. 'pt-PT'
 */

/**
 * @typedef {Object} LookupResult
 * @property {string}   definition - Short, plain-language definition in interfaceLang
 * @property {string[]} synonyms   - Array of synonyms in learningLang
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

import { parseAIJSON } from '../utils/parseAIJSON';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    definition: { type: 'string' },
    synonyms:   { type: 'array', items: { type: 'string' } },
  },
  required: ['definition', 'synonyms'],
};

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
export async function lookupWord({ token, word, interfaceLang, learningLang }) {
  if (!word?.trim())      throw new Error('[dictionaryService] word is required');
  if (!token)             throw new Error('[dictionaryService] token is required');
  if (!interfaceLang)     throw new Error('[dictionaryService] interfaceLang is required');
  if (!learningLang)      throw new Error('[dictionaryService] learningLang is required');

  const promptDoc = await getPrompt('dictionary-lookup-prompt');
  const prompt = renderTemplate(promptDoc.template, { word: word.trim(), interfaceLang, learningLang });

  const data = await askAI(token, prompt, {
    provider:       'gemini',
    model:          GEMINI_MODEL,
    temperature:    0.2,
    jsonMode:       true,
    responseSchema: RESPONSE_SCHEMA,
  });

  const raw = data?.text ?? '';

  if (!raw) throw new Error('[dictionaryService] Empty response returned');

  let parsed;
  try {
    parsed = parseAIJSON(raw);
  } catch {
    throw new Error('[dictionaryService] Could not parse AI response as JSON');
  }

  const definition = (parsed?.definition ?? '').trim();
  const synonyms   = Array.isArray(parsed?.synonyms)
    ? parsed.synonyms.map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (!definition) throw new Error('[dictionaryService] No definition returned');

  return { definition, synonyms };
}
