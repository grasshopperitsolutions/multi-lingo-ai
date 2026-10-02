import { describe, it, expect } from "vitest";
import {
  HISTORY_DAYS,
  DEFAULT_WEEKLY_TARGET,
  bestMonth,
  daysThisMonth,
  daysThisWeek,
  isoWeekDays,
  localToday,
  nextPracticeState,
  resolveWeeklyTarget,
  shiftDate,
  totalDays,
  weekStart,
} from "../../src/utils/practiceDays";

// 2026-10-01 is a Thursday.
const THU = "2026-10-01";

describe("practice days: the calendar", () => {
  it("uses the device's own day, not UTC", () => {
    // 23:30 local on the 1st is already the 2nd in UTC for anyone west of it.
    expect(localToday(new Date(2026, 9, 1, 23, 30))).toBe("2026-10-01");
    expect(localToday(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("starts the week on Monday", () => {
    expect(weekStart(THU)).toBe("2026-09-28");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
    expect(weekStart("2026-10-04")).toBe("2026-09-28"); // Sunday belongs to the week before
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });

  it("shifts dates across months and years", () => {
    expect(shiftDate("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("lays out the week Monday first, marking practised, today and future", () => {
    const week = isoWeekDays(["2026-09-28", THU], THU);
    expect(week.map((d) => d.date)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(week.filter((d) => d.practiced).map((d) => d.date)).toEqual(["2026-09-28", THU]);
    expect(week.find((d) => d.isToday).date).toBe(THU);
    expect(week.filter((d) => d.isFuture)).toHaveLength(3);
  });

  it("counts a week that straddles two months as one week", () => {
    expect(daysThisWeek(["2026-09-29", "2026-09-30", "2026-10-01"], THU)).toBe(3);
  });

  it("counts the month, not the week", () => {
    expect(daysThisMonth(["2026-09-30", "2026-10-01", "2026-10-02"], THU)).toBe(2);
  });

  it("ignores junk where a list of dates should be", () => {
    expect(daysThisWeek(undefined, THU)).toBe(0);
    expect(daysThisWeek([null, 5, THU], THU)).toBe(1);
  });
});

describe("practice days: the weekly goal", () => {
  it("defaults to three and clamps to a week", () => {
    expect(DEFAULT_WEEKLY_TARGET).toBe(3);
    expect(resolveWeeklyTarget(undefined)).toBe(3);
    expect(resolveWeeklyTarget(0)).toBe(3);
    expect(resolveWeeklyTarget("x")).toBe(3);
    expect(resolveWeeklyTarget(5)).toBe(5);
    expect(resolveWeeklyTarget(40)).toBe(7);
    expect(resolveWeeklyTarget(2.9)).toBe(2);
  });
});

describe("practice days: best month and total", () => {
  it("finds the best month, the later one on a tie", () => {
    expect(bestMonth({ "2026-08": 12, "2026-09": 20, "2026-10": 3 })).toEqual({ key: "2026-09", count: 20 });
    expect(bestMonth({ "2026-08": 9, "2026-09": 9 })).toEqual({ key: "2026-09", count: 9 });
    expect(bestMonth({})).toBeNull();
    expect(bestMonth(undefined)).toBeNull();
    expect(bestMonth({ "2026-09": "junk" })).toBeNull();
  });

  it("adds the carried-over history to every month since", () => {
    expect(totalDays({ practiceDaysSeed: 40, practiceMonths: { "2026-10": 5, "2026-11": 2 } })).toBe(47);
    expect(totalDays({ practiceMonths: { "2026-10": 5 } })).toBe(5);
    expect(totalDays({})).toBe(0);
    expect(totalDays(null)).toBe(0);
  });
});

describe("practice days: recording today", () => {
  it("does nothing when today is already recorded, however it is asked", () => {
    expect(nextPracticeState({ lastPracticeDate: THU }, THU)).toBeNull();
    expect(nextPracticeState({ practiceDates: [THU] }, THU)).toBeNull();
  });

  it("adds today and counts it in its month", () => {
    const next = nextPracticeState(
      { practiceDates: ["2026-09-30"], practiceMonths: { "2026-09": 9, "2026-10": 0 }, lastPracticeDate: "2026-09-30", practiceDaysSeed: 4 },
      THU,
    );
    expect(next.practiceDates).toEqual(["2026-09-30", THU]);
    expect(next.practiceMonths).toEqual({ "2026-09": 9, "2026-10": 1 });
    expect(next.lastPracticeDate).toBe(THU);
    // The seed is written once, with the first record, never again.
    expect(next).not.toHaveProperty("practiceDaysSeed");
  });

  it("never resets after a gap", () => {
    const next = nextPracticeState(
      { practiceDates: ["2026-08-01"], practiceMonths: { "2026-08": 1 }, lastPracticeDate: "2026-08-01" },
      THU,
    );
    expect(next.practiceDates).toEqual(["2026-08-01", THU]);
    expect(totalDays({ ...next })).toBe(2);
  });

  it("seeds the total from the better of the best and the current old streak, once", () => {
    const first = nextPracticeState({ dayStreak: 3, highestDayStreak: 17, lastStreakDate: "2026-09-30" }, THU);
    expect(first.practiceDaysSeed).toBe(17);
    expect(first.practiceMonths).toEqual({ "2026-10": 1 });
    expect(totalDays(first)).toBe(18);

    expect(nextPracticeState({ dayStreak: 9, lastStreakDate: "2026-09-30" }, THU).practiceDaysSeed).toBe(9);
    expect(nextPracticeState({}, THU).practiceDaysSeed).toBe(0);
  });

  it("trims dates past the history window but keeps the month totals", () => {
    const old = shiftDate(THU, -HISTORY_DAYS); // just outside the window
    const edge = shiftDate(THU, -(HISTORY_DAYS - 1)); // the oldest kept
    const next = nextPracticeState(
      { practiceDates: [old, edge], practiceMonths: { [old.slice(0, 7)]: 1 } },
      THU,
    );
    expect(next.practiceDates).toEqual([edge, THU]);
    expect(next.practiceMonths[old.slice(0, 7)]).toBeGreaterThanOrEqual(1);
  });

  it("keeps the dates sorted", () => {
    const next = nextPracticeState({ practiceDates: ["2026-10-02"], practiceMonths: {} }, THU);
    expect(next.practiceDates).toEqual([THU, "2026-10-02"]);
  });
});
