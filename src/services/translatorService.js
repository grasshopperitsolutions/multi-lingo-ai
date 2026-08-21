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
import { decodeHtmlEntities } from '../utils/decodeHtmlEntities';

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

  // Exempt from the generation prompt: translating is a quick reflex action
  // mid-reading, and a modal before every lookup makes the tool unusable.
  const data = await askAI(token, prompt, providerParams, { skipConfirm: true });

  // Plain-text response, so it never passes through parseAIJSON — decode here
  // instead. Models emit "t&acirc;che" for "tâche" often enough that untreated
  // output reaches the screen as visible entity text.
  const translation = decodeHtmlEntities(data?.text ?? '');

  if (!translation) throw new Error('[translatorService] Empty translation returned');

  return { translation: translation.trim() };
}
