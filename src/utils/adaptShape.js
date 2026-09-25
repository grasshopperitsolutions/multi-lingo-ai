/**
 * adaptShape.js
 *
 * Checks an exam exercise the model has adapted to another dialect against
 * the original, and rebuilds it in the original's exact shape.
 *
 * An adaptation may change wording and nothing else. So:
 *   - every key of the original is kept (anything extra the model adds is dropped);
 *   - every list keeps its length and order;
 *   - ids, booleans and numbers are unchanged — a true/false answer, a gap's
 *     position and a word count carry meaning, and the meaning must survive;
 *   - a string that had text still has text, and one that was empty (an
 *     audio URL not made yet, say) stays empty;
 *   - every correctAnswer still matches one of its options, and every blank's
 *     answer is still in the word bank.
 *
 * Anything else means the model rewrote the exercise rather than adapting
 * it, and the caller falls back to writing a new one.
 */

import { normalizeAnswer } from "./grammarAnswerCheck";

const INVALID = Symbol("invalid");

function rebuild(original, adapted, key) {
  if (Array.isArray(original)) {
    if (!Array.isArray(adapted) || adapted.length !== original.length) return INVALID;
    const out = [];
    for (let i = 0; i < original.length; i += 1) {
      const value = rebuild(original[i], adapted[i]);
      if (value === INVALID) return INVALID;
      out.push(value);
    }
    return out;
  }
  if (original && typeof original === "object") {
    if (!adapted || typeof adapted !== "object" || Array.isArray(adapted)) return INVALID;
    const out = {};
    for (const field of Object.keys(original)) {
      const value = rebuild(original[field], adapted[field], field);
      if (value === INVALID) return INVALID;
      out[field] = value;
    }
    return out;
  }
  if (typeof original === "string") {
    if (key === "id") return adapted === original ? original : INVALID;
    if (!original.trim()) return original;
    return typeof adapted === "string" && adapted.trim() ? adapted : INVALID;
  }
  // Booleans, numbers and nulls carry meaning: they must come back unchanged.
  return adapted === original ? original : INVALID;
}

function answersStillMatch(node) {
  if (Array.isArray(node)) return node.every(answersStillMatch);
  if (!node || typeof node !== "object") return true;

  if (Array.isArray(node.options) && typeof node.correctAnswer === "string") {
    const options = node.options.map(normalizeAnswer);
    if (!options.includes(normalizeAnswer(node.correctAnswer))) return false;
  }
  if (Array.isArray(node.wordBank) && Array.isArray(node.blanks)) {
    const bank = node.wordBank.map(normalizeAnswer);
    const ok = node.blanks.every(
      (blank) => typeof blank?.correctAnswer !== "string" || bank.includes(normalizeAnswer(blank.correctAnswer))
    );
    if (!ok) return false;
  }
  return Object.values(node).every(answersStillMatch);
}

/**
 * @param {object} original - the exercise content in its source dialect
 * @param {object} adapted - the model's version for the target dialect
 * @returns {object|null} the adapted content in the original's shape, or null
 */
export function rebuildAdaptation(original, adapted) {
  const rebuilt = rebuild(original, adapted);
  if (rebuilt === INVALID) return null;
  return answersStillMatch(rebuilt) ? rebuilt : null;
}
