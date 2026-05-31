/**
 * translatorService.js
 *
 * Translates text between two BCP-47 locales using the /api/ask-ai proxy
 * backed by Gemini 2.5 Flash.
 *
 * Usage:
 *   import { translateText } from '../services/translatorService';
 *
 *   const { translation } = await translateText({
 *     token:      user.token,
 *     text:       'Hello, how are you?',
 *     sourceLang: 'en-US',
 *     targetLang: 'pt-PT',
 *   });
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} TranslateParams
 * @property {string} token      - Firebase ID token
 * @property {string} text       - Text to translate
 * @property {string} sourceLang - BCP-47 source locale, e.g. 'en-US'
 * @property {string} targetLang - BCP-47 target locale, e.g. 'pt-PT'
 */

/**
 * @typedef {Object} TranslateResult
 * @property {string} translation - Translated text
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-3.5-flash';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate `text` from `sourceLang` to `targetLang`.
 *
 * @param {TranslateParams} params
 * @returns {Promise<TranslateResult>}
 */
export async function translateText({ token, text, sourceLang, targetLang }) {
  if (!text?.trim()) throw new Error('[translatorService] text is required');
  if (!token)        throw new Error('[translatorService] token is required');

  const prompt = [
    `You are a professional translator.`,
    `Translate the following text from ${sourceLang} to ${targetLang}.`,
    `Return ONLY the translated text. No explanations, no notes, no punctuation changes unless necessary.`,
    ``,
    `Text to translate:`,
    text.trim(),
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
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.2,
        jsonMode:    false,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error ?? json?.message ?? `[translatorService] Request failed (${response.status})`);
  }

  // API envelope: { success: true, data: { text: string, ... } }
  const translation = json?.data?.text ?? json?.text ?? '';

  if (!translation) throw new Error('[translatorService] Empty translation returned');

  return { translation: translation.trim() };
}
