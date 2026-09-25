/**
 * grammarTextService.js
 *
 * Backs Practice Text: a short passage written around whatever the learner
 * says they want to practise — a tense, a construction, a handful of words.
 *
 * **Nothing here is cached, and that is the design, not a shortcut.** Every
 * other reading feature in the app is cache-first against a shared pool
 * (storyService, historyCultureService, grammarService) because their requests
 * are drawn from a bounded set: a level, a language, a theme, a topic id. This
 * one's request is a sentence somebody typed, so there is no key to match on
 * and no second reader who would want the same text. It generates every time,
 * and the AI daily limit is what rations it — the same argument photo capture
 * runs on.
 *
 * **It writes nothing either.** No pool document, no seen-ids list. A text
 * built for one learner's question is not worth another's, and the reader
 * already has somewhere to keep what they want to keep: the word bank for the
 * words, the note board for the rest.
 *
 * Not to be confused with `grammarService`, which serves the hand-written
 * pt-PT topic library and its drills. This one reads nothing seeded, which is
 * why it is the only section of the grammar hub available in every language
 * (see config/grammarSupport.js).
 */

import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { parseAIJSON } from '../utils/parseAIJSON';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Shorter than a tale at every level. This is read closely and re-read, not
 * read through — length is what stops someone doing that.
 */
const PARAGRAPH_COUNT_BY_LEVEL = { A1: 2, A2: 2, B1: 3, B2: 3, C1: 4, C2: 4 };
const DEFAULT_PARAGRAPH_COUNT = 3;

/** Enough to be worth reading back, few enough to stay a list and not a wall. */
const MAX_HIGHLIGHTS = 8;

function _textSchema(paragraphCount) {
  return {
    type: 'object',
    properties: {
      title: { type: 'string' },
      paragraphs: {
        type: 'array',
        items: { type: 'string' },
        minItems: paragraphCount,
        maxItems: paragraphCount,
      },
      // The difference between this and a tale with a label on it: the reader
      // is told what to look for before reading, and shown where it was after.
      focusNote: { type: 'string' },
      highlights: {
        type: 'array',
        items: { type: 'string' },
        maxItems: MAX_HIGHLIGHTS,
      },
    },
    required: ['title', 'paragraphs', 'focusNote', 'highlights'],
  };
}

/**
 * Write a passage built around `focus`.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.targetLang     - language the passage is written in
 * @param {string} params.explanationLang - language the focus note is written in
 * @param {string} params.level          - CEFR level
 * @param {string} params.focus          - what the learner wants to practise, in their words
 * @param {string[]} [params.requiredWords] - words from the reader's bank to work in
 * @returns {Promise<{title: string, paragraphs: string[], focusNote: string, highlights: string[], level: string, targetLang: string}>}
 */
export async function generatePracticeText({
  token, targetLang, explanationLang, level, focus, requiredWords = [],
}) {
  if (!token) throw new Error('[grammarTextService] token is required');
  if (!targetLang) throw new Error('[grammarTextService] targetLang is required');
  if (!level) throw new Error('[grammarTextService] level is required');
  if (!focus?.trim()) throw new Error('[grammarTextService] focus is required');

  const paragraphCount = PARAGRAPH_COUNT_BY_LEVEL[level] ?? DEFAULT_PARAGRAPH_COUNT;
  const promptDoc = await getPrompt('grammar-text-generate-prompt');

  // The same guard {{requiredWords}} and {{speechPace}} carry elsewhere, and
  // the one that matters most here: {{focus}} *is* the request. A template
  // edited to drop it produces a perfectly good passage about nothing the
  // reader asked for, which looks like the model ignoring them.
  for (const placeholder of ['focus', 'requiredWords']) {
    if (placeholder === 'requiredWords' && requiredWords.length === 0) continue;
    if (String(promptDoc.template).includes(`{{${placeholder}}}`)) continue;
    console.warn(
      `[grammarTextService] The "grammar-text-generate-prompt" template has no {{${placeholder}}} ` +
      'placeholder, so that part of the request will not reach the model. Add it in Admin > Prompts.',
    );
  }

  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    explanationLang,
    level,
    focus: focus.trim(),
    paragraphCount,
    // A plain list, not a sentence — the instruction around it belongs in the
    // editable template.
    requiredWords: requiredWords.join(', ') || '(none)',
    maxHighlights: MAX_HIGHLIGHTS,
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    temperature: 0.7,
    jsonMode: true,
    responseSchema: _textSchema(paragraphCount),
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.title || !Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length === 0) {
    throw new Error('[grammarTextService] AI returned an incomplete text');
  }

  return {
    title: String(parsed.title).trim(),
    paragraphs: parsed.paragraphs.map(String),
    // Both are presentational extras rather than the point of the call, so a
    // model that skipped them degrades to a plain passage instead of throwing
    // away one of the reader's daily AI calls.
    focusNote: parsed.focusNote ? String(parsed.focusNote).trim() : '',
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.map(String).slice(0, MAX_HIGHLIGHTS)
      : [],
    level,
    targetLang,
  };
}
