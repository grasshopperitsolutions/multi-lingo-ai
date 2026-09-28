/**
 * pulseMetrics.js
 *
 * The arithmetic behind Admin › Pulse, kept pure so every number can be pinned
 * with a fixture (plans/app-current-pulse.md, "Checks per phase").
 *
 * Days are UTC `YYYY-MM-DD` keys throughout, because that is how the server
 * stamps `lastStreakDate` and `aiCallsDate`. A period is an inclusive
 * `{ from, to }` pair of those keys.
 *
 * Counts only: nothing here returns the content of a document or a list of
 * what one person did.
 */

import { callsTodayFor } from "./aiUsage";
import { normalizeReminderPrefs, REMINDER_TOGGLES } from "../config/reminders";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Stacked charts keep this many named segments; the rest fold into "Other". */
export const MAX_SEGMENTS = 7;
export const OTHER_KEY = "Other";

/**
 * A Firestore timestamp as the proxy returns it (`{ _seconds }`), an ISO
 * string, a Date or epoch milliseconds, as epoch milliseconds. Anything else
 * is null, so a document with a missing or odd `createdAt` drops out of the
 * daily charts instead of landing on 1970.
 */
export function toMillis(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") {
    const seconds = value._seconds ?? value.seconds;
    return typeof seconds === "number" ? seconds * 1000 : null;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** The UTC day key of a timestamp in any form `toMillis` accepts. */
export function dayKeyOf(value) {
  const ms = toMillis(value);
  return ms === null ? null : new Date(ms).toISOString().slice(0, 10);
}

/** `day` moved by `delta` whole days. */
export function shiftDay(day, delta) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** The last `days` days, today included. */
export function periodForDays(days, today) {
  return { from: shiftDay(today, -(days - 1)), to: today };
}

/** Every day key from `from` to `to`, both included. Empty when reversed. */
export function dayKeysBetween(from, to) {
  const keys = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) keys.push(day);
  return keys;
}

/** The period of the same length that ends the day before this one starts. */
export function previousPeriod({ from, to }) {
  const length = dayKeysBetween(from, to).length;
  return { from: shiftDay(from, -length), to: shiftDay(from, -1) };
}

export function isInPeriod(day, { from, to }) {
  return Boolean(day) && day >= from && day <= to;
}

/** Documents whose `field` falls inside the period. */
export function inPeriod(docs, period, field = "createdAt") {
  return docs.filter((doc) => isInPeriod(dayKeyOf(doc?.[field]), period));
}

/** One `{ day, count }` per day of the period, zeros included. */
export function countByDay(docs, period, field = "createdAt") {
  const counts = Object.fromEntries(dayKeysBetween(period.from, period.to).map((day) => [day, 0]));
  for (const doc of docs) {
    const day = dayKeyOf(doc?.[field]);
    if (day in counts) counts[day] += 1;
  }
  return Object.entries(counts).map(([day, count]) => ({ day, count }));
}

/**
 * Tally items by a key, largest first, ties alphabetical so the order is
 * stable between renders. A null or empty key counts as `emptyLabel`.
 */
export function rankBy(items, keyFn, emptyLabel = "Not set") {
  const counts = new Map();
  for (const item of items) {
    const raw = keyFn(item);
    const key = raw === null || raw === undefined || raw === "" ? emptyLabel : String(raw);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Daily counts split by a key, for a stacked bar chart. The `MAX_SEGMENTS`
 * largest keys over the whole period keep their own colour; the rest are
 * summed into "Other", because a legend of twenty languages is unreadable.
 *
 * @returns {{ keys: string[], days: Array<{ day: string, total: number, segments: Record<string, number> }> }}
 */
export function stackByDay(docs, period, keyFn, emptyLabel = "Not set", field = "createdAt") {
  const within = inPeriod(docs, period, field);
  const ranked = rankBy(within, keyFn, emptyLabel);
  const named = ranked.slice(0, MAX_SEGMENTS).map((r) => r.key);
  const keys = ranked.length > MAX_SEGMENTS ? [...named, OTHER_KEY] : named;
  const namedSet = new Set(named);

  const byDay = Object.fromEntries(
    dayKeysBetween(period.from, period.to).map((day) => [day, { day, total: 0, segments: {} }]),
  );
  for (const doc of within) {
    const entry = byDay[dayKeyOf(doc[field])];
    const raw = keyFn(doc);
    const key = raw === null || raw === undefined || raw === "" ? emptyLabel : String(raw);
    const bucket = namedSet.has(key) ? key : OTHER_KEY;
    entry.segments[bucket] = (entry.segments[bucket] ?? 0) + 1;
    entry.total += 1;
  }
  return { keys, days: Object.values(byDay) };
}

/** Users seen within the last `days` days, today included. */
export function countActiveWithin(users, days, today) {
  const cutoff = shiftDay(today, -(days - 1));
  return users.filter((u) => typeof u.lastStreakDate === "string" && u.lastStreakDate >= cutoff).length;
}

/** Sum of the lengths of an array field across users. */
export function sumArrayLengths(users, field) {
  return users.reduce((sum, u) => sum + (Array.isArray(u?.[field]) ? u[field].length : 0), 0);
}

/** `seenExerciseIds` is a map of type -> ids; totals per type. */
export function sumSeenExercisesByType(users) {
  const totals = {};
  for (const u of users) {
    const seen = u?.seenExerciseIds;
    if (!seen || typeof seen !== "object") continue;
    for (const [type, ids] of Object.entries(seen)) {
      if (Array.isArray(ids)) totals[type] = (totals[type] ?? 0) + ids.length;
    }
  }
  return totals;
}

const tierOf = (user) => user?.subscriptionTier || "explorer";

/**
 * Subscription health from the fields the Stripe webhook writes.
 * `currentPeriodEnd` is epoch seconds. A renewal is due when an active
 * subscription's period ends within seven days and it is not set to cancel.
 */
export function subscriptionHealth(users, nowMs) {
  const horizon = nowMs + 7 * DAY_MS;
  const health = { active: 0, pastDue: 0, cancelled: 0, cancelScheduled: 0, renewalsDue: 0 };
  for (const u of users) {
    const status = u?.subscriptionStatus;
    const isActive = status === "active" || status === "trialing";
    if (isActive) health.active += 1;
    if (status === "past_due") health.pastDue += 1;
    if (status === "canceled") health.cancelled += 1;
    if (isActive && u.cancelAtPeriodEnd) health.cancelScheduled += 1;
    const endMs = typeof u?.currentPeriodEnd === "number" ? u.currentPeriodEnd * 1000 : null;
    if (isActive && !u.cancelAtPeriodEnd && endMs !== null && endMs >= nowMs && endMs <= horizon) {
      health.renewalsDue += 1;
    }
  }
  return health;
}

/**
 * Today's AI calls per tier, and how many users on a free tier have used
 * their whole allowance. Counts stamped with another day are zero, exactly as
 * the meter reads them (`callsTodayFor`).
 */
export function aiUsageToday(users, tiersConfig) {
  const callsByTier = {};
  let freeAtLimit = 0;
  let total = 0;
  for (const u of users) {
    const tier = tierOf(u);
    const calls = callsTodayFor(u);
    total += calls;
    if (calls > 0) callsByTier[tier] = (callsByTier[tier] ?? 0) + calls;
    const config = tiersConfig?.[tier];
    const limit = config?.aiCallsPerDay;
    if (config?.isFree && Number.isFinite(limit) && calls >= limit) freeAtLimit += 1;
  }
  const byTier = Object.entries(callsByTier)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return { total, byTier, freeAtLimit };
}

/** Everything Pulse shows about people, from the users list alone. */
export function summarizeUsers(users, tiersConfig, { today, nowMs, period }) {
  const onboarded = users.filter((u) => u?.onboardingCompleted === true).length;
  const signUpsInPeriod = inPeriod(users, period).length;
  const signUpsBefore = inPeriod(users, previousPeriod(period)).length;
  return {
    total: users.length,
    signUpsInPeriod,
    signUpsBefore,
    signUpsByDay: countByDay(users, period),
    active: {
      day1: countActiveWithin(users, 1, today),
      day7: countActiveWithin(users, 7, today),
      day30: countActiveWithin(users, 30, today),
    },
    onboarding: { completed: onboarded, total: users.length },
    interfaceLangs: rankBy(users, (u) => u?.interfaceLang),
    practiceLangs: rankBy(users, (u) => u?.learningDialect, "Not chosen"),
    tiers: rankBy(users, tierOf),
    subscriptions: subscriptionHealth(users, nowMs),
    ai: aiUsageToday(users, tiersConfig),
  };
}

// ── Phase 2 ──────────────────────────────────────────────────────────────────

/**
 * Tally items that each carry a list (interests, favourite features, hidden
 * widgets): one count per list entry, so a user with three interests counts
 * towards three bars.
 */
export function rankListEntries(items, listFn) {
  const counts = new Map();
  for (const item of items) {
    const list = listFn(item);
    if (!Array.isArray(list)) continue;
    for (const key of new Set(list)) {
      if (key === null || key === undefined || key === "") continue;
      counts.set(String(key), (counts.get(String(key)) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Sort numbers into labelled buckets, in bucket order (not by size) — a
 * distribution reads left to right. `buckets` is `[{ label, min, max? }]`
 * with `max` inclusive and absent for the open-ended last one.
 */
export function bucketize(values, buckets) {
  const counts = buckets.map(({ label }) => ({ key: label, count: 0 }));
  for (const value of values) {
    const i = buckets.findIndex(({ min, max }) => value >= min && (max === undefined || value <= max));
    if (i !== -1) counts[i].count += 1;
  }
  return counts;
}

/** Signed-in users not seen for more than `days` days, never-seen included. */
export function countDormant(users, days, today) {
  const cutoff = shiftDay(today, -days);
  return users.filter((u) => typeof u.lastStreakDate !== "string" || u.lastStreakDate < cutoff).length;
}

/**
 * A streak is only current while it is still alive: `dayStreak` is not reset
 * until the user next opens the app, so a streak last extended a week ago
 * still reads as its old length. Alive means seen today or yesterday.
 */
export function currentStreak(user, today) {
  const last = user?.lastStreakDate;
  if (typeof last !== "string" || last < shiftDay(today, -1)) return 0;
  return Number(user.dayStreak) || 0;
}

export const STREAK_BUCKETS = [
  { label: "None", min: 0, max: 0 },
  { label: "1 day", min: 1, max: 1 },
  { label: "2–6", min: 2, max: 6 },
  { label: "7–29", min: 7, max: 29 },
  { label: "30+", min: 30 },
];

export function streakSummary(users, today) {
  const current = users.map((u) => currentStreak(u, today));
  return {
    distribution: bucketize(current, STREAK_BUCKETS),
    longestCurrent: Math.max(0, ...current),
    longestEver: Math.max(0, ...users.map((u) => Number(u?.highestDayStreak) || 0)),
  };
}

/** "Europe/Lisbon" -> "Europe"; UTC and the Etc/ zones have no region. */
export function regionOfTimezone(zone) {
  if (typeof zone !== "string" || !zone) return null;
  const [region] = zone.split("/");
  return zone.includes("/") && region !== "Etc" ? region : "UTC / no region";
}

export const WORD_BANK_BUCKETS = [
  { label: "Empty", min: 0, max: 0 },
  { label: "1–9", min: 1, max: 9 },
  { label: "10–49", min: 10, max: 49 },
  { label: "50+", min: 50 },
];

const arrayLength = (value) => (Array.isArray(value) ? value.length : 0);

/**
 * Push and email preferences. Counts only what a user chose — `true` or
 * `false` written to the profile — because the defaults are applied by the
 * Settings card and by the backend, and a third copy of them here would be
 * one more thing to drift. "Push on" is having a registered browser.
 */
export function messagingSummary(users) {
  const optedOut = (category, channel) =>
    users.filter((u) => u?.notificationPrefs?.[category]?.[channel] === false).length;
  const pushUsers = users.filter((u) => arrayLength(u?.fcmTokens) > 0);
  return {
    pushEnabled: pushUsers.length,
    browsers: users.reduce((sum, u) => sum + arrayLength(u?.fcmTokens), 0),
    // Reminders are push only, so they only reach people with push on.
    remindersOn: REMINDER_TOGGLES.map(({ id }) => ({
      key: id,
      count: pushUsers.filter((u) => normalizeReminderPrefs(u.reminderPrefs)[id]).length,
    })),
    optOuts: {
      announcementsEmail: optedOut("announcements", "email"),
      announcementsPush: optedOut("announcements", "push"),
      remindersPush: optedOut("reminders", "push"),
    },
  };
}

/** Mail outbox: what is waiting or failed now, and what went out per day. */
export function mailQueueSummary(rows, period) {
  return {
    pending: rows.filter((r) => r.status === "pending").length,
    failed: rows.filter((r) => r.status === "failed").length,
    queuedInPeriod: inPeriod(rows, period).length,
    sentByDay: countByDay(rows.filter((r) => r.status === "sent"), period, "sentAt"),
  };
}

/** Tutor directory health. `published` is true unless explicitly false. */
export function tutorSummary(tutors, period) {
  const published = tutors.filter((t) => t?.published !== false).length;
  return {
    published,
    hidden: tutors.length - published,
    newInPeriod: inPeriod(tutors, period).length,
    languages: rankListEntries(tutors.filter((t) => t?.published !== false), (t) => t.languages),
  };
}

/** Speech clip cache: clips made, and the stored audio size. */
export function ttsSummary(clips, period) {
  const within = inPeriod(clips, period);
  const bytesOf = (list) => list.reduce((sum, c) => sum + (Number(c?.bytes) || 0), 0);
  return {
    total: clips.length,
    inPeriod: within.length,
    bytes: bytesOf(clips),
    bytesInPeriod: bytesOf(within),
  };
}

/** 1536 -> "1.5 KB": one decimal below 10 of a unit, whole numbers above. */
export function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
