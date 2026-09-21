/**
 * wordBudget.js
 *
 * How long a puzzle may spend collecting words before it builds with what it
 * has.
 *
 * Word Search asks for twelve words and the crossword for nine, one request at
 * a time. When the shared pool has unseen words that is fast — a query and a
 * translation fetch each. When it does not, every one of them is an AI
 * generation of roughly two seconds, and the player sits in front of a spinner
 * for the sum of them. Nothing was watching that total.
 *
 * Two rules, and the order matters:
 *
 *   1. **A floor, which the clock cannot undercut.** A puzzle built from two
 *      words is not a puzzle. `MIN_WORDS` is fetched however long it takes.
 *   2. **A budget, once the floor is met.** Past `MIN_WORDS` the clock decides,
 *      and the remaining words are a bonus rather than a wait.
 *
 * The budget is deliberately larger than the floor costs: at ~2s a generation,
 * five words is already ~10s, so a smaller number would do nothing but make
 * the constant a lie. What it actually cuts is the tail — twelve generations is
 * about twenty-five seconds, and this ends it at roughly half that.
 *
 * Checked *before* each request, never during one: a request in flight cannot
 * be taken back, so the real elapsed time can overshoot by one. That is the
 * honest cost of not cancelling, and cancelling would waste the AI call that
 * was already paid for.
 */

/** Below this a puzzle is not worth building, whatever the clock says. */
export const MIN_WORDS = 5;

/** How long the collecting loop may run once the floor above is met. */
export const WORD_BUDGET_MS = 12_000;

/** The moment the budget runs out, from now. */
export function startWordBudget(now = Date.now()) {
  return now + WORD_BUDGET_MS;
}

/**
 * Should the loop ask for another word?
 *
 * @param {number} deadline    - from startWordBudget()
 * @param {number} wordsSoFar  - how many usable words are already in hand
 * @param {number} [now]       - injectable for tests
 * @returns {boolean}
 */
export function shouldKeepFetching(deadline, wordsSoFar, now = Date.now()) {
  if (wordsSoFar < MIN_WORDS) return true;
  return now < deadline;
}
