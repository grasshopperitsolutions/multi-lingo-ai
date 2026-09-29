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
 *
 * `today` is the day Pulse is reporting on, like every other function here.
 * It used to be read from the clock instead, which put one figure on a
 * different day from the rest of the screen, and made its test pass only on
 * the day it was written.
 *
 * @param {string} [today] - UTC `YYYY-MM-DD`; defaults to now
 */
export function aiUsageToday(users, tiersConfig, today) {
  const callsByTier = {};
  let freeAtLimit = 0;
  let total = 0;
  for (const u of users) {
    const tier = tierOf(u);
    const calls = callsTodayFor(u, today);
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
    ai: aiUsageToday(users, tiersConfig, today),
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

// ── Phase 3: counters, snapshots and weeks written by the API ────────────────
//
// appConfig/pulse/counters/{day}   live increments (lib/pulse.ts in the API)
// appConfig/pulse/days/{day}       the 06:00 UTC recount of the day before
// appConfig/pulse/weeks/{week}     unique weekly actives by sign-up cohort
//
// Document ids are the day or week keys; `id` is what the proxy returns them
// under.

const isNumberMap = (value) => value && typeof value === "object" && !Array.isArray(value);

/** Deep sum of two nested count maps; non-numbers are ignored. */
function addMaps(into, from) {
  for (const [key, value] of Object.entries(from ?? {})) {
    if (typeof value === "number") {
      into[key] = (typeof into[key] === "number" ? into[key] : 0) + value;
    } else if (isNumberMap(value)) {
      into[key] = addMaps(isNumberMap(into[key]) ? into[key] : {}, value);
    }
  }
  return into;
}

/** The counter documents that fall in the period, summed into one map. */
export function sumCounters(counterDocs, period) {
  const total = {};
  for (const doc of counterDocs ?? []) {
    if (isInPeriod(doc.id, period)) addMaps(total, doc);
  }
  return total;
}

/** A number found at `path` in a nested map, or 0. */
export function valueAt(map, path) {
  let node = map;
  for (const key of path) {
    if (!isNumberMap(node)) return 0;
    node = node[key];
  }
  return typeof node === "number" ? node : isNumberMap(node) ? sumLeaves(node) : 0;
}

/** Every number under a map, however deep. */
export function sumLeaves(map) {
  let sum = 0;
  for (const value of Object.values(map ?? {})) {
    if (typeof value === "number") sum += value;
    else if (isNumberMap(value)) sum += sumLeaves(value);
  }
  return sum;
}

/**
 * One `{ day, count }` per day of the period, read from each day's document
 * by a path (`["activeUsers", "total"]`) or a function of the document.
 * A day with no document is zero.
 */
export function seriesFromDocs(docs, period, pathOrFn) {
  const byId = Object.fromEntries((docs ?? []).map((d) => [d.id, d]));
  const read = typeof pathOrFn === "function" ? pathOrFn : (doc) => valueAt(doc, pathOrFn);
  return dayKeysBetween(period.from, period.to).map((day) => ({
    day,
    count: byId[day] ? Number(read(byId[day])) || 0 : 0,
  }));
}

/**
 * A map's first level as ranked bars, each entry summed over whatever lies
 * beneath it (`{ story: { explorer: 2, maestro: 1 } }` -> story: 3).
 */
export function rankMap(map, leafKey) {
  return Object.entries(map ?? {})
    .map(([key, value]) => ({
      key,
      count: typeof value === "number" ? value : leafKey ? sumLeafKey(value, leafKey) : sumLeaves(value),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** Sum of every `leafKey` under a map: all the `calls` of a feature across tiers. */
export function sumLeafKey(map, leafKey) {
  let sum = 0;
  for (const [key, value] of Object.entries(map ?? {})) {
    if (key === leafKey && typeof value === "number") sum += value;
    else if (isNumberMap(value)) sum += sumLeafKey(value, leafKey);
  }
  return sum;
}

/**
 * AI use per feature for the period, from `ai.{feature}.{tier}.{field}`.
 * Sorted by calls.
 */
export function aiByFeature(summed) {
  return Object.entries(summed.ai ?? {})
    .map(([feature, byTier]) => ({
      key: feature,
      calls: sumLeafKey(byTier, "calls"),
      cached: sumLeafKey(byTier, "cached"),
      refused: sumLeafKey(byTier, "refused"),
      errors: sumLeafKey(byTier, "errors"),
      inputTokens: sumLeafKey(byTier, "inputTokens"),
      outputTokens: sumLeafKey(byTier, "outputTokens"),
      thinkingTokens: sumLeafKey(byTier, "thinkingTokens"),
    }))
    .sort((a, b) => b.calls - a.calls || a.key.localeCompare(b.key));
}

/** The newest snapshot, or null. Sorted in code; ids are day keys. */
export function latestSnapshot(dayDocs) {
  const sorted = [...(dayDocs ?? [])].sort((a, b) => String(b.id).localeCompare(String(a.id)));
  return sorted[0] ?? null;
}

/** ISO week key ("2026-W40") of a date, UTC, matching the API's isoWeekKey. */
export function isoWeekOf(ms) {
  const date = new Date(ms);
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The week key `n` weeks after `week`. */
export function addWeeks(week, n) {
  const [year, w] = week.split("-W").map(Number);
  // Monday of ISO week 1 is the Monday on or before January 4th.
  const jan4 = Date.UTC(year, 0, 4);
  const mondayWeek1 = jan4 - (((new Date(jan4).getUTCDay() || 7) - 1) * DAY_MS);
  return isoWeekOf(mondayWeek1 + ((w - 1 + n) * 7 + 3) * DAY_MS);
}

/**
 * Early retention: for each sign-up week, its size (from the users list) and
 * how many of its members were active in each of the following `span` weeks
 * (from the weeks documents, which count each person once a week). Cohorts
 * newest first, at most `limit` of them. A week that has not happened yet is
 * null, so it renders as blank rather than as a zero.
 */
export function retentionTable(weekDocs, users, { today, span = 4, limit = 8 } = {}) {
  const currentWeek = isoWeekOf(Date.parse(`${today}T00:00:00Z`));
  const sizes = {};
  for (const u of users ?? []) {
    const ms = toMillis(u.createdAt);
    if (ms !== null) sizes[isoWeekOf(ms)] = (sizes[isoWeekOf(ms)] ?? 0) + 1;
  }
  const byWeek = Object.fromEntries((weekDocs ?? []).map((d) => [d.id, d]));
  return Object.keys(sizes)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit)
    .map((cohort) => ({
      cohort,
      size: sizes[cohort],
      weeks: Array.from({ length: span }, (_, i) => {
        const week = addWeeks(cohort, i + 1);
        if (week > currentWeek) return null;
        return byWeek[week]?.cohorts?.[cohort] ?? 0;
      }),
    }));
}

/** Minor units per currency -> "€12.34 · $5.00". */
export function formatMoney(byCurrency) {
  const entries = Object.entries(byCurrency ?? {}).filter(([, v]) => typeof v === "number");
  if (!entries.length) return "—";
  return entries
    .map(([currency, minor]) => {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
      } catch {
        return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
      }
    })
    .join(" · ");
}
