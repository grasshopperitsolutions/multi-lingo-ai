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

// ---------------------------------------------------------------------------
// CEFR level labels
// ---------------------------------------------------------------------------

/**
 * The six CEFR levels, in order. The single source for every level picker in
 * the app — the exam sidebar and the story generator each used to keep their
 * own array, and the sidebar's was hardcoded Portuguese ("C1 - Avançado") that
 * showed through whatever interface language the user had chosen.
 */
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * English fallbacks, used as t()'s default value so a locale that hasn't been
 * back-filled yet still reads as a level name rather than a raw key.
 */
const CEFR_LEVEL_FALLBACKS = {
  A1: 'A1 - Beginner',
  A2: 'A2 - Elementary',
  B1: 'B1 - Intermediate',
  B2: 'B2 - Upper Intermediate',
  C1: 'C1 - Advanced',
  C2: 'C2 - Proficient',
};

/**
 * Localised `{ value, label }` options for a NeoDropdown.
 *
 * Takes `t` rather than calling useTranslation itself so it stays a plain
 * function; call it during render (or from a useMemo keyed on i18n.language)
 * so the labels follow an interface-language change.
 *
 * @param {(key: string, fallback: string) => string} t
 * @returns {{value: string, label: string}[]}
 */
export function getCefrLevelOptions(t) {
  return CEFR_LEVELS.map((level) => ({
    value: level,
    label: t(`exam.levels.${level.toLowerCase()}`, CEFR_LEVEL_FALLBACKS[level]),
  }));
}
