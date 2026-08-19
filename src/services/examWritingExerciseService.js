/**
 * examWritingExerciseService.js
 *
 * Specialized service for writing exercises.
 * Uses getWritingPrompt from examPromptTemplates for level-appropriate prompts.
 */
import { getWritingPrompt } from './examPromptTemplates';
import { getPrompt, renderTemplate } from './promptService';
import { parseAIJSON } from '../utils/parseAIJSON';
import { askAI } from './aiService';
import { getWritingSpec, RUBRIC_MAX_SCORE } from '../config/examLevels';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

const LOCALE_TO_LANGUAGE_NAME = {
  'en': 'English', 'en-US': 'English', 'en-GB': 'English',
  'es': 'Spanish', 'es-ES': 'Spanish',
  'fr': 'French', 'fr-FR': 'French',
  'pt': 'European Portuguese', 'pt-PT': 'European Portuguese', 'pt-BR': 'Brazilian Portuguese',
};

function _resolveLanguageName(locale) {
  if (!locale) return 'English';
  return LOCALE_TO_LANGUAGE_NAME[locale] ?? LOCALE_TO_LANGUAGE_NAME[locale.split('-')[0]] ?? 'English';
}

const MAX_OUTPUT_TOKENS_GENERATION_BY_LEVEL = {
  A1: 2048, A2: 3072, B1: 4096, B2: 4096, C1: 6144, C2: 6144,
};
const DEFAULT_MAX_OUTPUT_TOKENS_GENERATION = 4096;
const MAX_OUTPUT_TOKENS_EVALUATION = 6144;

export async function generateWritingExercise({ token, level, targetLang }) {
  if (!token) throw new Error('[examWritingExerciseService] token is required');
  if (!level) throw new Error('[examWritingExerciseService] level is required');
  if (!targetLang) throw new Error('[examWritingExerciseService] targetLang is required');

  const textTypes = ['email', 'message', 'story', 'article', 'opinion', 'letter'];
  const textType = textTypes[Math.floor(Math.random() * textTypes.length)];
  const promptStr = await getWritingPrompt(level, targetLang, { textType });
  const { minWords: min, maxWords: max } = getWritingSpec(level);

  // maxTokens/model can be overridden per-prompt from the admin editor
  // (appConfig/config/prompts/exam-writing-prompt) — falls back to the
  // existing level-scaled map / GEMINI_MODEL constant when unset.
  const writingPromptDoc = await getPrompt('exam-writing-prompt');
  const maxTokens = writingPromptDoc.maxTokens ?? (MAX_OUTPUT_TOKENS_GENERATION_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS_GENERATION);
  const model = writingPromptDoc.model || GEMINI_MODEL;
  const raw = await _callAskAI(token, promptStr, maxTokens, model, WRITING_EXERCISE_SCHEMA);

  if (!raw) {
    console.error('[examWritingExerciseService] Empty response from AI (generation)');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = parseAIJSON(raw);

  if (!data?.prompt || !Array.isArray(data?.instructions)) {
    console.error('[examWritingExerciseService] Unexpected response shape', data);
    throw new Error('Something went wrong. Please try again.');
  }

  return {
    prompt: data.prompt,
    instructions: data.instructions,
    minWords: data.minWords ?? min,
    maxWords: data.maxWords ?? max,
    hints: {},
  };
}

export async function evaluateWriting({
  token, level, targetLang, interfaceLang, exercisePrompt, userText,
  // The generator may return its own word range, which is what the student is
  // actually shown. Passing it through means the penalty is applied against the
  // target they were given rather than the level default.
  minWords: overrideMin, maxWords: overrideMax,
}) {
  if (!token) throw new Error('[examWritingExerciseService] token is required');
  if (!level) throw new Error('[examWritingExerciseService] level is required');
  if (!targetLang) throw new Error('[examWritingExerciseService] targetLang is required');
  if (!exercisePrompt) throw new Error('[examWritingExerciseService] exercisePrompt is required');
  if (!userText?.trim()) throw new Error('[examWritingExerciseService] userText is required');

  const spec = getWritingSpec(level);
  const min = overrideMin ?? spec.minWords;
  const max = overrideMax ?? spec.maxWords;
  const wordCount = _countWords(userText);
  const wordCountPenalty = _calcWordCountPenalty(wordCount, min, max);
  const feedbackLanguage = _resolveLanguageName(interfaceLang);

  const promptDoc = await getPrompt('exam-writing-evaluation-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    level, targetLang, exercisePrompt, userText: userText.trim(),
    minWords: min, maxWords: max, wordCount, feedbackLanguage,
  });

  const evalMaxTokens = promptDoc.maxTokens ?? MAX_OUTPUT_TOKENS_EVALUATION;
  const evalModel = promptDoc.model || GEMINI_MODEL;
  const raw = await _callAskAI(token, prompt, evalMaxTokens, evalModel, WRITING_EVALUATION_SCHEMA);

  if (!raw) {
    console.error('[examWritingExerciseService] Empty response from AI (evaluation)');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = parseAIJSON(raw);

  if (!Array.isArray(data?.parameters) || data.parameters.length !== 5) {
    console.error('[examWritingExerciseService] Unexpected response shape from evaluateWriting', data);
    throw new Error('Something went wrong. Please try again.');
  }

  // Stamp the rubric letter onto each parameter. The response schema doesn't
  // ask the model for an id (letting it invent one would be worse), but
  // ParameterRow keys on `param.id` and looks up its translated label via
  // PARAM_NAME_KEYS[param.id] — without this the lookup missed, labels fell
  // back to raw AI-generated names, and React got an undefined key.
  const parameters = data.parameters.map((p, i) => ({
    ...p,
    id: p.id ?? String.fromCharCode(65 + i),   // A, B, C, D, E
    maxScore: p.maxScore ?? RUBRIC_MAX_SCORE / data.parameters.length,
  }));

  const rawScore = parameters.reduce((sum, p) => sum + (p.score ?? 0), 0);
  const totalScore = Math.max(0, rawScore - wordCountPenalty);
  // Derive the ceiling from what the model actually returned rather than
  // assuming 25, so a rubric that comes back weighted differently still adds up.
  const maxScore = parameters.reduce((sum, p) => sum + (p.maxScore ?? 0), 0) || RUBRIC_MAX_SCORE;

  return {
    totalScore,
    maxScore,
    rawScore,
    wordCount,
    wordCountPenalty,
    minWords: min,
    maxWords: max,
    parameters,
    generalFeedback: data.generalFeedback ?? '',
  };
}

/**
 * Response shapes, enforced by the Gemini API rather than requested in prose.
 * Passing `responseSchema` alongside `responseMimeType: 'application/json'`
 * constrains generation to exactly this structure, so a malformed or
 * fenced response can't reach parseAIJSON in the first place.
 */
const WRITING_EXERCISE_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string', description: 'The writing task, in the target language.' },
    instructions: { type: 'array', items: { type: 'string' } },
    minWords: { type: 'number' },
    maxWords: { type: 'number' },
  },
  required: ['prompt', 'instructions'],
};

/**
 * evaluateWriting rejects anything that isn't exactly 5 parameters, so the
 * schema pins that count rather than leaving it to the prompt.
 */
const WRITING_EVALUATION_SCHEMA = {
  type: 'object',
  properties: {
    parameters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          score: { type: 'number' },
          maxScore: { type: 'number' },
          feedback: { type: 'string' },
        },
        required: ['name', 'score', 'feedback'],
      },
      minItems: 5,
      maxItems: 5,
    },
    generalFeedback: { type: 'string' },
  },
  required: ['parameters'],
};

async function _callAskAI(token, prompt, maxOutputTokens, model = GEMINI_MODEL, responseSchema) {
  const providerParams = {
    provider: 'gemini',
    model,
    temperature: 0.7,
    jsonMode: true,
    maxOutputTokens,
  };
  if (responseSchema) providerParams.responseSchema = responseSchema;

  const data = await askAI(token, prompt, providerParams);
  return data?.text ?? '';
}

function _countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Penalty for missing the word-count target: 0 inside the range, 1 just outside
 * it, 2 well outside.
 *
 * The middle test used `||`, which is true for almost any input (a 5-word answer
 * satisfies `5 <= max + 20`), so the 2-point penalty was unreachable and every
 * out-of-range answer lost exactly one point regardless of how far off it was.
 */
function _calcWordCountPenalty(wordCount, min, max) {
  if (wordCount >= min && wordCount <= max) return 0;
  if (wordCount >= min - 20 && wordCount <= max + 20) return 1;
  return 2;
}