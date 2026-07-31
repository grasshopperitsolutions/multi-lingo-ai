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

const WORD_COUNT_BOUNDS = {
  A1: { min: 60, max: 100 },
  A2: { min: 60, max: 100 },
  B1: { min: 100, max: 150 },
  B2: { min: 150, max: 200 },
  C1: { min: 200, max: 250 },
  C2: { min: 200, max: 250 },
};

export async function generateWritingExercise({ token, level, targetLang }) {
  if (!token) throw new Error('[examWritingExerciseService] token is required');
  if (!level) throw new Error('[examWritingExerciseService] level is required');
  if (!targetLang) throw new Error('[examWritingExerciseService] targetLang is required');

  const textTypes = ['email', 'message', 'story', 'article', 'opinion', 'letter'];
  const textType = textTypes[Math.floor(Math.random() * textTypes.length)];
  const promptStr = await getWritingPrompt(level, targetLang, { textType });
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;

  // maxTokens/model can be overridden per-prompt from the admin editor
  // (appConfig/config/prompts/exam-writing-prompt) — falls back to the
  // existing level-scaled map / GEMINI_MODEL constant when unset.
  const writingPromptDoc = await getPrompt('exam-writing-prompt');
  const maxTokens = writingPromptDoc.maxTokens ?? (MAX_OUTPUT_TOKENS_GENERATION_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS_GENERATION);
  const model = writingPromptDoc.model || GEMINI_MODEL;
  const raw = await _callAskAI(token, promptStr, maxTokens, model);

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

export async function evaluateWriting({ token, level, targetLang, interfaceLang, exercisePrompt, userText }) {
  if (!token) throw new Error('[examWritingExerciseService] token is required');
  if (!level) throw new Error('[examWritingExerciseService] level is required');
  if (!targetLang) throw new Error('[examWritingExerciseService] targetLang is required');
  if (!exercisePrompt) throw new Error('[examWritingExerciseService] exercisePrompt is required');
  if (!userText?.trim()) throw new Error('[examWritingExerciseService] userText is required');

  const wordCount = _countWords(userText);
  const wordCountPenalty = _calcWordCountPenalty(wordCount, level);
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;
  const feedbackLanguage = _resolveLanguageName(interfaceLang);

  const promptDoc = await getPrompt('exam-writing-evaluation-prompt');
  const prompt = renderTemplate(promptDoc.template, {
    level, targetLang, exercisePrompt, userText: userText.trim(),
    minWords: min, maxWords: max, wordCount, feedbackLanguage,
  });

  const evalMaxTokens = promptDoc.maxTokens ?? MAX_OUTPUT_TOKENS_EVALUATION;
  const evalModel = promptDoc.model || GEMINI_MODEL;
  const raw = await _callAskAI(token, prompt, evalMaxTokens, evalModel);

  if (!raw) {
    console.error('[examWritingExerciseService] Empty response from AI (evaluation)');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = parseAIJSON(raw);

  if (!Array.isArray(data?.parameters) || data.parameters.length !== 5) {
    console.error('[examWritingExerciseService] Unexpected response shape from evaluateWriting', data);
    throw new Error('Something went wrong. Please try again.');
  }

  const rawScore = data.parameters.reduce((sum, p) => sum + (p.score ?? 0), 0);
  const totalScore = Math.max(0, rawScore - wordCountPenalty);

  return {
    totalScore,
    maxScore: 25,
    rawScore,
    wordCount,
    wordCountPenalty,
    parameters: data.parameters,
    generalFeedback: data.generalFeedback ?? '',
  };
}

async function _callAskAI(token, prompt, maxOutputTokens, model = GEMINI_MODEL) {
  const data = await askAI(token, prompt, {
    provider: 'gemini',
    model,
    temperature: 0.7,
    jsonMode: true,
    maxOutputTokens,
  });
  return data?.text ?? '';
}

function _countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function _calcWordCountPenalty(wordCount, level) {
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;
  if (wordCount >= min && wordCount <= max) return 0;
  if (wordCount >= min - 20 || wordCount <= max + 20) return 1;
  return 2;
}