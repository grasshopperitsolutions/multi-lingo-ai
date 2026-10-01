import { describe, it, expect, vi } from "vitest";
import { isChunkLoadError, reloadForNewVersion } from "../../src/utils/staleDeploy";

/**
 * An app loaded before a deploy asks for page files the deploy removed. It
 * reloads once for the new version, and never twice in a row: a file still
 * missing after a reload means the deploy itself is broken.
 */

const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  };
};

describe("isChunkLoadError", () => {
  it("recognises a missing page file in every browser's wording", () => {
    expect(isChunkLoadError(new TypeError(
      "Failed to fetch dynamically imported module: https://multi-lingo.online/assets/ChallengesMenu-ESWg3ffF.js",
    ))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: https://x/a.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("leaves every other error alone", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("reloadForNewVersion", () => {
  it("reloads once, then refuses while that reload is recent", () => {
    const storage = memoryStorage();
    const reload = vi.fn();

    expect(reloadForNewVersion({ now: 1_000_000, storage, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    // Still missing straight after the reload: the deploy is broken, so stop.
    expect(reloadForNewVersion({ now: 1_005_000, storage, reload })).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);

    // A later deploy, much later, gets its own reload.
    expect(reloadForNewVersion({ now: 1_020_000, storage, reload })).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("never reloads without storage to guard against a loop", () => {
    const reload = vi.fn();
    const storage = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("SecurityError"); },
    };

    expect(reloadForNewVersion({ now: 1, storage, reload })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
