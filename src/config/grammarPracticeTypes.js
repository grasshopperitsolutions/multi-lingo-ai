/**
 * grammarPracticeTypes.js
 *
 * The exercise types Grammar Practice can generate. Each `key` is a variant key
 * of the `grammar-practice-prompt` document and a value of `type` on
 * grammarExercises documents, so keys can be added and retired but never
 * renamed — a rename orphans every exercise already in the pool.
 *
 * Families group types by how the answer is marked, which is also what decides
 * who gets them:
 *   A choose  — exact match against options
 *   B form    — a typed word or phrase, marked in code
 *   C/D/E     — a typed sentence that may need an AI marking call. These are
 *               `openAnswer` and sit behind the `grammar_practice_open`
 *               feature key (Maestro and up), because that call comes out of
 *               the learner's daily AI allowance.
 */

export const GRAMMAR_PRACTICE_FEATURE = "grammar_practice";
export const GRAMMAR_PRACTICE_OPEN_FEATURE = "grammar_practice_open";

export const PRACTICE_TYPES = [
  { key: "choose-option", family: "A", openAnswer: false },
  { key: "multi-select", family: "A", openAnswer: false },
  { key: "judge-correct", family: "A", openAnswer: false },
  { key: "classify", family: "A", openAnswer: false },
  { key: "word-order", family: "A", openAnswer: false },
  { key: "conjugate", family: "B", openAnswer: false },
  { key: "conjugate-contrast", family: "B", openAnswer: false },
  { key: "gap-by-cue", family: "B", openAnswer: false },
  { key: "inflect", family: "B", openAnswer: false },
  { key: "fill-from-bank", family: "B", openAnswer: false },
  { key: "transform", family: "C", openAnswer: true },
  { key: "build-sentence", family: "C", openAnswer: true },
  { key: "translate", family: "D", openAnswer: true },
  { key: "open-completion", family: "E", openAnswer: true },
];

/**
 * Types whose renderer is built. The open-answer types have prompts seeded
 * but no screen yet, so they are listed but not offered until this includes
 * them.
 */
export const RENDERABLE_TYPES = new Set([
  "choose-option",
  "multi-select",
  "judge-correct",
  "classify",
  "word-order",
  "conjugate",
  "conjugate-contrast",
  "gap-by-cue",
  "inflect",
  "fill-from-bank",
]);

/** Items to ask for per exercise. */
export const DEFAULT_ITEM_COUNT = 8;

const BY_KEY = new Map(PRACTICE_TYPES.map((type) => [type.key, type]));

/** @param {string} key */
export function getPracticeType(key) {
  return BY_KEY.get(key);
}

/** @param {string} key */
export function isOpenAnswerType(key) {
  return Boolean(BY_KEY.get(key)?.openAnswer);
}

/**
 * Types a learner may be served.
 *
 * @param {{ canOpenAnswer: boolean }} access
 * @returns {string[]}
 */
export function availablePracticeTypes({ canOpenAnswer }) {
  return PRACTICE_TYPES
    .filter((type) => RENDERABLE_TYPES.has(type.key))
    .filter((type) => canOpenAnswer || !type.openAnswer)
    .map((type) => type.key);
}
