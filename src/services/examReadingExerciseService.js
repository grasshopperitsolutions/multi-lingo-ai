/**
 * examReadingExerciseService.js
 *
 * Specialized service for reading exercises.
 * Handles AI-powered generation of reading exercises (passage + comprehension questions)
 * and simple answer validation (no AI evaluation needed).
 *
 * Currently hardcoded to pt-PT as the target language.
 *
 * Usage:
 *   import { generateReadingExercise } from '../services/examReadingExerciseService';
 *   import { checkReadingAnswers } from '../services/examUtils';
 *
 *   // Generate a new reading exercise
 *   const exercise = await generateReadingExercise({ token, level: 'A1', targetLang: 'pt-PT' });
 *
 *   // Check student's answers
 *   const result = checkReadingAnswers(userAnswers, exercise.content.questions);
 *
 *   // Generate a new reading exercise
 *   const exercise = await generateReadingExercise({ token, level: 'A1', targetLang: 'pt-PT' });
 *
 *   // Check student's answers
 *   const result = checkReadingAnswers(userAnswers, exercise.content.questions);
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GenerateReadingExerciseParams
 * @property {string} token      - Firebase ID token
 * @property {string} level      - CEFR level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
 * @property {string} targetLang - Target language: 'pt-PT' | 'en-US'
 */

/**
 * @typedef {Object} ReadingQuestion
 * @property {string}   id             - Question ID (e.g., 'r1')
 * @property {string}   text           - Question text
 * @property {string[]} options        - Multiple choice options
 * @property {string}   correctAnswer  - Correct option value
 */

/**
 * @typedef {Object} VocabularyItem
 * @property {string} word       - Word from the passage
 * @property {string} definition - Definition or explanation
 */

/**
 * @typedef {Object} ReadingExerciseContent
 * @property {string}              text         - Main reading passage
 * @property {string[]}            instructions - Bullet-point instructions
 * @property {ReadingQuestion[]}   questions    - Comprehension questions
 * @property {VocabularyItem[]}    vocabulary   - Optional vocabulary list
 * @property {Object}              hints        - Empty hints map (populated on-demand)
 */

/**
 * @typedef {Object} CheckAnswersResult
 * @property {number} score           - Number of correct answers
 * @property {number} maxScore        - Total number of questions
 * @property {number} percentage      - Score as percentage
 * @property {Object[]} breakdown     - Per-question result
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-3.5-flash';

/**
 * Max output tokens for reading exercise generation, scaled by CEFR level.
 * Higher levels produce longer, more complex passages & questions.
 */
const MAX_OUTPUT_TOKENS_BY_LEVEL = {
  A1: 2048,
  A2: 3072,
  B1: 4096,
  B2: 4096,
  C1: 6144,
  C2: 6144,
};
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { getReadingPrompt } from './examPromptTemplates';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a CEFR-appropriate reading exercise (passage + comprehension questions).
 *
 * @param {GenerateReadingExerciseParams} params
 * @returns {Promise<ReadingExerciseContent>}
 */
export async function generateReadingExercise({ token, level, targetLang }) {
  if (!token) throw new Error('[examReadingExerciseService] token is required');
  if (!level) throw new Error('[examReadingExerciseService] level is required');
  if (!targetLang) throw new Error('[examReadingExerciseService] targetLang is required');

  const exerciseTypes = ['multiple-choice', 'true-false', 'best-title'];
  const type = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];
  const prompt = getReadingPrompt(level, targetLang, { type, questionCount: 4 });

  const maxTokens = MAX_OUTPUT_TOKENS_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = await _callAskAI(token, prompt, maxTokens);

  if (!raw) {
    console.error('[examReadingExerciseService] Empty response from AI');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = _parseJSON(raw);

  if (!data?.text || !Array.isArray(data?.questions)) {
    console.error('[examReadingExerciseService] Unexpected response shape', data);
    throw new Error('Something went wrong. Please try again.');
  }

  return {
    text: data.text,
    instructions: data.instructions ?? [],
    questions: data.questions,
    vocabulary: data.vocabulary ?? [],
    hints: {},
  };
}

/**
 * Check reading exercise answers by comparing user selections to correct answers.
 * Simple validation — no AI involved.
 *
 * @param {Object[]} userAnswers - Array of { questionId, selectedAnswer }
 * @param {ReadingQuestion[]} questions - Exercise questions with correct answers
 * @returns {CheckAnswersResult}
 */
/**
 * Check reading exercise answers by comparing user selections to correct answers.
 * Delegates to examUtils.checkAnswers for the actual logic.
 *
 * @param {Object[]} userAnswers - Array of { questionId, selectedAnswer }
 * @param {ReadingQuestion[]} questions - Exercise questions with correct answers
 * @returns {CheckAnswersResult}
 */
/** @deprecated Use `checkReadingAnswers` from `examUtils.js` instead. */
export { checkReadingAnswers } from './examUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * POST to /api/ask-ai with JSON mode enabled.
 */
async function _callAskAI(token, prompt, maxOutputTokens) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:        'gemini',
        model:           GEMINI_MODEL,
        temperature:     0.7,
        jsonMode:        true,
        maxOutputTokens: maxOutputTokens,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    console.error(`[examReadingExerciseService] Request failed (${response.status})`, json);
    throw new Error('Something went wrong. Please try again.');
  }

  return json?.data?.text ?? json?.text ?? '';
}

function _parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (!cleaned) {
    console.error('[examReadingExerciseService] AI returned an empty body');
    throw new Error('Something went wrong. Please try again.');
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`[examReadingExerciseService] Failed to parse AI response: ${err.message}`, cleaned.slice(0, 200));
    throw new Error('Something went wrong. Please try again.');
  }
}
