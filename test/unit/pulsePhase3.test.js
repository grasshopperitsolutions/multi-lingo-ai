import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  addWeeks,
  aiByFeature,
  formatMoney,
  isoWeekOf,
  latestSnapshot,
  rankMap,
  retentionTable,
  seriesFromDocs,
  sumCounters,
  sumLeafKey,
  sumLeaves,
  valueAt,
} from "../../src/utils/pulseMetrics";
import { dashboardFeatureIdForPath } from "../../src/config/dashboardFeatures";
import { ACQUISITION_KEY, captureAcquisition, clearAcquisition, readAcquisition } from "../../src/utils/acquisition";

const currentUser = { isAnonymous: false, getIdToken: () => Promise.resolve("tok") };
const firebaseMock = vi.hoisted(() => ({ auth: { currentUser: null } }));
vi.mock("../../src/firebase", () => firebaseMock);

const {
  reportActive,
  reportFeatureOpen,
  reportLockedAttempt,
  reportLiveSeconds,
  flushPulse,
  __resetPulseReports,
  FLUSH_DELAY_MS,
  MAX_BATCH,
} = await import("../../src/services/pulseReportService");

const period = { from: "2026-09-26", to: "2026-09-28" };
const counters = [
  { id: "2026-09-25", ai: { story: { explorer: { calls: 100 } } } }, // outside the period
  {
    id: "2026-09-27",
    day: "2026-09-27",
    activeUsers: { total: 2, explorer: 2 },
    ai: { story: { explorer: { calls: 2, inputTokens: 50 }, maestro: { calls: 1, refused: 0 } } },
  },
  {
    id: "2026-09-28",
    activeUsers: { total: 3, explorer: 1, maestro: 2 },
    ai: { story: { explorer: { calls: 1, cached: 4 } }, dict: { voyager: { calls: 5, errors: 1 } } },
  },
];

describe("Phase 3 metrics", () => {
  it("sums the counter documents inside the period, deeply, ignoring non-numbers", () => {
    const summed = sumCounters(counters, period);
    expect(summed.activeUsers).toEqual({ total: 5, explorer: 3, maestro: 2 });
    expect(summed.ai.story).toEqual({ explorer: { calls: 3, inputTokens: 50, cached: 4 }, maestro: { calls: 1, refused: 0 } });
    expect(summed).not.toHaveProperty("day");
  });

  it("reads values and sums leaves", () => {
    const summed = sumCounters(counters, period);
    expect(valueAt(summed, ["activeUsers", "total"])).toBe(5);
    expect(valueAt(summed, ["activeUsers"])).toBe(10); // a map sums what is under it
    expect(valueAt(summed, ["nothing", "here"])).toBe(0);
    expect(sumLeafKey(summed.ai, "calls")).toBe(9);
    expect(sumLeaves({ a: 1, b: { c: 2, d: "x" } })).toBe(3);
  });

  it("builds a day series from a path or a function, zero where no document exists", () => {
    expect(seriesFromDocs(counters, period, ["activeUsers", "total"])).toEqual([
      { day: "2026-09-26", count: 0 },
      { day: "2026-09-27", count: 2 },
      { day: "2026-09-28", count: 3 },
    ]);
    expect(seriesFromDocs(counters, period, (doc) => sumLeafKey(doc.ai, "calls")).map((d) => d.count)).toEqual([0, 3, 6]);
  });

  it("ranks a map's first level, dropping zeros", () => {
    expect(rankMap({ a: { x: 1, y: 2 }, b: 5, c: 0 })).toEqual([{ key: "b", count: 5 }, { key: "a", count: 3 }]);
    expect(rankMap({ a: { t1: { calls: 2, inputTokens: 99 } } }, "calls")).toEqual([{ key: "a", count: 2 }]);
    expect(rankMap(undefined)).toEqual([]);
  });

  it("totals AI use per feature, sorted by calls", () => {
    const rows = aiByFeature(sumCounters(counters, period));
    expect(rows.map((r) => r.key)).toEqual(["dict", "story"]);
    expect(rows[1]).toMatchObject({ calls: 4, cached: 4, inputTokens: 50, refused: 0 });
    expect(rows[0]).toMatchObject({ calls: 5, errors: 1 });
  });

  it("finds the newest snapshot by its day id", () => {
    expect(latestSnapshot([{ id: "2026-09-26" }, { id: "2026-09-27" }, { id: "2026-09-01" }]).id).toBe("2026-09-27");
    expect(latestSnapshot([])).toBeNull();
  });

  it("keys ISO weeks the way the API does", () => {
    expect(isoWeekOf(Date.parse("2026-09-28T12:00:00Z"))).toBe("2026-W40");
    expect(isoWeekOf(Date.parse("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(addWeeks("2026-W39", 1)).toBe("2026-W40");
    expect(addWeeks("2026-W52", 2)).toBe("2027-W01");
  });

  it("builds the retention table from cohort sizes and weekly actives, blank for weeks to come", () => {
    const users = [
      { createdAt: { _seconds: Date.parse("2026-09-22T10:00:00Z") / 1000 } }, // W39
      { createdAt: "2026-09-23T10:00:00Z" }, // W39
      { createdAt: "2026-09-29T10:00:00Z" }, // W40
      {},
    ];
    const weeks = [{ id: "2026-W40", cohorts: { "2026-W39": 1 } }];
    const table = retentionTable(weeks, users, { today: "2026-09-30" });
    expect(table).toEqual([
      { cohort: "2026-W40", size: 1, weeks: [null, null, null, null] },
      { cohort: "2026-W39", size: 2, weeks: [1, null, null, null] },
    ]);
  });

  it("formats money per currency from minor units", () => {
    expect(formatMoney({ eur: 1499 })).toMatch(/14[.,]99/);
    expect(formatMoney({})).toBe("—");
    expect(formatMoney({ zzz: 100 })).toMatch(/1[.,]00/);
  });

  it("maps a route to its dashboard feature, the longest prefix winning", () => {
    expect(dashboardFeatureIdForPath("/dashboard/grammar/text")).toBe("grammar");
    expect(dashboardFeatureIdForPath("/dashboard/challenges/hangman/")).toBe("challenges");
    expect(dashboardFeatureIdForPath("/dashboard/story-generator")).toBe("story_generator");
    expect(dashboardFeatureIdForPath("/dashboard")).toBeUndefined();
    expect(dashboardFeatureIdForPath("/dashboard/grammarx")).toBeUndefined();
    expect(dashboardFeatureIdForPath("/settings")).toBeUndefined();
  });
});

describe("pulseReportService", () => {
  let fetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    __resetPulseReports();
    firebaseMock.auth.currentUser = currentUser;
    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const sentBodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));

  it("batches events into one request after a short wait", async () => {
    reportActive();
    reportFeatureOpen("story_generator");
    reportLockedAttempt("ai_tutor");
    reportLiveSeconds(61.6);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth$/);
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.keepalive).toBe(true);
    expect(sentBodies()[0]).toEqual({
      action: "pulse",
      events: [
        { type: "active" },
        { type: "open", feature: "story_generator" },
        { type: "locked", feature: "ai_tutor" },
        { type: "liveSeconds", seconds: 62 },
      ],
    });
  });

  it("counts moving around inside one feature once, and ignores routes with none", async () => {
    reportFeatureOpen("grammar");
    reportFeatureOpen("grammar");
    reportFeatureOpen(undefined);
    reportFeatureOpen("story_generator");
    reportFeatureOpen("grammar");
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
    expect(sentBodies()[0].events.map((e) => e.feature)).toEqual(["grammar", "story_generator", "grammar"]);
  });

  it("sends a full batch at once, never more than the server accepts", async () => {
    for (let i = 0; i < MAX_BATCH + 1; i += 1) reportLockedAttempt(`f${i}`);
    await vi.advanceTimersByTimeAsync(0);
    expect(sentBodies()[0].events).toHaveLength(MAX_BATCH);
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
    expect(sentBodies()[1].events).toHaveLength(1);
  });

  it("reports nothing for a guest or a signed-out visitor, and nothing meaningless", async () => {
    firebaseMock.auth.currentUser = { isAnonymous: true, getIdToken: () => Promise.resolve("anon") };
    reportActive();
    firebaseMock.auth.currentUser = null;
    reportActive();
    firebaseMock.auth.currentUser = currentUser;
    reportLiveSeconds(0);
    reportLiveSeconds(Number.NaN);
    reportLockedAttempt("");
    flushPulse();
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("swallows a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    reportActive();
    flushPulse();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("acquisition", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps the first touch of the session: referrer host, campaign tags, path without query", () => {
    captureAcquisition({
      href: "https://app.example/pricing?utm_source=instagram&utm_medium=social&utm_campaign=launch&email=x@y.z",
      referrer: "https://www.google.com/search?q=learn+portuguese",
    });
    captureAcquisition({ href: "https://app.example/other?utm_source=later", referrer: "https://later.example/" });

    expect(readAcquisition()).toEqual({
      referrerHost: "www.google.com",
      utmSource: "instagram",
      utmMedium: "social",
      utmCampaign: "launch",
      landingPath: "/pricing",
    });
    expect(sessionStorage.getItem(ACQUISITION_KEY)).not.toContain("learn");
    expect(sessionStorage.getItem(ACQUISITION_KEY)).not.toContain("x@y.z");
  });

  it("does not treat a link from inside the app as a referrer", () => {
    captureAcquisition({ href: "https://app.example/", referrer: "https://app.example/pricing" });
    expect(readAcquisition().referrerHost).toBeUndefined();
  });

  it("forgets it once sent, and never throws on a broken referrer", () => {
    captureAcquisition({ href: "https://app.example/", referrer: "not a url" });
    expect(readAcquisition()).toBeUndefined();
    captureAcquisition({ href: "https://app.example/", referrer: "" });
    clearAcquisition();
    expect(readAcquisition()).toBeUndefined();
  });
});
