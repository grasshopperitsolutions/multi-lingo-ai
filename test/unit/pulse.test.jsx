import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import {
  toMillis,
  dayKeyOf,
  shiftDay,
  periodForDays,
  dayKeysBetween,
  previousPeriod,
  inPeriod,
  countByDay,
  rankBy,
  stackByDay,
  countActiveWithin,
  sumArrayLengths,
  sumSeenExercisesByType,
  subscriptionHealth,
  aiUsageToday,
  summarizeUsers,
  rankListEntries,
  bucketize,
  countDormant,
  currentStreak,
  streakSummary,
  regionOfTimezone,
  messagingSummary,
  mailQueueSummary,
  tutorSummary,
  ttsSummary,
  formatBytes,
  WORD_BANK_BUCKETS,
  MAX_SEGMENTS,
  OTHER_KEY,
} from "../../src/utils/pulseMetrics";

vi.mock("../../src/firebase", () => ({
  auth: { currentUser: { getIdToken: () => Promise.resolve("token") } },
}));

const loadPulseData = vi.fn();
vi.mock("../../src/services/pulseService", () => ({
  loadPulseData: (...args) => loadPulseData(...args),
}));

// Fixed clock: 2026-09-28 12:00 UTC.
const NOW = Date.parse("2026-09-28T12:00:00Z");
const TODAY = "2026-09-28";
const ts = (iso) => ({ _seconds: Date.parse(iso) / 1000, _nanoseconds: 0 });

const TIERS = {
  explorer: { id: "explorer", label: "Explorer", isFree: true, aiCallsPerDay: 3 },
  voyager: { id: "voyager", label: "Voyager", isFree: false, aiCallsPerDay: 30 },
  maestro: { id: "maestro", label: "Maestro", isFree: false, aiCallsPerDay: Infinity },
};

const USERS = [
  {
    uid: "a", createdAt: ts("2026-09-28T08:00:00Z"), lastStreakDate: "2026-09-28",
    onboardingCompleted: true, interfaceLang: "pt-PT", learningDialect: "es-ES",
    subscriptionTier: "explorer", aiCallsToday: 3, aiCallsDate: "2026-09-28",
    seenStoryIds: ["s1", "s2"], seenExerciseIds: { reading: ["e1"], writing: [] },
  },
  {
    uid: "b", createdAt: ts("2026-09-25T08:00:00Z"), lastStreakDate: "2026-09-22",
    onboardingCompleted: true, interfaceLang: "en-US", learningDialect: "pt-PT",
    subscriptionTier: "voyager", subscriptionStatus: "active",
    currentPeriodEnd: (NOW + 3 * 86400000) / 1000, cancelAtPeriodEnd: false,
    aiCallsToday: 10, aiCallsDate: "2026-09-28", seenStoryIds: ["s1"],
    seenExerciseIds: { reading: ["e1", "e2"], listening: ["e3"] },
  },
  {
    uid: "c", createdAt: ts("2026-09-10T08:00:00Z"), lastStreakDate: "2026-09-01",
    onboardingCompleted: false, interfaceLang: "pt-PT", learningDialect: null,
    subscriptionTier: "explorer",
    // Yesterday's count must read as zero, as the meter reads it.
    aiCallsToday: 3, aiCallsDate: "2026-09-27",
  },
  {
    uid: "d", createdAt: "2026-09-20T10:00:00Z", lastStreakDate: "2026-09-27",
    onboardingCompleted: true, interfaceLang: "pt-PT", learningDialect: "es-ES",
    subscriptionTier: "maestro", subscriptionStatus: "active",
    currentPeriodEnd: (NOW + 3 * 86400000) / 1000, cancelAtPeriodEnd: true,
    aiCallsToday: 50, aiCallsDate: "2026-09-28",
  },
  { uid: "e", subscriptionStatus: "past_due" },
  { uid: "f", subscriptionStatus: "canceled", subscriptionTier: "explorer" },
];

describe("pulseMetrics: time", () => {
  it("reads every timestamp shape the proxy and the services produce", () => {
    const iso = "2026-09-28T08:00:00.000Z";
    const ms = Date.parse(iso);
    expect(toMillis(ts(iso))).toBe(ms);
    expect(toMillis({ seconds: ms / 1000 })).toBe(ms);
    expect(toMillis(iso)).toBe(ms);
    expect(toMillis(new Date(iso))).toBe(ms);
    expect(toMillis(ms)).toBe(ms);
    for (const bad of [null, undefined, "", "not a date", {}, NaN, new Date("x")]) {
      expect(toMillis(bad)).toBeNull();
    }
    expect(dayKeyOf(ts("2026-09-28T23:59:59Z"))).toBe("2026-09-28");
    expect(dayKeyOf(undefined)).toBeNull();
  });

  it("builds inclusive UTC periods", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(periodForDays(1, TODAY)).toEqual({ from: TODAY, to: TODAY });
    expect(periodForDays(7, TODAY)).toEqual({ from: "2026-09-22", to: TODAY });
    expect(dayKeysBetween("2026-09-26", TODAY)).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(dayKeysBetween(TODAY, "2026-09-26")).toEqual([]);
    expect(previousPeriod({ from: "2026-09-22", to: TODAY })).toEqual({ from: "2026-09-15", to: "2026-09-21" });
  });

  it("filters and buckets by createdAt, dropping undated documents", () => {
    const period = periodForDays(7, TODAY);
    expect(inPeriod(USERS, period).map((u) => u.uid)).toEqual(["a", "b"]);
    const byDay = countByDay(USERS, period);
    expect(byDay).toHaveLength(7);
    expect(byDay.find((d) => d.day === "2026-09-25").count).toBe(1);
    expect(byDay.reduce((s, d) => s + d.count, 0)).toBe(2);
  });
});

describe("pulseMetrics: tallies", () => {
  it("ranks largest first, ties alphabetically, empties under a label", () => {
    expect(rankBy(USERS, (u) => u.interfaceLang)).toEqual([
      { key: "pt-PT", count: 3 },
      { key: "Not set", count: 2 },
      { key: "en-US", count: 1 },
    ]);
  });

  it("stacks by key and folds the tail into Other", () => {
    const period = { from: TODAY, to: TODAY };
    const docs = Array.from({ length: MAX_SEGMENTS + 2 }, (_, i) => ({
      createdAt: ts(`${TODAY}T0${i}:00:00Z`),
      lang: `l${i}`,
    }));
    docs.push({ createdAt: ts(`${TODAY}T10:00:00Z`), lang: "l0" });
    const stack = stackByDay(docs, period, (d) => d.lang);
    expect(stack.keys[0]).toBe("l0");
    expect(stack.keys).toHaveLength(MAX_SEGMENTS + 1);
    expect(stack.keys.at(-1)).toBe(OTHER_KEY);
    expect(stack.days[0].total).toBe(docs.length);
    expect(stack.days[0].segments.l0).toBe(2);
    expect(stack.days[0].segments[OTHER_KEY]).toBe(2);
  });

  it("does not add Other when every key fits", () => {
    const stack = stackByDay([{ createdAt: ts(`${TODAY}T01:00:00Z`), t: "a" }], { from: TODAY, to: TODAY }, (d) => d.t);
    expect(stack.keys).toEqual(["a"]);
  });

  it("counts people seen within a window, today included", () => {
    expect(countActiveWithin(USERS, 1, TODAY)).toBe(1);
    expect(countActiveWithin(USERS, 7, TODAY)).toBe(3);
    expect(countActiveWithin(USERS, 30, TODAY)).toBe(4);
  });

  it("sums seen ids", () => {
    expect(sumArrayLengths(USERS, "seenStoryIds")).toBe(3);
    expect(sumSeenExercisesByType(USERS)).toEqual({ reading: 3, writing: 0, listening: 1 });
  });

  it("reads subscription health from the webhook's fields", () => {
    expect(subscriptionHealth(USERS, NOW)).toEqual({
      active: 2, pastDue: 1, cancelled: 1, cancelScheduled: 1, renewalsDue: 1,
    });
  });

  it("counts today's AI calls only, and free users at their limit", () => {
    expect(aiUsageToday(USERS, TIERS)).toEqual({
      total: 63,
      byTier: [{ key: "maestro", count: 50 }, { key: "voyager", count: 10 }, { key: "explorer", count: 3 }],
      freeAtLimit: 1,
    });
  });

  it("summarizes people for a period", () => {
    const summary = summarizeUsers(USERS, TIERS, { today: TODAY, nowMs: NOW, period: periodForDays(7, TODAY) });
    expect(summary.total).toBe(6);
    expect(summary.signUpsInPeriod).toBe(2);
    expect(summary.signUpsBefore).toBe(1);
    expect(summary.onboarding).toEqual({ completed: 3, total: 6 });
    expect(summary.practiceLangs).toEqual([
      { key: "Not chosen", count: 3 },
      { key: "es-ES", count: 2 },
      { key: "pt-PT", count: 1 },
    ]);
    expect(summary.tiers[0]).toEqual({ key: "explorer", count: 4 });
  });
});

describe("pulseMetrics: phase 2", () => {
  it("counts each list entry once per user", () => {
    const users = [{ i: ["a", "b", "a"] }, { i: ["a"] }, { i: null }, {}];
    expect(rankListEntries(users, (u) => u.i)).toEqual([{ key: "a", count: 2 }, { key: "b", count: 1 }]);
  });

  it("buckets in bucket order, open-ended last", () => {
    expect(bucketize([0, 0, 3, 12, 400], WORD_BANK_BUCKETS)).toEqual([
      { key: "Empty", count: 2 },
      { key: "1–9", count: 1 },
      { key: "10–49", count: 1 },
      { key: "50+", count: 1 },
    ]);
  });

  it("counts dormant users, never-seen included", () => {
    // e and f were never seen; c, last seen 27 days ago, is not dormant yet.
    expect(countDormant(USERS, 30, TODAY)).toBe(2);
    expect(countDormant(USERS, 20, TODAY)).toBe(3);
  });

  it("treats a streak not extended since before yesterday as over", () => {
    expect(currentStreak({ dayStreak: 5, lastStreakDate: "2026-09-27" }, TODAY)).toBe(5);
    expect(currentStreak({ dayStreak: 5, lastStreakDate: "2026-09-26" }, TODAY)).toBe(0);
    const summary = streakSummary(
      [
        { dayStreak: 40, highestDayStreak: 40, lastStreakDate: TODAY },
        { dayStreak: 90, highestDayStreak: 90, lastStreakDate: "2026-01-01" },
        {},
      ],
      TODAY,
    );
    expect(summary.longestCurrent).toBe(40);
    expect(summary.longestEver).toBe(90);
    expect(summary.distribution.find((b) => b.key === "None").count).toBe(2);
    expect(summary.distribution.find((b) => b.key === "30+").count).toBe(1);
  });

  it("reads a region from a timezone", () => {
    expect(regionOfTimezone("Europe/Lisbon")).toBe("Europe");
    expect(regionOfTimezone("America/Argentina/Buenos_Aires")).toBe("America");
    expect(regionOfTimezone("UTC")).toBe("UTC / no region");
    expect(regionOfTimezone("Etc/GMT+3")).toBe("UTC / no region");
    expect(regionOfTimezone(null)).toBeNull();
  });

  it("counts push, reminders among push users, and explicit opt-outs only", () => {
    const summary = messagingSummary([
      { fcmTokens: ["t1", "t2"], reminderPrefs: { weeklyReview: false } },
      { fcmTokens: ["t3"] },
      { fcmTokens: [], notificationPrefs: { announcements: { email: false } } },
      // A reminder preference without push reaches nobody, so it is not counted.
      { reminderPrefs: { streakRescue: true }, notificationPrefs: { reminders: { push: true } } },
    ]);
    expect(summary.pushEnabled).toBe(2);
    expect(summary.browsers).toBe(3);
    expect(summary.remindersOn.find((r) => r.key === "weeklyReview").count).toBe(1);
    expect(summary.remindersOn.find((r) => r.key === "streakRescue").count).toBe(2);
    expect(summary.optOuts).toEqual({ announcementsEmail: 1, announcementsPush: 0, remindersPush: 0 });
  });

  it("summarizes the outbox, bucketing sends by when they went out", () => {
    const period = periodForDays(7, TODAY);
    const summary = mailQueueSummary(
      [
        { status: "pending", createdAt: ts(`${TODAY}T01:00:00Z`) },
        { status: "sent", createdAt: ts("2026-09-01T01:00:00Z"), sentAt: ts(`${TODAY}T06:00:00Z`) },
        { status: "failed", createdAt: ts("2026-09-27T01:00:00Z") },
      ],
      period,
    );
    expect(summary).toMatchObject({ pending: 1, failed: 1, queuedInPeriod: 2 });
    expect(summary.sentByDay.at(-1)).toEqual({ day: TODAY, count: 1 });
  });

  it("counts tutors published unless explicitly hidden", () => {
    const summary = tutorSummary(
      [
        { published: true, languages: ["pt-PT", "en-US"], createdAt: ts(`${TODAY}T01:00:00Z`) },
        { languages: ["pt-PT"] },
        { published: false, languages: ["fr-FR"] },
      ],
      periodForDays(7, TODAY),
    );
    expect(summary).toMatchObject({ published: 2, hidden: 1, newInPeriod: 1 });
    expect(summary.languages).toEqual([{ key: "pt-PT", count: 2 }, { key: "en-US", count: 1 }]);
  });

  it("sums clip storage overall and in the period", () => {
    const summary = ttsSummary(
      [{ bytes: 1000, createdAt: ts(`${TODAY}T01:00:00Z`) }, { bytes: 500, createdAt: ts("2026-01-01T01:00:00Z") }, {}],
      periodForDays(7, TODAY),
    );
    expect(summary).toEqual({ total: 3, inPeriod: 1, bytes: 1500, bytesInPeriod: 1000 });
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(50 * 1024 * 1024)).toBe("50 MB");
  });
});

describe("PulseSection", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    loadPulseData.mockReset();
  });

  const DATA = {
    users: USERS,
    tiersConfig: TIERS,
    stories: [
      { id: "s1", createdAt: ts("2026-09-27T10:00:00Z"), targetLang: "es-ES", level: "A1" },
      { id: "s2", createdAt: ts("2026-08-01T10:00:00Z"), targetLang: "pt-PT", level: "B1" },
    ],
    historyFacts: [],
    examExercises: [{ id: "e1", createdAt: ts("2026-09-28T01:00:00Z"), type: "reading", level: "A2", language: "es" }],
    languages: [
      { id: "es-ES", code: "es-ES", label: "Español (España)", createdAt: ts("2026-09-26T01:00:00Z"), createdBy: "b" },
    ],
    reports: [
      { id: "r1", read: false, createdAt: "2026-09-27T10:00:00.000Z" },
      { id: "r2", read: true, createdAt: "2026-09-01T10:00:00.000Z" },
    ],
    pronunciationPassages: [{ id: "p1", createdAt: ts("2026-09-28T02:00:00Z"), targetLang: "es-ES", level: "A1" }],
    grammarTopics: [{ id: "t1", createdAt: ts("2026-09-28T02:00:00Z"), status: "practice" }],
    grammarExercises: [],
    wordPool: [
      { id: "w1", createdAt: ts("2026-09-28T02:00:00Z"), topicIds: ["food"], status: "ready" },
      { id: "w2", createdAt: ts("2026-09-27T02:00:00Z"), topicIds: [], status: "ready" },
    ],
    wordLinkGamePool: [{ id: "l1", createdAt: ts("2026-09-28T02:00:00Z") }],
    wordLadderGamePool: [],
    ttsClips: [{ id: "c1", createdAt: ts("2026-09-28T02:00:00Z"), voice: "Sulafat", language: "es-ES", bytes: 2048 }],
    locales: [{ id: "en-US" }, { id: "es-ES", createdAt: ts("2026-09-26T02:00:00Z") }],
    categories: [{ id: "food", label: "Food" }],
    tutors: [{ id: "b", published: true, languages: ["pt-PT"] }, { id: "d", published: false }],
    tutorApplications: [{ id: "a1", read: false }],
    contactSubmissions: [{ id: "m1", createdAt: ts("2026-09-28T02:00:00Z") }],
    mailQueue: [],
    errors: { mailQueue: "denied" },
  };

  it("renders the counts from its data and re-scopes on the period picker", async () => {
    loadPulseData.mockResolvedValue(DATA);
    const onOpenReports = vi.fn();
    const { default: PulseSection } = await import("../../src/components/admin/pulse/PulseSection");
    render(<PulseSection isDarkMode={false} onOpenReports={onOpenReports} />);

    await waitFor(() => expect(screen.getByText("Total users")).toBeInTheDocument());
    const statValue = (label) => screen.getByText(label).nextSibling.textContent;

    expect(statValue("Total users")).toBe("6");
    expect(statValue("Sign-ups, last 7 days")).toBe("2");
    expect(statValue("Seen in 30 days")).toBe("4");
    expect(statValue("Tales, last 7 days")).toBe("1");
    expect(statValue("Pool reuse")).toBe("1.5×");
    expect(statValue("Free users at limit")).toBe("1");
    // Added by user "b", named from the users list rather than by uid.
    expect(screen.getByText(/· 2026-09-26 · b$/)).toBeInTheDocument();

    expect(statValue("Clip storage")).toBe("2.0 KB");
    expect(statValue("Tutors published")).toBe("1");
    expect(statValue("Words added, last 7 days")).toBe("2");
    // One unreadable collection costs its own card, not the page.
    expect(screen.getByText("Could not read the mail queue: denied")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "90 days" }));
    expect(statValue("Tales, last 90 days")).toBe("2");
    expect(statValue("Sign-ups, last 90 days")).toBe("4");

    fireEvent.click(screen.getByRole("button", { name: "Open Reports" }));
    expect(onOpenReports).toHaveBeenCalled();
  });

  it("shows the error with a retry when loading fails", async () => {
    loadPulseData.mockRejectedValue(new Error("nope"));
    const { default: PulseSection } = await import("../../src/components/admin/pulse/PulseSection");
    render(<PulseSection isDarkMode />);
    await waitFor(() => expect(screen.getByText("nope")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
