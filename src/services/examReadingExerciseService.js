/**
 * examReadingExerciseService.js
 *
 * Specialized service for reading exercises.
 * Handles AI-powered generation of reading exercises with random type selection
 * and simple answer validation (no AI evaluation needed).
 *
 * Exercise Types:
 *   - multiple-choice: Traditional multiple choice questions
 *   - true-false: True/false statements about a passage
 *   - best-title: Choose the best title for a passage
 *   - ordering: Put paragraphs/sentences in correct order
 *   - cloze: Fill in blanks with multiple choice options
 *   - fill-blanks: Fill in blanks from a word bank
 *   - matching: Match items from two columns
 *   - notice-sign: Read notices/signs and answer questions
 *
 * Usage:
 *   import { generateReadingExercise } from '../services/examReadingExerciseService';
 *   import { checkReadingAnswers } from '../services/examUtils';
 *
 *   // Generate a new reading exercise (random type)
 *   const exercise = await generateReadingExercise({ token, level: 'A1', targetLang: 'pt-PT' });
 *
 *   // Check student's answers
 *   const result = checkReadingAnswers(userAnswers, exercise.questions);
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
 * @typedef {Object} ReadingExerciseContent
 * @property {string} questionType - Type of exercise (e.g., 'multiple-choice', 'true-false')
 * @property {string} text         - Main reading passage (for passage-based exercises)
 * @property {string[]} instructions - Bullet-point instructions
 * @property {Array} questions      - Exercise questions/items (structure varies by type)
 * @property {Array} vocabulary     - Optional vocabulary list
 * @property {Object} hints         - Empty hints map (populated on-demand)
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

/**
 * Available reading exercise types.
 */
const READING_EXERCISE_TYPES = [
  'multiple-choice',
  'true-false',
  'best-title',
  'ordering',
  'cloze',
  'fill-blanks',
  'matching',
  'notice-sign',
];

/**
 * Maps internal exercise type names to the type names used by getReadingPrompt.
 * All 8 reading types are now supported by getReadingPrompt.
 */
const TYPE_TO_PROMPT_MAP = {
  'multiple-choice': 'multiple-choice',
  'true-false': 'true-false',
  'best-title': 'best-title',
  'ordering': 'ordering',
  'cloze': 'cloze-options',
  'fill-blanks': 'fill-blanks',
  'matching': 'matching',
  'notice-sign': 'notice-sign',
};

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { checkReadingAnswers } from './examUtils';
import { getReadingPrompt } from './examPromptTemplates';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a CEFR-appropriate reading exercise with random type selection.
 *
 * @param {GenerateReadingExerciseParams} params
 * @returns {Promise<ReadingExerciseContent>}
 */
export async function generateReadingExercise({ token, level, targetLang, questionType: forcedType }) {
  if (!token) throw new Error('[examReadingExerciseService] token is required');
  if (!level) throw new Error('[examReadingExerciseService] level is required');
  if (!targetLang) throw new Error('[examReadingExerciseService] targetLang is required');

  // Step 1: Use provided type or randomly pick one
  const questionType = forcedType && READING_EXERCISE_TYPES.includes(forcedType)
    ? forcedType
    : READING_EXERCISE_TYPES[Math.floor(Math.random() * READING_EXERCISE_TYPES.length)];

  // Step 2: Get type-specific prompt from getReadingPrompt
  const prompt = getPromptForType(questionType, level, targetLang);

  // Step 3: Get JSON Schema for this exercise type (improves Gemini output reliability)
  const responseSchema = getResponseSchemaForType(questionType);

  // Step 4: Single AI call with schema
  const maxTokens = MAX_OUTPUT_TOKENS_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = await _callAskAI(token, prompt, maxTokens, responseSchema);

  if (!raw) {
    console.error('[examReadingExerciseService] Empty response from AI');
    throw new Error('Something went wrong. Please try again.');
  }

  // Step 5: Parse response
  const data = _parseJSON(raw);

  // Step 6: Normalise parsed data into a consistent ReadingExerciseContent shape
  const exerciseData = _parseAIResponse(data, questionType);

  return {
    questionType,
    ...exerciseData,
  };
}

/**
 * Check reading exercise answers by comparing user selections to correct answers.
 * Delegates to examUtils.checkAnswers for the actual logic.
 *
 * @param {Object[]} userAnswers - Array of { questionId, selectedAnswer }
 * @param {Array} questions - Exercise questions with correct answers
 * @returns {CheckAnswersResult}
 */
export { checkReadingAnswers };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the appropriate prompt for a given exercise type.
 * All types are routed through the centralized getReadingPrompt from examPromptTemplates.
 *
 * @param {string} type - Exercise type (e.g., 'multiple-choice')
 * @param {string} level - CEFR level
 * @param {string} targetLang - Target learning language
 * @returns {string} AI prompt
 */
function getPromptForType(type, level, targetLang) {
  const mappedType = TYPE_TO_PROMPT_MAP[type];
  if (!mappedType) {
    throw new Error(`[examReadingExerciseService] Unknown exercise type: ${type}`);
  }
  return getReadingPrompt(level, targetLang, { type: mappedType });
}

/**
 * Get the JSON Schema for a given exercise type.
 * Passing a responseSchema to Gemini (via jsonMode) significantly improves
 * output reliability by constraining the model to the exact expected structure.
 *
 * @param {string} type - Exercise type
 * @returns {Object} JSON Schema object
 */
function getResponseSchemaForType(type) {
  switch (type) {
    case 'multiple-choice':
      return {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
                correctAnswer: { type: 'string' },
              },
              required: ['id', 'question', 'options', 'correctAnswer'],
            },
            minItems: 4,
            maxItems: 6,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['passage', 'questions'],
      };

    case 'true-false':
      return {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          statements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                isTrue: { type: 'boolean' },
              },
              required: ['id', 'text', 'isTrue'],
            },
            minItems: 5,
            maxItems: 8,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['passage', 'statements'],
      };

    case 'best-title':
      return {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          titles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                isCorrect: { type: 'boolean' },
              },
              required: ['id', 'text', 'isCorrect'],
            },
            minItems: 4,
            maxItems: 5,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['passage', 'titles'],
      };

    case 'ordering':
      return {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                correctPosition: { type: 'number' },
              },
              required: ['id', 'text', 'correctPosition'],
            },
            minItems: 5,
            maxItems: 7,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['items'],
      };

    case 'cloze':
      return {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          blanks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                position: { type: 'number' },
                options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
                correctAnswer: { type: 'string' },
              },
              required: ['id', 'position', 'options', 'correctAnswer'],
            },
            minItems: 5,
            maxItems: 8,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['passage', 'blanks'],
      };

    case 'fill-blanks':
      return {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          wordBank: { type: 'array', items: { type: 'string' }, minItems: 8, maxItems: 13 },
          blanks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                position: { type: 'number' },
                correctAnswer: { type: 'string' },
              },
              required: ['id', 'position', 'correctAnswer'],
            },
            minItems: 5,
            maxItems: 8,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['passage', 'wordBank', 'blanks'],
      };

    case 'matching':
      return {
        type: 'object',
        properties: {
          pairs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                itemA: { type: 'string' },
                itemB: { type: 'string' },
              },
              required: ['id', 'itemA', 'itemB'],
            },
            minItems: 5,
            maxItems: 7,
          },
          extraItems: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
          showExample: { type: 'boolean' },
          example: {
            type: 'object',
            properties: {
              itemA: { type: 'string' },
              itemB: { type: 'string' },
            },
            required: ['itemA', 'itemB'],
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['pairs', 'extraItems'],
      };

    case 'notice-sign':
      return {
        type: 'object',
        properties: {
          notices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
                correctAnswer: { type: 'string' },
              },
              required: ['id', 'text', 'question', 'options', 'correctAnswer'],
            },
            minItems: 4,
            maxItems: 6,
          },
          instructions: { type: 'array', items: { type: 'string' } },
        },
        required: ['notices'],
      };

    default:
      return null;
  }
}

/**
 * Normalise parsed AI data into a consistent ReadingExerciseContent shape.
 * Maps the varying field names from different exercise types to the unified
 * shape expected by ReadingExercise.jsx.
 *
 * @param {Object} data     - Parsed AI response
 * @param {string} type     - Exercise type
 * @returns {Object}        - Normalised ReadingExerciseContent
 */
function _parseAIResponse(data, type) {
  const instructions = data?.instructions ?? [];
  // 'text' field serves as the reading passage / source material
  // 'questions' field holds the interactive items (may be renamed per type)
  let text = '';
  let questions = [];
  let wordBank = [];
  let extraItems = [];
  let showExample = false;
  let example = null;
  let titles = [];

  switch (type) {
    case 'multiple-choice':
      text = data?.passage ?? '';
      questions = data?.questions ?? [];
      break;
    case 'true-false':
      text = data?.passage ?? '';
      questions = (data?.statements ?? []).map((s) => ({
        ...s,
        correctAnswer: s.isTrue ? 'true' : 'false',
      }));
      break;
    case 'best-title': {
      text = data?.passage ?? '';
      // Store full titles separately for rendering, and create a single question for answer checking
      const correctTitle = (data?.titles ?? []).find((t) => t.isCorrect);
      questions = [{ id: 'bestTitle', text: 'Escolhe o melhor título', correctAnswer: correctTitle?.text ?? '' }];
      titles = data?.titles ?? [];
      break;
    }
    case 'ordering':
      // correctPosition is a number — map it to correctAnswer so checkAnswers can compare
      questions = (data?.items ?? []).map((item) => ({
        ...item,
        correctAnswer: item.correctPosition,
      }));
      break;
    case 'cloze':
      text = data?.passage ?? '';
      questions = data?.blanks ?? [];
      break;
    case 'fill-blanks':
      text = data?.passage ?? '';
      questions = data?.blanks ?? [];
      wordBank = data?.wordBank ?? [];
      break;
    case 'matching':
      questions = (data?.pairs ?? []).map((p) => ({
        ...p,
        text: p.itemA,
        correctAnswer: p.itemB,
      }));
      extraItems = data?.extraItems ?? [];
      showExample = data?.showExample ?? false;
      example = data?.example ?? null;
      break;
    case 'notice-sign':
      questions = data?.notices ?? [];
      break;
  }

  return {
    text,
    questions,
    instructions,
    wordBank,
    extraItems,
    showExample,
    example,
    titles,
  };
}

/**
 * POST to /api/ask-ai with JSON mode and response schema enabled.
 * The responseSchema parameter constrains Gemini output to the exact structure,
 * significantly improving parse reliability compared to jsonMode alone.
 */
async function _callAskAI(token, prompt, maxOutputTokens, responseSchema) {
  const providerParams = {
    provider: 'gemini',
    model: GEMINI_MODEL,
    temperature: 0.7,
    jsonMode: true,
    maxOutputTokens: maxOutputTokens,
  };

  // Pass responseSchema if provided — this is a Gemini capability that constrains
  // the output to exactly match the schema, improving reliability
  if (responseSchema) {
    providerParams.responseSchema = responseSchema;
  }

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams,
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