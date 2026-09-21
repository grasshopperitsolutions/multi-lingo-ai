import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * recordingStore — the one take this browser keeps.
 *
 * Three things here are promises rather than conveniences, because §2.6 of the
 * privacy policy now describes them: only the most recent take is held, it is
 * dropped after a day, and a browser that refuses to store it degrades quietly
 * instead of taking the page down.
 */

/** A minimal in-memory IndexedDB, enough for one keyed object store. */
function fakeIndexedDb() {
  const data = new Map();
  let failMode = null;

  const request = (result) => {
    const req = { result, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      if (failMode === "op") req.onerror?.();
      else req.onsuccess?.();
    });
    return req;
  };

  return {
    data,
    setFailMode: (mode) => { failMode = mode; },
    open() {
      const req = { result: null, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (failMode === "open") {
          req.error = new Error("blocked");
          req.onerror?.();
          return;
        }
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => {},
          close: () => {},
          transaction() {
            const tx = { oncomplete: null };
            queueMicrotask(() => tx.oncomplete?.());
            return {
              ...tx,
              objectStore: () => ({
                put: (value, key) => { data.set(key, value); return request(undefined); },
                get: (key) => request(data.get(key)),
                delete: (key) => { data.delete(key); return request(undefined); },
              }),
            };
          },
        };
        req.onsuccess?.();
      });
      return req;
    },
  };
}

let db;

beforeEach(() => {
  db = fakeIndexedDb();
  vi.stubGlobal("indexedDB", db);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const store = () => import("../../src/utils/recordingStore");
const take = (overrides = {}) => ({
  blob: new Blob(["audio"], { type: "audio/webm" }),
  mimeType: "audio/webm",
  passage: { passageId: "p1", text: "Uma manhã fria." },
  ...overrides,
});

describe("keeping one take", () => {
  it("saves and gives it back with its passage", async () => {
    const { saveTake, loadTake } = await store();

    expect(await saveTake(take())).toBe(true);
    const restored = await loadTake();

    // The passage rides along because a recording with nothing to compare it
    // against is no use, and there would be nothing left to read either.
    expect(restored.passage).toEqual({ passageId: "p1", text: "Uma manhã fria." });
    expect(restored.mimeType).toBe("audio/webm");
  });

  it("keeps only the most recent one", async () => {
    const { saveTake, loadTake } = await store();

    await saveTake(take({ passage: { passageId: "p1" } }));
    await saveTake(take({ passage: { passageId: "p2" } }));

    // A history of takes is a pile of recordings of somebody's voice sitting
    // on their laptop, which is the opposite of what the feature promises.
    expect(db.data.size).toBe(1);
    expect((await loadTake()).passage.passageId).toBe("p2");
  });

  it("returns nothing when there is nothing", async () => {
    const { loadTake } = await store();
    expect(await loadTake()).toBeNull();
  });

  it("clears on request", async () => {
    const { saveTake, loadTake, clearTake } = await store();
    await saveTake(take());

    await clearTake();

    expect(await loadTake()).toBeNull();
  });
});

describe("not outstaying its welcome", () => {
  it("drops a take older than a day, and deletes it on the way out", async () => {
    const { saveTake, loadTake } = await store();
    await saveTake(take());

    // Expiry is enforced on read: there is no background job here, and a
    // recording from last week resurfacing would be a surprise.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);

    expect(await loadTake()).toBeNull();
    expect(db.data.size).toBe(0);
  });

  it("still returns one from an hour ago", async () => {
    const { saveTake, loadTake } = await store();
    await saveTake(take());

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60 * 60 * 1000);

    expect(await loadTake()).not.toBeNull();
  });
});

describe("when the browser will not store it", () => {
  it("reports a refused save rather than throwing", async () => {
    // IndexedDB throws outright in a private window on some browsers, and is
    // switched off entirely by some privacy settings.
    db.setFailMode("open");
    const { saveTake } = await store();

    await expect(saveTake(take())).resolves.toBe(false);
  });

  it("loads as empty rather than throwing", async () => {
    db.setFailMode("open");
    const { loadTake } = await store();

    // Losing the ability to restore a take is a small loss. Taking the page
    // down with it would not be.
    await expect(loadTake()).resolves.toBeNull();
  });

  it("survives a browser with no IndexedDB at all", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const { saveTake, loadTake, clearTake } = await store();

    expect(await saveTake(take())).toBe(false);
    expect(await loadTake()).toBeNull();
    expect(await clearTake()).toBe(false);
  });
});
