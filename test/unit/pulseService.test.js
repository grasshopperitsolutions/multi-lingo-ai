import { describe, it, expect, vi, beforeEach } from "vitest";

const queryCollection = vi.fn();
vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...args) => queryCollection(...args),
}));
vi.mock("../../src/services/userService", () => ({
  listAllUserProfiles: () => Promise.resolve([{ uid: "u1" }]),
}));
vi.mock("../../src/services/tiersConfigService", () => ({
  getTiersConfig: () => Promise.resolve({ explorer: { id: "explorer" } }),
}));
vi.mock("../../src/services/reportService", () => ({
  getReports: () => Promise.resolve([]),
}));

const { loadPulseData, PULSE_SOURCES } = await import("../../src/services/pulseService");

describe("loadPulseData", () => {
  beforeEach(() => {
    queryCollection.mockReset();
    queryCollection.mockImplementation((collection) => Promise.resolve({ documents: [{ id: `${collection}-1` }] }));
  });

  it("asks every collection for only the fields it counts", async () => {
    const data = await loadPulseData("token");

    for (const [key, source] of Object.entries(PULSE_SOURCES)) {
      expect(queryCollection).toHaveBeenCalledWith(
        source.collection,
        {},
        expect.objectContaining({ select: source.select }),
        "token",
      );
      expect(data[key]).toEqual([{ id: `${source.collection}-1` }]);
    }
    expect(data.users).toEqual([{ uid: "u1" }]);
    expect(data.errors).toEqual({});
  });

  it("never asks for the heavy or private fields of the collections that hold them", () => {
    expect(PULSE_SOURCES.ttsClips.select).not.toContain("audioData");
    expect(PULSE_SOURCES.mailQueue.select).toEqual(expect.not.arrayContaining(["to", "subject", "html", "text"]));
    expect(PULSE_SOURCES.contactSubmissions.select).toEqual(["createdAt"]);
  });

  it("lets an optional collection fail alone", async () => {
    queryCollection.mockImplementation((collection) =>
      collection === "ttsClips"
        ? Promise.reject(new Error("too large"))
        : Promise.resolve({ documents: [] }),
    );

    const data = await loadPulseData("token");

    expect(data.ttsClips).toEqual([]);
    expect(data.errors).toEqual({ ttsClips: "too large" });
  });

  it("fails the page when a required collection cannot be read", async () => {
    queryCollection.mockImplementation((collection) =>
      collection === "stories" ? Promise.reject(new Error("no stories")) : Promise.resolve({ documents: [] }),
    );

    await expect(loadPulseData("token")).rejects.toThrow("no stories");
  });
});
