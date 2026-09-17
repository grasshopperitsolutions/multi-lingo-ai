/**
 * reminders.js
 *
 * The reminder catalogue, mirroring `lib/reminders.ts` in the API repo.
 *
 * Two copies in two repos, like `EMAIL_COPY_BASE` and the locale file: the
 * backend decides what to send and the frontend decides what to offer, and
 * neither can import the other. The ids and the default values must match — a
 * drift shows up as a switch that appears to do nothing.
 */

/** Matches DEFAULT_REMINDER_PREFS in the API's lib/reminders.ts. */
export const DEFAULT_REMINDER_PREFS = {
  hour: 19,
  weekday: 0,
  streakRescue: true,
  practiceNudge: true,
  lessonsLow: true,
  weeklyReview: true,
};

/**
 * Order here is the order in Settings, which is deliberately *not* the
 * backend's priority order: the list reads best from the gentlest nudge to the
 * most specific, while the sender ranks by which message is most worth an
 * interruption.
 */
export const REMINDER_TOGGLES = [
  { id: "streakRescue", titleKey: "notifications.reminder_streak", descKey: "notifications.reminder_streak_desc" },
  { id: "practiceNudge", titleKey: "notifications.reminder_nudge", descKey: "notifications.reminder_nudge_desc" },
  { id: "lessonsLow", titleKey: "notifications.reminder_lessons", descKey: "notifications.reminder_lessons_desc" },
  { id: "weeklyReview", titleKey: "notifications.reminder_weekly", descKey: "notifications.reminder_weekly_desc" },
];

/** 0 = Sunday, matching JS `getDay()` and the backend's `weekday`. */
export const WEEKDAY_KEYS = [
  "common.weekday_sunday",
  "common.weekday_monday",
  "common.weekday_tuesday",
  "common.weekday_wednesday",
  "common.weekday_thursday",
  "common.weekday_friday",
  "common.weekday_saturday",
];

/** Merges a stored object over the defaults. Mirrors normalizeReminderPrefs. */
export function normalizeReminderPrefs(stored) {
  const result = { ...DEFAULT_REMINDER_PREFS };
  if (!stored || typeof stored !== "object") return result;

  if (Number.isInteger(stored.hour) && stored.hour >= 0 && stored.hour <= 23) {
    result.hour = stored.hour;
  }
  if (Number.isInteger(stored.weekday) && stored.weekday >= 0 && stored.weekday <= 6) {
    result.weekday = stored.weekday;
  }
  for (const { id } of REMINDER_TOGGLES) {
    if (typeof stored[id] === "boolean") result[id] = stored[id];
  }
  return result;
}
