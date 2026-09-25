/**
 * examExerciseService.js
 *
 * Exam Training exercises, served from a shared pool and generated only when
 * the learner has seen everything that matches. Routes generation to the
 * type-specific services:
 *   - examWritingExerciseService: generateWritingExercise + evaluateWriting
 *   - examListeningExerciseService: generateListeningExercise
 *   - examReadingExerciseService: generateReadingExercise
 *
 * Same data model as Grammar Practice (see plans/multi-dialect-practice.md):
 * one exercise per document at *language* level, its content per *dialect*
 * underneath, so a pt-PT exercise can later be adapted for pt-BR instead of
 * written again. Exams have no gloss layer: an exam is read entirely in the
 * practised dialect, like a real one.
 *
 * Firestore schema:
 *
 *   examExercises/{exerciseId}
 *     language: "pt"                        base language (query key)
 *     originDialect: "pt-PT"
 *     dialects: ["pt-PT"]                   dialects that have content (filtered in code)
 *     portability: "unknown"                decided when adapting exists
 *     type: "writing" | "reading" | "listening"
 *     questionType: string                  reading/listening subtype
 *     level: "A1" … "C2"
 *     fingerprint: string                   for the duplicate check
 *     status: "ready" | "draft" | "blocked"
 *     source: "ai", verified: false, qualityScore: null, createdAt, updatedAt
 *
 *   examExercises/{exerciseId}/content/{dialect}
 *     dialect, adaptedFrom: null | "<dialect>", type, questionType,
 *     writing | reading | listening: the exercise itself, createdAt
 *
 * When the learner's dialect has nothing unseen, an exercise from a sibling
 * dialect is adapted with exam-adapt-prompt before a new one is written, so
 * the dialects of a language share one pool.
 *
 * The pool is safe to read before it exists: an empty query is "nothing yet",
 * a missing document is null, and queries use equality filters only, so they
 * never need a composite index.
 *
 * @module examExerciseService
 */

import { generateWritingExercise } from './examWritingExerciseService';
import { generateListeningExercise } from './examListeningExerciseService';
import { generateReadingExercise } from './examReadingExerciseService';
import { queryCollection, createDocument } from './firestoreService';
import {
  baseLanguage,
  getDataOrNull,
  newPoolId,
  shuffle,
  adaptCandidates,
  sourceDialectOf,
  recordAdaptation,
  markDialectSpecific,
} from './practicePool';
import { askAI, isAiDeclined } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { parseAIJSON } from '../utils/parseAIJSON';
import { rebuildAdaptation } from '../utils/adaptShape';
import { normalizeAnswer } from '../utils/grammarAnswerCheck';
import { similarity, DUPLICATE_THRESHOLD } from '../utils/grammarDuplicates';

/**
 * @typedef {Object} GetExerciseParams
 * @property {string}   token            - Firebase ID token
 * @property {string}   level            - CEFR level
 * @property {string}   type             - 'writing' | 'reading' | 'listening'
 * @property {string}   [questionType]   - reading/listening subtype; omit for any
 * @property {string}   targetLang       - the learner's dialect, e.g. 'pt-PT'
 * @property {string}   [userDialect]    - the learner's interface language (unused: exams are monolingual)
 * @property {string[]} seenExerciseIds  - already-seen exercise ids for this type
 */

/**
 * @typedef {Object} ExerciseResult
 * @property {string|null} exerciseId   - null when the exercise could not be stored
 * @property {string}      type
 * @property {string}      level
 * @property {string}      [questionType]
 * @property {'db'|'adapted'|'ai'} source
 * @property {Object}      content      - writing/reading/listening content
 */

export const EXAM_COLLECTION = 'examExercises';
export const EXAM_ADAPT_PROMPT_ID = 'exam-adapt-prompt';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const POOL_LIMIT = 100;
/** How much of the opening text a fingerprint keeps. Enough to tell two passages apart. */
const FINGERPRINT_CHARS = 400;

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
  questionType,
  targetLang,
  seenExerciseIds,
}) {
  if (!token) throw new Error('[examExerciseService] token is required');
  if (!level) throw new Error('[examExerciseService] level is required');
  if (!type) throw new Error('[examExerciseService] type is required');
  if (!targetLang) throw new Error('[examExerciseService] targetLang is required');

  const dialect = targetLang;
  const cellDocs = await _fetchReadyExercises(token, { type, level, dialect, questionType });

  const seen = new Set(seenExerciseIds ?? []);
  const candidates = shuffle(
    cellDocs.filter((doc) => !seen.has(doc.id) && (doc.dialects ?? []).includes(dialect))
  );

  for (const doc of candidates) {
    const content = _extractContent(
      await getDataOrNull(`${EXAM_COLLECTION}/${doc.id}/content`, dialect, token)
    );
    if (!content) continue;
    return {
      exerciseId: doc.id,
      type: doc.type,
      level: doc.level,
      questionType: doc.questionType,
      source: 'db',
      content,
    };
  }

  // Nothing for this dialect: adapt one from a sibling dialect first. One
  // attempt per request; a refusal is recorded and it falls through.
  const [candidate] = adaptCandidates(cellDocs, dialect, seen);
  if (candidate) {
    const content = await _adaptExercise({ token, doc: candidate, dialect });
    if (content) {
      return {
        exerciseId: candidate.id,
        type: candidate.type,
        level: candidate.level,
        questionType: candidate.questionType,
        source: 'adapted',
        content,
      };
    }
  }

  // Pool exhausted — generate a new exercise.
  const generated = await _generateNewExercise({ token, type, level, questionType, targetLang: dialect });
  const print = examFingerprint(generated.content);

  // Too close to something already in this cell: still served, because the
  // learner has paid for it, but kept out of the pool rather than spending a
  // second call on a retry.
  const isDuplicate = cellDocs.some(
    (doc) => doc.fingerprint && similarity(doc.fingerprint, print) >= DUPLICATE_THRESHOLD
  );
  const exerciseId = isDuplicate
    ? null
    : await _writeNewExercise({ generated, dialect, fingerprint: print, token });

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
 * Number of "ready" exercises for a type/level/dialect. Used for progress UI.
 *
 * @param {string} token
 * @param {string} type
 * @param {string} level
 * @param {string} targetLang - the learner's dialect
 * @returns {Promise<number>}
 */
export async function getExercisePoolCount(token, type, level, targetLang) {
  const docs = await _fetchReadyExercises(token, { type, level, dialect: targetLang });
  return docs.filter((doc) => (doc.dialects ?? []).includes(targetLang)).length;
}

/**
 * The text a duplicate check compares: the normalised opening of whatever
 * the exercise is built on — the reading passage, the listening transcript
 * or the writing prompt. Exported for tests.
 *
 * @param {object} content
 * @returns {string}
 */
export function examFingerprint(content) {
  const source =
    content?.passage ||
    content?.text ||
    content?.transcript ||
    content?.prompt ||
    (content?.questions ?? []).map((q) => q?.text ?? q?.question ?? '').join(' ');
  return normalizeAnswer(String(source ?? '').slice(0, FINGERPRINT_CHARS))
    .replace(/[.,;:!?()"«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/** Equality filters only — never needs a composite index. Empty or missing is []. */
async function _fetchReadyExercises(token, { type, level, dialect, questionType }) {
  const filters = { language: baseLanguage(dialect), level, type, status: 'ready' };
  if (questionType) filters.questionType = questionType;
  const result = await queryCollection(EXAM_COLLECTION, filters, { limit: POOL_LIMIT }, token);
  return result?.documents ?? [];
}

/** Pull the type's content out of a content document, or null if it has none. */
function _extractContent(data) {
  if (!data) return null;
  if (data.type === 'writing') return data.writing ?? null;
  if (data.type === 'reading') {
    if (!data.reading) return null;
    return { ...data.reading, questionType: data.questionType || data.reading.questionType };
  }
  if (data.type === 'listening') return data.listening ?? null;
  return null;
}

/**
 * Content first, root last, so a failed write leaves an orphan nobody can see
 * rather than a root pointing at nothing. Best effort: the learner already
 * has the exercise, so a failure here is logged, not thrown.
 *
 * @returns {Promise<string|null>} the new id, or null if it was not stored
 */
async function _writeNewExercise({ generated, dialect, fingerprint, token }) {
  const id = newPoolId();
  const now = new Date().toISOString();
  const questionType = generated.questionType ?? null;

  try {
    await createDocument(
      `${EXAM_COLLECTION}/${id}/content`,
      {
        dialect,
        adaptedFrom: null,
        type: generated.type,
        questionType,
        [generated.type]: generated.content,
        source: 'ai',
        createdAt: now,
      },
      dialect,
      token
    );
    await createDocument(
      EXAM_COLLECTION,
      {
        language: baseLanguage(dialect),
        originDialect: dialect,
        dialects: [dialect],
        portability: 'unknown',
        type: generated.type,
        questionType,
        level: generated.level,
        fingerprint,
        status: 'ready',
        source: 'ai',
        verified: false,
        qualityScore: null,
        createdAt: now,
        updatedAt: now,
      },
      id,
      token
    );
    return id;
  } catch (err) {
    console.warn('[examExerciseService] could not store exercise', err);
    return null;
  }
}

/**
 * Port a pooled exercise to the learner's dialect. The model may change
 * wording only: rebuildAdaptation keeps the original's keys, ids, list
 * lengths, booleans and numbers, and checks every answer still matches its
 * options. Anything else returns null and the caller writes a new exercise.
 *
 * @returns {Promise<object|null>} display-ready content, or null
 */
async function _adaptExercise({ token, doc, dialect }) {
  const sourceDialect = sourceDialectOf(doc);
  if (!sourceDialect) return null;
  const data = await getDataOrNull(`${EXAM_COLLECTION}/${doc.id}/content`, sourceDialect, token);
  const original = data?.[data?.type];
  if (!original) return null;

  let parsed;
  try {
    const promptDoc = await getPrompt(EXAM_ADAPT_PROMPT_ID);
    const prompt = renderTemplate(promptDoc.template, {
      sourceDialect,
      targetDialect: dialect,
      type: data.type,
      exerciseJson: JSON.stringify(original),
    });
    const response = await askAI(token, prompt, {
      provider: 'gemini',
      model: promptDoc.model || GEMINI_MODEL,
      explorerModel: promptDoc.explorerModel,
      temperature: 0.3,
      jsonMode: true,
      ...(promptDoc.maxTokens ? { maxOutputTokens: promptDoc.maxTokens } : {}),
    });
    parsed = parseAIJSON(response?.text ?? '');
  } catch (err) {
    // Declining the call is the learner's answer, not a failure to route around.
    if (isAiDeclined(err)) throw err;
    console.warn('[examExerciseService] adaptation failed', err);
    return null;
  }

  if (parsed?.portable === false) {
    await markDialectSpecific({ token, collection: EXAM_COLLECTION, doc });
    return null;
  }

  const adapted = rebuildAdaptation(original, parsed?.exercise);
  if (!adapted) {
    console.info('[examExerciseService] adaptation did not keep the exercise shape', doc.id);
    return null;
  }

  const contentDoc = {
    dialect,
    adaptedFrom: sourceDialect,
    type: data.type,
    questionType: data.questionType ?? null,
    [data.type]: adapted,
    source: 'ai',
    createdAt: new Date().toISOString(),
  };
  try {
    await createDocument(`${EXAM_COLLECTION}/${doc.id}/content`, contentDoc, dialect, token);
    await recordAdaptation({ token, collection: EXAM_COLLECTION, doc, dialect });
  } catch (err) {
    // Served anyway: the learner has paid for it. Adapted again next time.
    console.warn('[examExerciseService] could not store adaptation', err);
  }
  return _extractContent(contentDoc);
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

/** Route to the type-specific generator. */
async function _generateNewExercise({ token, type, level, questionType, targetLang }) {
  if (type === 'writing') {
    const content = await generateWritingExercise({ token, level, targetLang });
    return { type: 'writing', level, targetLang, content };
  }
  if (type === 'reading') {
    const content = await generateReadingExercise({ token, level, targetLang, questionType });
    return { type: 'reading', level, targetLang, questionType: content.questionType, content };
  }
  if (type === 'listening') {
    const content = await generateListeningExercise({ token, level, targetLang, questionType });
    // exerciseType is hoisted to the root so the pool can be filtered by it.
    return { type: 'listening', level, targetLang, questionType: content.exerciseType, content };
  }
  throw new Error(`[examExerciseService] Unknown exercise type: ${type}`);
}
