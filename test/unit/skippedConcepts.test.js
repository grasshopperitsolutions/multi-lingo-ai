import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  getSkippedConceptIds,
  addSkippedConceptId,
  clearSkippedConceptIds,
} from "../../src/utils/skippedConcepts";

/**
 * Skipped concepts.
 *
 * The whole point is the difference from *seen*, and it is a difference
 * somebody will eventually try to collapse. A seen word is finished with, lives
 * on the profile and is gone from the pool on every device forever. A skipped
 * word is one you could not attempt yet — the commonest case being a script you
 * cannot read at all — so it stays in the pool and only this browser declines
 * to offer it. Marking a skip as seen would quietly delete a word the learner
 * specifically wants back later.
 */

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("remembering a skip", () => {
  it("keeps it, and gives it back", () => {
    addSkippedConceptId("c1", "ja-Hira");

    expect(getSkippedConceptIds("ja-Hira")).toEqual(["c1"]);
  });

  it("does not duplicate the same id", () => {
    addSkippedConceptId("c1", "ja-Hira");
    addSkippedConceptId("c1", "ja-Hira");

    expect(getSkippedConceptIds("ja-Hira")).toEqual(["c1"]);
  });

  it("keeps dialects apart", () => {
    addSkippedConceptId("c1", "ja-Hira");

    // Skipping a kanji compound says nothing about a Portuguese word, and the
    // pool itself is per dialect.
    expect(getSkippedConceptIds("pt-PT")).toEqual([]);
  });

  it("ignores an empty id rather than storing a blank", () => {
    addSkippedConceptId("", "ja-Hira");
    addSkippedConceptId(undefined, "ja-Hira");

    expect(getSkippedConceptIds("ja-Hira")).toEqual([]);
  });

  it("drops the oldest past the cap", () => {
    for (let i = 0; i < 205; i += 1) addSkippedConceptId(`c${i}`, "ja-Hira");

    const stored = getSkippedConceptIds("ja-Hira");
    // A convenience list, not a record: unbounded growth in a place nothing
    // prunes, and a word skipped two hundred words ago deserves another go.
    expect(stored).toHaveLength(200);
    expect(stored).not.toContain("c0");
    expect(stored).toContain("c204");
  });

  it("forgets everything on a reset", () => {
    addSkippedConceptId("c1", "ja-Hira");
    addSkippedConceptId("c2", "ja-Hira");

    clearSkippedConceptIds("ja-Hira");

    expect(getSkippedConceptIds("ja-Hira")).toEqual([]);
  });
});

describe("when storage misbehaves", () => {
  it("reads an empty list rather than throwing on junk", () => {
    localStorage.setItem("skippedConcepts:ja-Hira", "not json at all");

    expect(getSkippedConceptIds("ja-Hira")).toEqual([]);
  });

  it("ignores a stored value of the wrong shape", () => {
    localStorage.setItem("skippedConcepts:ja-Hira", JSON.stringify({ nope: true }));

    expect(getSkippedConceptIds("ja-Hira")).toEqual([]);
  });

  it("filters out non-string entries", () => {
    localStorage.setItem("skippedConcepts:ja-Hira", JSON.stringify(["c1", 42, null]));

    expect(getSkippedConceptIds("ja-Hira")).toEqual(["c1"]);
  });

  it("survives a browser that refuses to write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    // The skip then lasts only as long as the request that follows it, which
    // is a smaller loss than failing the button press.
    expect(() => addSkippedConceptId("c1", "ja-Hira")).not.toThrow();
  });

  it("survives a browser that refuses to read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(getSkippedConceptIds("ja-Hira")).toEqual([]);
  });
});
