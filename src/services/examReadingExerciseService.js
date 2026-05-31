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
 *   import { generateReadingExercise, checkReadingAnswers } from '../services/examReadingExerciseService';
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

  const prompt = [
    `You are a language examiner creating a reading exercise for CEFR level ${level} in ${targetLang}.`,
    ``,
    `Create a realistic reading passage and 3-5 comprehension questions.`,
    `Make the text and questions appropriate for level ${level}.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "text": "<the main reading passage in ${targetLang}>",`,
    `  "instructions": ["<bullet instruction 1>", ...],`,
    `  "questions": [`,
    `    {`,
    `      "id": "r1",`,
    `      "text": "<question in ${targetLang}>",`,
    `      "options": ["<option A>", "<option B>", "<option C>"],`,
    `      "correctAnswer": "<correct option>"`,
    `    },`,
    `    ...`,
    `  ],`,
    `  "vocabulary": []`,
    `}`,
    ``,
    `Rules:`,
    `- All text, instructions, questions, and options must be in ${targetLang}.`,
    `- Create 3-5 questions with 3-4 options each.`,
    `- Ensure one option is clearly correct.`,
    `- Keep vocabulary array empty for now (can be populated manually).`,
    `- Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const maxTokens = MAX_OUTPUT_TOKENS_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = await _callAskAI(token, prompt, maxTokens);

  if (!raw) throw new Error('[examReadingExerciseService] Empty response from AI');

  const data = _parseJSON(raw);

  if (!data?.text || !Array.isArray(data?.questions)) {
    throw new Error('[examReadingExerciseService] Unexpected response shape from generateReadingExercise');
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
export function checkReadingAnswers(userAnswers, questions) {
  if (!Array.isArray(userAnswers)) {
    throw new Error('[examReadingExerciseService] userAnswers must be an array');
  }
  if (!Array.isArray(questions)) {
    throw new Error('[examReadingExerciseService] questions must be an array');
  }

  const answerMap = new Map(userAnswers.map((a) => [a.questionId, a.selectedAnswer]));

  let correctCount = 0;
  const breakdown = questions.map((q) => {
    const userAnswer = answerMap.get(q.id);
    const isCorrect = userAnswer === q.correctAnswer;
    if (isCorrect) correctCount++;

    return {
      questionId: q.id,
      question: q.text,
      userAnswer: userAnswer || null,
      correctAnswer: q.correctAnswer,
      isCorrect,
    };
  });

  const maxScore = questions.length;
  const percentage = maxScore > 0 ? Math.round((correctCount / maxScore) * 100) : 0;

  return {
    score: correctCount,
    maxScore,
    percentage,
    breakdown,
  };
}

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
    throw new Error(
      json?.error ?? json?.message ?? `[examReadingExerciseService] Request failed (${response.status})`
    );
  }

  return json?.data?.text ?? json?.text ?? '';
}

function _parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}
