/**
 * translatorService.js
 *
 * Translates text between two BCP-47 locales using the /api/ask-ai proxy
 * backed by Gemini 3.5 Flash.
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

import { askAI } from './aiService';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

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

  const data = await askAI(token, prompt, {
    provider:    'gemini',
    model:       GEMINI_MODEL,
    temperature: 0.2,
    jsonMode:    false,
  });

  const translation = data?.text ?? '';

  if (!translation) throw new Error('[translatorService] Empty translation returned');

  return { translation: translation.trim() };
}
