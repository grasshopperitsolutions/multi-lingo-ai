/**
 * dates.js
 *
 * There is no date library in this project — everything is hand-rolled `Date`
 * — so the few pieces of date arithmetic that more than one screen needs live
 * here rather than being written again each time.
 */

/**
 * Whole days from today to `date`, or null if there is no usable date.
 *
 * Local midnight on both sides: `${date}T00:00:00` with no `Z` parses as local,
 * and `setHours(0,0,0,0)` normalises today the same way. `Math.round` rather
 * than `Math.floor` so a DST shift inside the range cannot produce an
 * off-by-one.
 *
 * Negative means the date has passed — callers decide how to say that; do not
 * clamp here, because "3 days ago" and "in 3 days" are different sentences.
 *
 * @param {string} date - `YYYY-MM-DD`, as an `<input type="date">` produces.
 * @returns {number|null}
 */
export function daysUntil(date) {
  if (!date) return null;
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}
