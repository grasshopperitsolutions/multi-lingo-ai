/**
 * examLevels.js
 *
 * Canonical per-level specification for exam writing tasks.
 *
 * These numbers used to live in two places that disagreed: WORD_COUNT_BOUNDS in
 * examWritingExerciseService.js (A1 60-100, B1 100-150) and EXAM_STRUCTURE in
 * FullExamExercise.jsx (A1 40-60, B1 100-120). The UI showed the student one
 * target and the evaluator penalised them against the other. This module is now
 * the single source both read from.
 *
 * `maxScore` is the weight the writing section carries inside a Full Exam at
 * that level. It is deliberately NOT the scale the AI marks on — the rubric has
 * five parameters worth five points each, so evaluation always returns a score
 * out of 25 and the Full Exam scales that result into the weight below.
 */

export const WRITING_SPEC = {
  A1: { minWords: 40,  maxWords: 60,  maxScore: 10 },
  A2: { minWords: 60,  maxWords: 80,  maxScore: 15 },
  B1: { minWords: 100, maxWords: 120, maxScore: 20 },
  B2: { minWords: 130, maxWords: 160, maxScore: 25 },
  C1: { minWords: 180, maxWords: 220, maxScore: 30 },
  C2: { minWords: 200, maxWords: 250, maxScore: 30 },
};

export const DEFAULT_WRITING_SPEC = WRITING_SPEC.A1;

/**
 * The scale the writing rubric itself is marked on: five parameters, five
 * points each. Independent of the per-level exam weight above.
 */
export const RUBRIC_MAX_SCORE = 25;

/**
 * @param {string} level - CEFR level, e.g. 'B1'
 * @returns {{minWords: number, maxWords: number, maxScore: number}}
 */
export function getWritingSpec(level) {
  return WRITING_SPEC[level] ?? DEFAULT_WRITING_SPEC;
}
