/**
 * dictionaryService.js
 *
 * Looks up the definition and synonyms of a word or expression using
 * the /api/ask-ai proxy backed by Gemini 2.5 Flash (JSON mode).
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

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-2.5-flash';

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

  const prompt = [
    `You are a multilingual dictionary assistant.`,
    `Look up the following word or expression: "${word.trim()}"`,
    ``,
    `Return a JSON object with exactly two fields:`,
    ``,
    `- "definition": a short, clear, plain-language definition (1–2 sentences max).`,
    `  Write the definition in this language (BCP-47): ${interfaceLang}.`,
    ``,
    `- "synonyms": an array of synonyms or closely related words/expressions.`,
    `  Synonyms MUST be written in this language (BCP-47): ${learningLang}.`,
    `  Do NOT translate synonyms into ${interfaceLang}.`,
    `  Include as many as are genuinely relevant — do not invent synonyms if few exist.`,
    `  Do NOT include the original word itself in the synonyms array.`,
    ``,
    `Do NOT add any explanation, notes, or extra fields outside the JSON.`,
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
        temperature:    0.2,
        jsonMode:       true,
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[dictionaryService] Request failed (${response.status})`
    );
  }

  // API envelope: { success: true, data: { text: string, ... } }
  const raw = json?.data?.text ?? json?.text ?? '';

  if (!raw) throw new Error('[dictionaryService] Empty response returned');

  let parsed;
  try {
    parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
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
