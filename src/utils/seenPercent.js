/**
 * How much of a shared pool someone has seen, as a whole percentage.
 *
 * Capped at 99, as the challenges have always shown it: every pool grows
 * whenever the AI writes something new, so "100%" would be a claim the next
 * generation makes false.
 *
 * @param {number} seenCount
 * @param {number|null|undefined} totalCount
 * @returns {number}
 */
export function seenPercent(seenCount, totalCount) {
  if (!totalCount) return 0;
  return Math.min(99, Math.round((seenCount / totalCount) * 100));
}
