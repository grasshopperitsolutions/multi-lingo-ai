/**
 * skippedConcepts.js
 *
 * Words somebody put down without answering, remembered in this browser only.
 *
 * **Skipping is not the same as seeing, and that difference is the point.** A
 * seen word is one you have finished with, and it is recorded on the profile so
 * the shared pool never offers it again on any device. A skipped word is one
 * you could not attempt *yet* — the commonest case being a script you cannot
 * read at all, which is how Japanese hangman feels at the start. Marking it
 * seen would quietly delete it from your pool forever, which is exactly the
 * wrong outcome for a word you will want when you are better.
 *
 * So it lives in `localStorage`: enough to stop the same unreadable word coming
 * back on the next press, and it evaporates on a new device, a cleared browser,
 * or a Reset. The word stays in the pool, waiting.
 *
 * Keyed per learning dialect, because the pool is: skipping a kanji compound
 * says nothing about a Portuguese word.
 *
 * Honoured inside `getWordService.getWord`, so every game that draws from the
 * shared pool respects a skip made in any other. Skipping a word in Hangman
 * because you cannot read it should not hand it straight back in Scrambled
 * Word.
 */

const KEY_PREFIX = "skippedConcepts:";

/**
 * Oldest entries fall off past this. It is a convenience list, not a record —
 * an unbounded one would grow forever in a place nothing ever prunes, and a
 * word skipped two hundred words ago is one worth being offered again.
 */
const MAX_SKIPPED = 200;

const keyFor = (dialect) => `${KEY_PREFIX}${dialect || "unknown"}`;

/**
 * @param {string} dialect - the learner's dialect, e.g. "ja-Hira"
 * @returns {string[]} concept ids, oldest first
 */
export function getSkippedConceptIds(dialect) {
  try {
    const raw = localStorage.getItem(keyFor(dialect));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    // Private windows, blocked site data, or something else's malformed value
    // under our key. An empty list means "nothing skipped", which is harmless.
    return [];
  }
}

/**
 * Remember a skip. Idempotent: skipping the same id twice does not move it.
 *
 * @param {string} conceptId
 * @param {string} dialect
 */
export function addSkippedConceptId(conceptId, dialect) {
  if (!conceptId) return;
  try {
    const current = getSkippedConceptIds(dialect);
    if (current.includes(conceptId)) return;
    const next = [...current, conceptId].slice(-MAX_SKIPPED);
    localStorage.setItem(keyFor(dialect), JSON.stringify(next));
  } catch {
    // Storage refused. The skip then lasts only as long as the request that
    // follows it, which is a smaller loss than failing the button press.
  }
}

/**
 * Forget every skip for a dialect. Called by the same control that resets seen
 * words, because "give me everything again" plainly means both.
 *
 * @param {string} dialect
 */
export function clearSkippedConceptIds(dialect) {
  try {
    localStorage.removeItem(keyFor(dialect));
  } catch {
    /* nothing to do, and nothing worth saying */
  }
}
