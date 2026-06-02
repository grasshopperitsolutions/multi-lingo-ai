/**
 * examListeningExerciseService.js
 *
 * Specialized service for listening exercises.
 * Uses getListeningPrompt from examPromptTemplates for level-appropriate prompts.
 *
 * Returns:
 *   For multiple-choice / true-false:
 *     { transcript, tone, duration, instructions, questions, exerciseType }
 *   For fill-blanks:
 *     { transcript, tone, duration, instructions, passage, wordBank, blanks, exerciseType }
 */

import { getListeningPrompt } from './examPromptTemplates';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-3.5-flash';

const MAX_OUTPUT_TOKENS_BY_LEVEL = {
  A1: 2048, A2: 3072, B1: 4096, B2: 4096, C1: 6144, C2: 6144,
};
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export async function generateListeningExercise({ token, level, targetLang }) {
  if (!token) throw new Error('[examListeningExerciseService] token is required');
  if (!level) throw new Error('[examListeningExerciseService] level is required');
  if (!targetLang) throw new Error('[examListeningExerciseService] targetLang is required');

  const audioFormats = ['dialogue', 'monologue', 'phone-message', 'announcement', 'interview'];
  const exerciseTypes = ['multiple-choice', 'true-false', 'fill-blanks'];
  const audioFormat = audioFormats[Math.floor(Math.random() * audioFormats.length)];
  const type = exerciseTypes[Math.floor(Math.random() * exerciseTypes.length)];

  // Build prompt with targetLang
  const prompt = getListeningPrompt(level, targetLang, { type, audioFormat });

  // Get JSON Schema for this exercise type
  const responseSchema = getResponseSchemaForType(type);

  const maxTokens = MAX_OUTPUT_TOKENS_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = await _callAskAI(token, prompt, maxTokens, responseSchema);

  if (!raw) {
    console.error('[examListeningExerciseService] Empty response from AI');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = _parseJSON(raw);

  if (!data?.transcript) {
    console.error('[examListeningExerciseService] Missing transcript', data);
    throw new Error('Something went wrong. Please try again.');
  }

  // Validate based on exercise type
  if (type === 'fill-blanks') {
    if (!data?.passage || !Array.isArray(data?.wordBank) || !Array.isArray(data?.blanks)) {
      console.error('[examListeningExerciseService] Unexpected fill-blanks response shape', data);
      throw new Error('Something went wrong. Please try again.');
    }
  } else {
    if (!Array.isArray(data?.questions)) {
      console.error('[examListeningExerciseService] Unexpected response shape', data);
      throw new Error('Something went wrong. Please try again.');
    }
  }

  // Build return shape based on type
  const base = {
    audioUrl: '',
    transcript: data.transcript,
    tone: data.tone ?? '',
    duration: data.duration ?? 60,
    instructions: data.instructions ?? [],
    exerciseType: type,
  };

  if (type === 'fill-blanks') {
    return {
      ...base,
      passage: data.passage,
      wordBank: data.wordBank,
      blanks: data.blanks,
    };
  }

  return {
    ...base,
    questions: data.questions,
  };
}

export { checkListeningAnswers } from './examUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get a JSON Schema for the given listening exercise type.
 *
 * @param {string} type - 'multiple-choice' | 'true-false' | 'fill-blanks'
 * @returns {Object|null} JSON Schema object
 */
function getResponseSchemaForType(type) {
  switch (type) {
    case 'multiple-choice':
      return {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          tone: { type: 'string' },
          duration: { type: 'number' },
          instructions: { type: 'array', items: { type: 'string' } },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                options: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 4 },
                correctAnswer: { type: 'string' },
              },
              required: ['id', 'text', 'options', 'correctAnswer'],
            },
            minItems: 3,
            maxItems: 5,
          },
        },
        required: ['transcript', 'questions'],
      };

    case 'true-false':
      return {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          tone: { type: 'string' },
          duration: { type: 'number' },
          instructions: { type: 'array', items: { type: 'string' } },
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
            minItems: 3,
            maxItems: 5,
          },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
                correctAnswer: { type: 'string' },
              },
              required: ['id', 'text', 'options', 'correctAnswer'],
            },
          },
        },
        required: ['transcript', 'statements', 'questions'],
      };

    case 'fill-blanks':
      return {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          tone: { type: 'string' },
          duration: { type: 'number' },
          instructions: { type: 'array', items: { type: 'string' } },
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
            minItems: 3,
            maxItems: 5,
          },
        },
        required: ['transcript', 'passage', 'wordBank', 'blanks'],
      };

    default:
      return null;
  }
}

async function _callAskAI(token, prompt, maxOutputTokens, responseSchema) {
  const providerParams = {
    provider: 'gemini',
    model: GEMINI_MODEL,
    temperature: 0.7,
    jsonMode: true,
    maxOutputTokens,
  };

  if (responseSchema) {
    providerParams.responseSchema = responseSchema;
  }

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, providerParams }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Request failed');
  return json?.data?.text ?? json?.text ?? '';
}

function _parseJSON(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!cleaned) throw new Error('Empty response');
  try { return JSON.parse(cleaned); } catch {
    throw new Error('Failed to parse AI response');
  }
}