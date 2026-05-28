/**
 * examTrainingService.js
 *
 * Handles all AI calls for the Exam Training feature via the /api/ask-ai proxy.
 *
 * // TODO: Currently hardcoded to pt-PT as the learning language.
 * //       When multi-language support is added, pass `targetLang` as a parameter
 * //       and update the prompts accordingly.
 *
 * Usage:
 *   import { generateWritingPrompt, evaluateWriting } from '../services/examTrainingService';
 *
 *   const { prompt, instructions } = await generateWritingPrompt({ token, level: 'A1' });
 *
 *   const result = await evaluateWriting({
 *     token,
 *     level: 'A1',
 *     exercisePrompt: 'Escreve uma mensagem...',
 *     userText: 'Olá, como estás?...',
 *   });
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GenerateWritingPromptParams
 * @property {string} token  - Firebase ID token
 * @property {string} level  - CEFR level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
 */

/**
 * @typedef {Object} GenerateWritingPromptResult
 * @property {string}   prompt       - The writing task description shown to the user
 * @property {string[]} instructions - Bullet-point instructions for the task
 * @property {number}   minWords     - Minimum word count required
 * @property {number}   maxWords     - Maximum word count required
 */

/**
 * @typedef {Object} EvaluateWritingParams
 * @property {string} token          - Firebase ID token
 * @property {string} level          - CEFR level
 * @property {string} exercisePrompt - The original task shown to the user
 * @property {string} userText       - The text written by the user
 */

/**
 * @typedef {Object} EvaluationParameter
 * @property {string} id       - Parameter id: 'A' | 'B' | 'C' | 'D' | 'E'
 * @property {string} name     - Human-readable parameter name
 * @property {number} score    - Score awarded (1–5)
 * @property {number} maxScore - Always 5
 * @property {string} feedback - Specific feedback for this parameter
 */

/**
 * @typedef {Object} EvaluateWritingResult
 * @property {number}               totalScore       - Final score after word count penalty
 * @property {number}               maxScore         - Always 25
 * @property {number}               rawScore         - Score before word count penalty
 * @property {number}               wordCount        - Number of words in userText
 * @property {number}               wordCountPenalty - Penalty applied (0, 1, or 2)
 * @property {EvaluationParameter[]} parameters      - Per-parameter breakdown
 * @property {string}               generalFeedback  - Overall feedback paragraph
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const OPENAI_MODEL = 'gpt-4o-mini';

/** Word count bounds by CEFR level (pt-PT certification standards) */
const WORD_COUNT_BOUNDS = {
  A1: { min: 60,  max: 100 },
  A2: { min: 60,  max: 100 },
  B1: { min: 100, max: 150 },
  B2: { min: 150, max: 200 },
  C1: { min: 200, max: 250 },
  C2: { min: 200, max: 250 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * POST to /api/ask-ai with JSON mode enabled.
 * @param {string} token
 * @param {string} prompt
 * @returns {Promise<string>} Raw text from the AI response
 */
async function callAskAI(token, prompt) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:    'openai',
        model:       OPENAI_MODEL,
        temperature: 0.7,
        jsonMode:    true,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[examTrainingService] Request failed (${response.status})`
    );
  }

  // API envelope: { success: true, data: { text: string } }
  return json?.data?.text ?? json?.text ?? '';
}

/**
 * Safely parse JSON from the AI response.
 * Strips markdown code fences if present.
 * @param {string} raw
 * @returns {object}
 */
function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Count words in a string (splits on whitespace).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate the word count penalty based on pt-PT certification rules.
 * - ±0 if within [min, max]
 * - −1 if between (min−20, min) or (max, max+20]
 * - −2 if below (min−20) or above (max+20)
 * @param {number} wordCount
 * @param {string} level
 * @returns {number} 0 | 1 | 2
 */
function calcWordCountPenalty(wordCount, level) {
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;
  if (wordCount >= min && wordCount <= max)          return 0;
  if (wordCount >= min - 20 || wordCount <= max + 20) return 1;
  return 2;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a CEFR-appropriate writing exercise prompt in pt-PT.
 *
 * @param {GenerateWritingPromptParams} params
 * @returns {Promise<GenerateWritingPromptResult>}
 */
export async function generateWritingPrompt({ token, level }) {
  if (!token) throw new Error('[examTrainingService] token is required');
  if (!level) throw new Error('[examTrainingService] level is required');

  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;

  const prompt = [
    `You are a Portuguese language examiner creating a writing exercise for CEFR level ${level}.`,
    `The exercise must be in European Portuguese (pt-PT).`,
    ``,
    `Create a realistic writing task appropriate for level ${level}.`,
    `The task should require the student to write between ${min} and ${max} words.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "prompt": "<the scenario/context description shown to the student>",`,
    `  "instructions": ["<bullet instruction 1>", "<bullet instruction 2>", ...],`,
    `  "minWords": ${min},`,
    `  "maxWords": ${max}`,
    `}`,
    ``,
    `Rules:`,
    `- The prompt and instructions must be written in European Portuguese (pt-PT).`,
    `- The instructions array should have 3 to 5 bullet points guiding what to include.`,
    `- Keep the scenario realistic and age-appropriate for a language learner.`,
    `- Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const raw = await callAskAI(token, prompt);

  if (!raw) throw new Error('[examTrainingService] Empty response from AI');

  const data = parseJSON(raw);

  if (!data?.prompt || !Array.isArray(data?.instructions)) {
    throw new Error('[examTrainingService] Unexpected response shape from generateWritingPrompt');
  }

  return {
    prompt:       data.prompt,
    instructions: data.instructions,
    minWords:     data.minWords ?? min,
    maxWords:     data.maxWords ?? max,
  };
}

/**
 * Evaluate a student's written text against the 5-parameter CEFR rubric
 * used in official pt-PT certification exams (e.g. CAPLE/DIPLE).
 *
 * Rubric parameters (each scored 1–5):
 *   A. Tema, tipologia, informação e coerência
 *   B. Estrutura e coesão
 *   C. Morfologia e sintaxe
 *   D. Vocabulário
 *   E. Ortografia
 *
 * Word count penalty (applied after summing A–E):
 *   −1 point  : 20 words below min OR 20 words above max
 *   −2 points : more than 20 words below min OR above max
 *
 * @param {EvaluateWritingParams} params
 * @returns {Promise<EvaluateWritingResult>}
 */
export async function evaluateWriting({ token, level, exercisePrompt, userText }) {
  if (!token)          throw new Error('[examTrainingService] token is required');
  if (!level)          throw new Error('[examTrainingService] level is required');
  if (!exercisePrompt) throw new Error('[examTrainingService] exercisePrompt is required');
  if (!userText?.trim()) throw new Error('[examTrainingService] userText is required');

  const wordCount        = countWords(userText);
  const wordCountPenalty = calcWordCountPenalty(wordCount, level);
  const { min, max }     = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;

  const prompt = [
    `You are an expert Portuguese language examiner evaluating a CEFR ${level} writing exercise.`,
    `The student was asked to write in European Portuguese (pt-PT).`,
    ``,
    `--- EXERCISE PROMPT ---`,
    exercisePrompt,
    `--- END EXERCISE PROMPT ---`,
    ``,
    `--- STUDENT TEXT ---`,
    userText.trim(),
    `--- END STUDENT TEXT ---`,
    ``,
    `Evaluate the student text using the following 5 parameters, each scored from 1 to 5:`,
    ``,
    `A. Tema, tipologia, informação e coerência`,
    `   5: Fully follows task instructions, coherent, complete information.`,
    `   3: Partially follows instructions, generally coherent with some gaps.`,
    `   1: Insufficient task completion, very little intelligible content.`,
    ``,
    `B. Estrutura e coesão`,
    `   5: Well-defined structure, correct paragraphing, punctuation, cohesive devices, appropriate verb tenses.`,
    `   3: Satisfactory structure with minor inconsistencies in cohesion and verb tense.`,
    `   1: Very poor structure, breaks in cohesion, inconsistent verb tenses.`,
    ``,
    `C. Morfologia e sintaxe`,
    `   5: Good command of sentence construction, agreement, word order. Uses complex structures.`,
    `   3: Acceptable command with some errors in agreement, selection, inflection.`,
    `   1: Poor command, serious errors throughout. No complex structures.`,
    ``,
    `D. Vocabulário`,
    `   5: Adequate, diverse, appropriate vocabulary for the topic.`,
    `   3: Adequate but limited vocabulary with occasional inadequacies.`,
    `   1: Limited, redundant, often inappropriate vocabulary.`,
    ``,
    `E. Ortografia`,
    `   5: Correct spelling or at most 1 error per 60 words.`,
    `   3: Some spelling errors (~4 per 60 words).`,
    `   1: Many spelling errors (more than 7 per 60 words).`,
    ``,
    `Important:`,
    `- Scores may be intermediate values (e.g. 2, 4) when between levels.`,
    `- Expected word count range: ${min}–${max} words. Student wrote ${wordCount} words.`,
    `- Do NOT apply the word count penalty yourself — it will be applied programmatically.`,
    `- Write all feedback in the same language as the student's interface (English unless detected otherwise).`,
    `- Be specific and constructive in each parameter's feedback.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "parameters": [`,
    `    { "id": "A", "name": "Tema, tipologia, informação e coerência", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "B", "name": "Estrutura e coesão",                      "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "C", "name": "Morfologia e sintaxe",                    "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "D", "name": "Vocabulário",                             "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "E", "name": "Ortografia",                              "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" }`,
    `  ],`,
    `  "generalFeedback": "<overall constructive feedback paragraph>"`,
    `}`,
    ``,
    `Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const raw = await callAskAI(token, prompt);

  if (!raw) throw new Error('[examTrainingService] Empty response from AI');

  const data = parseJSON(raw);

  if (!Array.isArray(data?.parameters) || data.parameters.length !== 5) {
    throw new Error('[examTrainingService] Unexpected response shape from evaluateWriting');
  }

  const rawScore   = data.parameters.reduce((sum, p) => sum + (p.score ?? 0), 0);
  const totalScore = Math.max(0, rawScore - wordCountPenalty);

  return {
    totalScore,
    maxScore: 25,
    rawScore,
    wordCount,
    wordCountPenalty,
    parameters:      data.parameters,
    generalFeedback: data.generalFeedback ?? '',
  };
}
