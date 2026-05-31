/**
 * examListeningExerciseService.js
 *
 * Specialized service for listening exercises.
 * Handles AI-powered generation of listening exercises (transcript + comprehension questions)
 * and simple answer validation (no AI evaluation needed).
 *
 * Audio generation:
 *   - AI generates transcript + questions
 *   - audioUrl placeholder stored (audio generation/upload handled separately)
 *   - TTS conversion can be done via Gemini Audio API or external service
 *
 * Currently hardcoded to pt-PT as the target language.
 *
 * Usage:
 *   import { generateListeningExercise, checkListeningAnswers } from '../services/examListeningExerciseService';
 *
 *   // Generate a new listening exercise
 *   const exercise = await generateListeningExercise({ token, level: 'A1', targetLang: 'pt-PT' });
 *
 *   // Check student's answers
 *   const result = checkListeningAnswers(userAnswers, exercise.content.questions);
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GenerateListeningExerciseParams
 * @property {string} token      - Firebase ID token
 * @property {string} level      - CEFR level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
 * @property {string} targetLang - Target language: 'pt-PT' | 'en-US'
 */

/**
 * @typedef {Object} ListeningQuestion
 * @property {string}   id             - Question ID (e.g., 'l1')
 * @property {string}   text           - Question text
 * @property {string[]} options        - Multiple choice options
 * @property {string}   correctAnswer  - Correct option value
 */

/**
 * @typedef {Object} ListeningExerciseContent
 * @property {string}               audioUrl      - URL to audio file (placeholder for now)
 * @property {string}               transcript    - Transcript text
 * @property {number}               duration      - Audio duration in seconds
 * @property {string[]}             instructions  - Bullet-point instructions
 * @property {ListeningQuestion[]}  questions     - Comprehension questions
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
 * Max output tokens for listening exercise generation, scaled by CEFR level.
 * Listening transcripts are shorter than reading passages but C1/C2 need
 * room for complex dialogue + 5 questions + instructions.
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
 * Generate a CEFR-appropriate listening exercise (transcript + questions).
 * Audio generation is deferred (placeholder audioUrl).
 *
 * @param {GenerateListeningExerciseParams} params
 * @returns {Promise<ListeningExerciseContent>}
 */
export async function generateListeningExercise({ token, level, targetLang }) {
  if (!token) throw new Error('[examListeningExerciseService] token is required');
  if (!level) throw new Error('[examListeningExerciseService] level is required');
  if (!targetLang) throw new Error('[examListeningExerciseService] targetLang is required');

  const prompt = [
    `You are a language examiner creating a listening exercise for CEFR level ${level} in ${targetLang}.`,
    ``,
    `Create a realistic dialogue or monologue transcript (40-120 seconds when spoken naturally).`,
    `Then create 3-5 comprehension questions about the content.`,
    `Make both the text and questions appropriate for level ${level}.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "transcript": "<the spoken text in ${targetLang}>",`,
    `  "duration": <estimated duration in seconds, 40-120>,`,
    `  "instructions": ["<bullet instruction 1>", ...],`,
    `  "questions": [`,
    `    {`,
    `      "id": "l1",`,
    `      "text": "<question in ${targetLang}>",`,
    `      "options": ["<option A>", "<option B>", "<option C>"],`,
    `      "correctAnswer": "<correct option>"`,
    `    },`,
    `    ...`,
    `  ]`,
    `}`,
    ``,
    `Rules:`,
    `- All text, instructions, questions, and options must be in ${targetLang}.`,
    `- The transcript should be a natural dialogue or monologue.`,
    `- Create 3-5 questions with 3-4 options each.`,
    `- Keep duration realistic (40-120 seconds).`,
    `- Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const maxTokens = MAX_OUTPUT_TOKENS_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = await _callAskAI(token, prompt, maxTokens);

  if (!raw) {
    console.error('[examListeningExerciseService] Empty response from AI');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = _parseJSON(raw);

  if (!data?.transcript || !Array.isArray(data?.questions)) {
    console.error('[examListeningExerciseService] Unexpected response shape from generateListeningExercise', data);
    throw new Error('Something went wrong. Please try again.');
  }

  return {
    audioUrl: '',
    transcript: data.transcript,
    duration: data.duration ?? 60,
    instructions: data.instructions ?? [],
    questions: data.questions,
  };
}

/**
 * Check listening exercise answers by comparing user selections to correct answers.
 * Simple validation — no AI involved.
 *
 * @param {Object[]} userAnswers - Array of { questionId, selectedAnswer }
 * @param {ListeningQuestion[]} questions - Exercise questions with correct answers
 * @returns {CheckAnswersResult}
 */
export function checkListeningAnswers(userAnswers, questions) {
  if (!Array.isArray(userAnswers)) {
    throw new Error('[examListeningExerciseService] userAnswers must be an array');
  }
  if (!Array.isArray(questions)) {
    throw new Error('[examListeningExerciseService] questions must be an array');
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
    console.error(`[examListeningExerciseService] Request failed (${response.status})`, json);
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
    console.error('[examListeningExerciseService] AI returned an empty body');
    throw new Error('Something went wrong. Please try again.');
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`[examListeningExerciseService] Failed to parse AI response: ${err.message}`, cleaned.slice(0, 200));
    throw new Error('Something went wrong. Please try again.');
  }
}
