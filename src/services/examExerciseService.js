/**
 * examExerciseService.js
 *
 * Core exercise management service with Firestore caching.
 * Routes exercise generation to type-specific services and manages Firestore operations.
 *
 * Type-specific services:
 *   - examWritingExerciseService: generateWritingExercise + evaluateWriting
 *   - examListeningExerciseService: generateListeningExercise + checkListeningAnswers
 *   - examReadingExerciseService: generateReadingExercise + checkReadingAnswers
 *
 * Flow:
 *   1. Query examExercises where status == "ready", filtered by level, type, targetLang
 *   2. Find first unseen exercise (not in seenExerciseIds)
 *   3. If found → fetch content/{targetLang} → return
 *   4. If all seen → route to type-specific service for generation
 *   5. Write generated exercise to Firestore → return
 *
 * Firestore schema:
 *
 *   examExercises/{exerciseId}
 *     type: "writing" | "reading" | "listening"
 *     level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
 *     targetLang: "pt-PT" | "en-US"
 *     questionType: string (for reading: "multiple-choice" | "true-false" | "best-title" | "ordering" | "cloze" | "fill-blanks" | "matching" | "notice-sign")
 *     status: "ready" | "draft" | "blocked"
 *     aiGenerated: boolean
 *     verified: boolean
 *     qualityScore: number | null
 *     createdAt: Timestamp
 *     updatedAt: Timestamp
 *
 *   examExercises/{exerciseId}/content/{targetLang}
 *     locale: string
 *     language: string
 *     region: string | null
 *     type: "writing" | "reading" | "listening"
 *     questionType: string (for reading exercises)
 *     writing: { prompt, instructions[], minWords, maxWords, hints }
 *     reading: { questionType, text, questions[], vocabulary[], instructions, hints }
 *     listening: { audioUrl, transcript, duration, questions[], instructions }
 *     source: "human" | "ai"
 *     verified: boolean
 *     qualityScore: number | null
 *     createdAt: Timestamp
 *     updatedAt: Timestamp
 *
 * @module examExerciseService
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { generateWritingExercise } from './examWritingExerciseService';
import { generateListeningExercise } from './examListeningExerciseService';
import { generateReadingExercise } from './examReadingExerciseService';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GetExerciseParams
 * @property {string}   token            - Firebase ID token
 * @property {string}   level            - CEFR level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
 * @property {string}   type             - Exercise type: 'writing' | 'reading' | 'listening'
 * @property {string}   targetLang       - Target learning language: 'pt-PT' | 'en-US'
 * @property {string}   userDialect      - User's native language: 'en-US' | 'pt-PT'
 * @property {string[]} seenExerciseIds  - Already-seen exercise IDs
 */

/**
 * @typedef {Object} ExerciseResult
 * @property {string}    exerciseId       - examExercises document ID
 * @property {string}    type             - Exercise type
 * @property {string}    level            - CEFR level
 * @property {string}    [questionType]   - Question type (for reading exercises)
 * @property {'db'|'ai'} source           - Where it came from
 * @property {Object}    content          - Exercise content (writing/reading/listening)
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const POOL_LIMIT = 100;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the next unseen exam exercise, or generate one if the pool is exhausted.
 *
 * @param {GetExerciseParams} params
 * @returns {Promise<ExerciseResult>}
 */
export async function getExercise({
  token,
  level,
  type,
  targetLang,
  userDialect,
  seenExerciseIds,
}) {
  if (!token) throw new Error('[examExerciseService] token is required');
  if (!level) throw new Error('[examExerciseService] level is required');
  if (!type) throw new Error('[examExerciseService] type is required');
  if (!targetLang) throw new Error('[examExerciseService] targetLang is required');

  const seenSet = new Set(seenExerciseIds ?? []);

  // Fetch ready exercises matching type, level, target language
  const allExercises = await _fetchReadyExercises(token, { type, level, targetLang });

  // Walk unseen exercises in order
  for (const exercise of allExercises) {
    if (seenSet.has(exercise.id)) continue;

    // Fetch language-specific content
    const content = await _fetchExerciseContent(
      exercise.id,
      targetLang,
      token
    );

    if (content) {
      return {
        exerciseId: exercise.id,
        type: exercise.type,
        level: exercise.level,
        questionType: exercise.questionType,
        source: 'db',
        content,
      };
    }
  }

  // Pool exhausted — generate a new exercise
  const generated = await _generateNewExercise(
    { type, level, targetLang, userDialect },
    token
  );

  const exerciseId = await _writeNewExercise(generated, targetLang, token);

  return {
    exerciseId,
    type: generated.type,
    level: generated.level,
    questionType: generated.questionType,
    source: 'ai',
    content: generated.content,
  };
}

/**
 * Get the total number of "ready" exercises in the pool for a given type/level/language.
 * Used for progress UI.
 *
 * @param {string} token
 * @param {string} type - 'writing' | 'reading' | 'listening'
 * @param {string} level
 * @param {string} targetLang
 * @returns {Promise<number>}
 */
export async function getExercisePoolCount(token, type, level, targetLang) {
  const exercises = await _fetchReadyExercises(token, { type, level, targetLang });
  return exercises.length;
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

async function _fetchReadyExercises(token, { type, level, targetLang }) {
  const params = new URLSearchParams({
    collection: 'examExercises',
    filters: JSON.stringify([
      { field: 'status', op: '==', value: 'ready' },
      { field: 'type', op: '==', value: type },
      { field: 'level', op: '==', value: level },
      { field: 'targetLang', op: '==', value: targetLang },
    ]),
    limit: String(POOL_LIMIT),
  });
  const response = await fetch(
    `${PROXY_URL}/api/firestore?${params}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to fetch exercises');
  return json?.data?.documents ?? [];
}

async function _fetchExerciseContent(exerciseId, locale, token) {
  const col = `examExercises/${exerciseId}/content`;
  const response = await fetch(
    `${PROXY_URL}/api/firestore?collection=${encodeURIComponent(col)}&id=${encodeURIComponent(locale)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (response.status === 404) return null;
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to fetch exercise content');
  const data = json?.data?.data ?? null;
  if (!data) return null;
  // Extract the appropriate content based on type
  const type = data.type;
  if (type === 'writing') return data.writing;
  if (type === 'reading') {
    // Include questionType in the reading content
    return {
      ...data.reading,
      questionType: data.questionType || data.reading.questionType,
    };
  }
  if (type === 'listening') return data.listening;
  return null;
}

async function _writeNewExercise(generated, targetLang, token) {
  const now = new Date().toISOString();

  // Write root document
  const exerciseData = {
    type: generated.type,
    level: generated.level,
    targetLang: generated.targetLang,
    status: 'ready',
    aiGenerated: true,
    verified: false,
    qualityScore: null,
    createdAt: now,
    updatedAt: now,
  };

  // Add questionType for reading exercises
  if (generated.type === 'reading' && generated.questionType) {
    exerciseData.questionType = generated.questionType;
  }

  const exerciseResponse = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: 'examExercises',
      data: exerciseData,
    }),
  });
  const exerciseJson = await exerciseResponse.json();
  if (!exerciseResponse.ok) {
    throw new Error(exerciseJson?.error || exerciseJson?.message || 'Failed to create exercise');
  }

  const exerciseId = exerciseJson?.data?.id;
  if (!exerciseId) throw new Error('[examExerciseService] Exercise write did not return an ID');

  // Write content document
  await _writeExerciseContent(exerciseId, targetLang, generated, token);

  return exerciseId;
}

async function _writeExerciseContent(exerciseId, locale, generated, token) {
  const col = `examExercises/${exerciseId}/content`;
  const now = new Date().toISOString();

  const [language, region] = locale.split('-');

  const contentData = {
    locale,
    language,
    region: region || null,
    type: generated.type,
    source: 'ai',
    verified: false,
    qualityScore: null,
    createdAt: now,
    updatedAt: now,
  };

  // Add type-specific content
  if (generated.type === 'writing') {
    contentData.writing = generated.content;
  } else if (generated.type === 'reading') {
    contentData.reading = generated.content;
    // Also store questionType at the content document level for easier querying
    if (generated.questionType) {
      contentData.questionType = generated.questionType;
    }
  } else if (generated.type === 'listening') {
    contentData.listening = generated.content;
  }

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: col,
      id: locale,
      data: contentData,
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to write exercise content');
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

/**
 * Route to the appropriate type-specific service for exercise generation.
 */
async function _generateNewExercise({ type, level, targetLang }, token) {
  if (type === 'writing') {
    const content = await generateWritingExercise({ token, level, targetLang });
    return {
      type: 'writing',
      level,
      targetLang,
      content,
    };
  }

  if (type === 'reading') {
    const content = await generateReadingExercise({ token, level, targetLang });
    return {
      type: 'reading',
      level,
      targetLang,
      questionType: content.questionType,
      content,
    };
  }

  if (type === 'listening') {
    const content = await generateListeningExercise({ token, level, targetLang });
    return {
      type: 'listening',
      level,
      targetLang,
      content,
    };
  }

  throw new Error(`[examExerciseService] Unknown exercise type: ${type}`);
}