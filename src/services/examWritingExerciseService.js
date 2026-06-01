/**
 * examWritingExerciseService.js
 *
 * Specialized service for writing exercises.
 * Uses getWritingPrompt from examPromptTemplates for level-appropriate prompts.
 */
import { getWritingPrompt } from './examPromptTemplates';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-3.5-flash';

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
  const promptStr = getWritingPrompt(level, targetLang, { textType });
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;

  const maxTokens = MAX_OUTPUT_TOKENS_GENERATION_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS_GENERATION;
  const raw = await _callAskAI(token, promptStr, maxTokens);

  if (!raw) {
    console.error('[examWritingExerciseService] Empty response from AI (generation)');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = _parseJSON(raw);

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

  const prompt = [
    `You are an expert language examiner evaluating a CEFR ${level} writing exercise in ${targetLang}.`,
    `The student was asked to write in ${targetLang}.`,
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
    `A. Tema, tipologia, informa\u00e7\u00e3o e coer\u00eancia (Theme, text type, information & coherence)`,
    `   5: Fully follows task instructions, coherent, complete information.`,
    `   3: Partially follows instructions, generally coherent with some gaps.`,
    `   1: Insufficient task completion, very little intelligible content.`,
    ``,
    `B. Estrutura e coes\u00e3o (Structure & cohesion)`,
    `   5: Well-defined structure, correct paragraphing, punctuation, cohesive devices, appropriate verb tenses.`,
    `   3: Satisfactory structure with minor inconsistencies in cohesion and verb tense.`,
    `   1: Very poor structure, breaks in cohesion, inconsistent verb tenses.`,
    ``,
    `C. Morfologia e sintaxe (Morphology & syntax)`,
    `   5: Good command of sentence construction, agreement, word order. Uses complex structures.`,
    `   3: Acceptable command with some errors in agreement, selection, inflection.`,
    `   1: Poor command, serious errors throughout. No complex structures.`,
    ``,
    `D. Vocabul\u00e1rio (Vocabulary)`,
    `   5: Adequate, diverse, appropriate vocabulary for the topic.`,
    `   3: Adequate but limited vocabulary with occasional inadequacies.`,
    `   1: Limited, redundant, often inappropriate vocabulary.`,
    ``,
    `E. Ortografia (Spelling)`,
    `   5: Correct spelling or at most 1 error per 60 words.`,
    `   3: Some spelling errors (~4 per 60 words).`,
    `   1: Many spelling errors (more than 7 per 60 words).`,
    ``,
    `Important:`,
    `- Scores may be intermediate values (e.g. 2, 4) when between levels.`,
    `- Expected word count range: ${min}\u2013${max} words. Student wrote ${wordCount} words.`,
    `- Do NOT apply the word count penalty yourself \u2014 it will be applied programmatically.`,
    `- Write ALL feedback (the "feedback" fields and "generalFeedback") in ${feedbackLanguage}. This is mandatory.`,
    `- Be specific and constructive in each parameter's feedback.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "parameters": [`,
    `    { "id": "A", "name": "Tema, tipologia, informa\u00e7\u00e3o e coer\u00eancia", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in ${feedbackLanguage}>" },`,
    `    { "id": "B", "name": "Estrutura e coes\u00e3o",                      "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in ${feedbackLanguage}>" },`,
    `    { "id": "C", "name": "Morfologia e sintaxe",                    "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in ${feedbackLanguage}>" },`,
    `    { "id": "D", "name": "Vocabul\u00e1rio",                             "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in ${feedbackLanguage}>" },`,
    `    { "id": "E", "name": "Ortografia",                              "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in ${feedbackLanguage}>" }`,
    `  ],`,
    `  "generalFeedback": "<overall constructive feedback paragraph in ${feedbackLanguage}>"`,
    `}`,
    `Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const raw = await _callAskAI(token, prompt, MAX_OUTPUT_TOKENS_EVALUATION);

  if (!raw) {
    console.error('[examWritingExerciseService] Empty response from AI (evaluation)');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = _parseJSON(raw);

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

async function _callAskAI(token, prompt, maxOutputTokens) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      providerParams: { provider: 'gemini', model: GEMINI_MODEL, temperature: 0.7, jsonMode: true, maxOutputTokens },
    }),
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

function _countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function _calcWordCountPenalty(wordCount, level) {
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;
  if (wordCount >= min && wordCount <= max) return 0;
  if (wordCount >= min - 20 || wordCount <= max + 20) return 1;
  return 2;
}