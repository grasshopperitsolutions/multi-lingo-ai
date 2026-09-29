/**
 * aiUsage.js
 *
 * How many AI calls a user has made today, as the server counts them.
 *
 * The profile carries `aiCallsToday` and `aiCallsDate`, and the server only
 * resets the count on the first counted call of a new day. Reading
 * `aiCallsToday` on its own therefore shows yesterday's number until then —
 * and since pages check the allowance *before* calling, an Explorer who used
 * every call yesterday would be told "limit reached" all of today, never
 * making the call that would have reset it.
 */

/** Today's date as the server stamps it: UTC, YYYY-MM-DD. */
export function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {{ aiCallsToday?: number, aiCallsDate?: string|null }|null|undefined} user
 * @param {string} [today] - the UTC day to count, as `YYYY-MM-DD`. Defaults to
 *   now. Pulse passes the day it is reporting on, so every figure on one screen
 *   is counted against the same date rather than half of them against the clock.
 * @returns {number} calls counted today; 0 when the count is from another day
 */
export function callsTodayFor(user, today = todayUTC()) {
  if (!user || user.aiCallsDate !== today) return 0;
  return user.aiCallsToday ?? 0;
}
