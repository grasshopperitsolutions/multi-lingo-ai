/**
 * practiceDays.js
 *
 * Practice days: the days somebody opened the app signed in. It replaced the
 * day streak, which reset to zero the first day you missed — the opposite of
 * what the product says about itself. Nothing here ever resets: a missed day is
 * simply a day that is not in the list.
 *
 * Everything is pure, so the calendar maths (a week that straddles two months,
 * a trimmed history, a seeded total) is testable without a clock or a profile.
 *
 * ## What is stored, on `users/{uid}`
 *
 * - `practiceDates`: `["2026-10-01", …]`, the last {@link HISTORY_DAYS} days.
 *   Feeds the calendar, "this week" and "this month".
 * - `practiceMonths`: `{ "2026-10": 5 }`, never trimmed (about 12 entries a
 *   year). Feeds "best month" and the total once old dates have rolled off.
 * - `practiceDaysSeed`: set once, from the old streak, so nobody starts at 0.
 * - `lastPracticeDate`: "practised today", and Pulse's last-seen.
 * - `weeklyTarget`: a mirror of the goal in `personalSettings/main`, because
 *   the API's reminder loop cannot afford a subcollection read per user.
 *
 * ## Dates are the reader's own
 *
 * `YYYY-MM-DD` of the **device's** day, not UTC. The old streak used UTC, so a
 * Lisbon evening and a Seattle evening landed on different days from the one
 * the person lived. Weeks are ISO weeks: Monday first.
 */

/** Practice days kept as individual dates. A year plus a month of slack. */
export const HISTORY_DAYS = 400;

export const DEFAULT_WEEKLY_TARGET = 3;
export const MAX_WEEKLY_TARGET = 7;

const pad = (n) => String(n).padStart(2, "0");

/** The device's own calendar day, `YYYY-MM-DD`. */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const parse = (date) => {
  const [y, m, d] = String(date).split("-").map(Number);
  // Noon, so a daylight-saving jump can never move the date.
  return new Date(y, m - 1, d, 12);
};

/** `date` moved by `days` calendar days. Works on strings, returns a string. */
export function shiftDate(date, days) {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return localToday(d);
}

/** The Monday of the ISO week `date` falls in. */
export function weekStart(date) {
  const day = parse(date).getDay(); // 0 = Sunday
  return shiftDate(date, -((day + 6) % 7));
}

export const monthKeyOf = (date) => String(date).slice(0, 7);

/** A stored target, or the default for anything absent, zero or junk. */
export function resolveWeeklyTarget(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_WEEKLY_TARGET;
  return Math.min(Math.floor(n), MAX_WEEKLY_TARGET);
}

const asDates = (dates) => (Array.isArray(dates) ? dates.filter((d) => typeof d === "string") : []);

/**
 * The seven days of `today`'s week, Monday first, for drawing a week strip.
 *
 * @returns {{date: string, practiced: boolean, isToday: boolean, isFuture: boolean}[]}
 */
export function isoWeekDays(dates, today) {
  const done = new Set(asDates(dates));
  const monday = weekStart(today);
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(monday, i);
    return {
      date,
      practiced: done.has(date),
      isToday: date === today,
      isFuture: date > today,
    };
  });
}

/** Practice days in `today`'s week. */
export function daysThisWeek(dates, today) {
  return isoWeekDays(dates, today).filter((d) => d.practiced).length;
}

/** Practice days in `today`'s calendar month, from the dates still held. */
export function daysThisMonth(dates, today) {
  const key = monthKeyOf(today);
  return asDates(dates).filter((d) => monthKeyOf(d) === key).length;
}

/**
 * The month with the most practice days, or null before there is one. Ties go
 * to the later month: the more recent record is the one still being beaten.
 */
export function bestMonth(months) {
  if (!months || typeof months !== "object") return null;
  let best = null;
  for (const [key, raw] of Object.entries(months)) {
    const count = Number(raw);
    if (!Number.isFinite(count) || count < 1) continue;
    if (!best || count > best.count || (count === best.count && key > best.key)) {
      best = { key, count };
    }
  }
  return best;
}

/** Every practice day ever: the carried-over history plus each month since. */
export function totalDays(user) {
  const seed = Number(user?.practiceDaysSeed);
  const months = Object.values(user?.practiceMonths ?? {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  return (Number.isFinite(seed) ? seed : 0) + months;
}

/**
 * What to write when `today` is not yet a practice day, or null when it
 * already is (opening the app twice is still one day).
 *
 * The first time a profile is seen with no `practiceMonths`, the old streak is
 * carried over as `practiceDaysSeed` (the larger of the best and the current
 * one), so nobody's history starts at zero.
 */
export function nextPracticeState(profile, today) {
  if (profile?.lastPracticeDate === today) return null;

  const held = asDates(profile?.practiceDates);
  if (held.includes(today)) return null;

  const cutoff = shiftDate(today, -(HISTORY_DAYS - 1));
  const practiceDates = [...held.filter((d) => d >= cutoff), today].sort();

  const months = { ...(profile?.practiceMonths ?? {}) };
  const key = monthKeyOf(today);
  months[key] = (Number(months[key]) || 0) + 1;

  const state = { practiceDates, practiceMonths: months, lastPracticeDate: today };

  if (!profile?.practiceMonths) {
    state.practiceDaysSeed = Math.max(
      Number(profile?.highestDayStreak) || 0,
      Number(profile?.dayStreak) || 0,
    );
  }
  return state;
}
