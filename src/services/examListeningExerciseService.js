/**
 * examListeningExerciseService.js
 *
 * Specialized service for listening exercises.
 * Uses getListeningPrompt from examPromptTemplates for level-appropriate prompts.
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
  const prompt = getListeningPrompt(level, targetLang, { type, audioFormat });

  const maxTokens = MAX_OUTPUT_TOKENS_BY_LEVEL[level] ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const raw = await _callAskAI(token, prompt, maxTokens);

  if (!raw) {
    console.error('[examListeningExerciseService] Empty response from AI');
    throw new Error('Something went wrong. Please try again.');
  }

  const data = _parseJSON(raw);

  if (!data?.transcript || !Array.isArray(data?.questions)) {
    console.error('[examListeningExerciseService] Unexpected response shape', data);
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

export { checkListeningAnswers } from './examUtils';

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