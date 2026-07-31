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
import { getPrompt, renderTemplate } from './promptService';

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

  const promptDoc = await getPrompt('translate-text-prompt');
  const prompt = renderTemplate(promptDoc.template, { sourceLang, targetLang, text: text.trim() });

  const providerParams = {
    provider:    'gemini',
    model:       promptDoc.model || GEMINI_MODEL,
    temperature: 0.2,
    jsonMode:    false,
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);

  const translation = data?.text ?? '';

  if (!translation) throw new Error('[translatorService] Empty translation returned');

  return { translation: translation.trim() };
}
