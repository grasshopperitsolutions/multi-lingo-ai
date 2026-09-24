/**
 * grammarDuplicates.js
 *
 * Keeps near-identical items out of Grammar Practice, within one exercise and
 * across the pool.
 *
 * Each item is reduced to a fingerprint — its normalised prompt and cue plus
 * its normalised first answer — and fingerprints are compared with the
 * Sørensen–Dice coefficient over character trigrams. Including the answer is
 * what tells "same sentence, different tense" (a new exercise) from a real
 * repeat. Trigrams cope with inflection better than word overlap, because
 * shared stems share trigrams, and with short sentences better than edit
 * distance.
 *
 * Measured on sample pairs: names swapped 0.82, one word changed with the same
 * answer 0.79, the same sentence reused 0.84 (all dropped at 0.75); gender
 * swapped 0.69, same frame in another tense 0.60 (kept).
 */

import { normalizeAnswer } from "./grammarAnswerCheck";

export const DUPLICATE_THRESHOLD = 0.75;

/**
 * The text a learner reads for an item, whatever the type calls it.
 * @param {object} item
 */
function itemText(item) {
  if (item?.prompt) return item.prompt;
  if (item?.source) return item.source;
  if (Array.isArray(item?.parts)) return item.parts.join(" ");
  if (Array.isArray(item?.fragments)) return item.fragments.join(" ");
  return "";
}

/**
 * @param {object} item
 * @returns {string}
 */
export function fingerprint(item) {
  // The cue (the verb to conjugate, say) is part of what an item tests.
  const text = normalizeAnswer([itemText(item), item?.cue].filter(Boolean).join(" "))
    .replace(/_{2,}/g, " _ ")
    .replace(/\[\[|\]\]/g, "")
    .replace(/[.,;:!?()"«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const answer = normalizeAnswer(item?.answers?.[0] ?? item?.sampleAnswers?.[0] ?? "");
  return answer ? `${text} | ${answer}` : text;
}

function trigrams(value) {
  const padded = `  ${value} `;
  const counts = new Map();
  for (let i = 0; i < padded.length - 2; i += 1) {
    const gram = padded.slice(i, i + 3);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return counts;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1
 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = trigrams(a);
  const B = trigrams(b);
  let shared = 0;
  let total = 0;
  for (const [gram, count] of A) {
    shared += Math.min(count, B.get(gram) ?? 0);
    total += count;
  }
  for (const count of B.values()) total += count;
  return total === 0 ? 0 : (2 * shared) / total;
}

/**
 * Drop items that duplicate an earlier item in the same list or anything in
 * `existing`.
 *
 * @param {object[]} items
 * @param {string[]} [existing] - fingerprints already in the pool cell
 * @param {number} [threshold]
 * @returns {{ kept: object[], dropped: object[] }}
 */
export function dropDuplicates(items, existing = [], threshold = DUPLICATE_THRESHOLD) {
  const seen = [...existing];
  const kept = [];
  const dropped = [];
  for (const item of items ?? []) {
    const print = fingerprint(item);
    if (seen.some((other) => similarity(print, other) >= threshold)) {
      dropped.push(item);
    } else {
      kept.push(item);
      seen.push(print);
    }
  }
  return { kept, dropped };
}
