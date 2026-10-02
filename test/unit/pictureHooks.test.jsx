import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { makePool, translationsFor, signedInContext, pictureUrl } from "../helpers/pictureFixtures";

/**
 * The hooks under the picture games: the album's stickers (loaded, collected,
 * written back debounced), the seen-concept rule (marked on a right answer,
 * written back debounced), and the round (which unseen words, in what order, and
 * how it gets more when the player has run short).
 */

const ctx = { current: signedInContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const getAlbumStickers = vi.fn(async () => []);
const saveAlbumStickers = vi.fn(async () => {});
const getGlobalSeenIds = vi.fn(async () => []);
const markConceptsSeenGlobal = vi.fn(async () => {});
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  getAlbumStickers: (...a) => getAlbumStickers(...a),
  saveAlbumStickers: (...a) => saveAlbumStickers(...a),
  getGlobalSeenIds: (...a) => getGlobalSeenIds(...a),
  markConceptsSeenGlobal: (...a) => markConceptsSeenGlobal(...a),
}));

const getPicturePool = vi.fn();
const requestPicture = vi.fn();
vi.mock("../../src/services/getImageService", async (importOriginal) => ({
  ...(await importOriginal()),
  getPicturePool: (...a) => getPicturePool(...a),
  requestPicture: (...a) => requestPicture(...a),
}));

const getConceptTranslations = vi.fn();
const ensureConceptTranslation = vi.fn();
const generateNewConcept = vi.fn();
vi.mock("../../src/services/getWordService", () => ({
  getConceptTranslations: (...a) => getConceptTranslations(...a),
  ensureConceptTranslation: (...a) => ensureConceptTranslation(...a),
  generateNewConcept: (...a) => generateNewConcept(...a),
  getWord: vi.fn(),
  getWordPoolCount: vi.fn(),
}));

/** A promise settled from outside, to hold a call open while the test looks. */
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

/** The word a growth step gives a concept: recognisably not one of the pool's own. */
const grownWord = (id) => `NOVA_${id}`;
const limitError = () => Object.assign(new Error("limit"), { code: "DAILY_LIMIT" });

beforeEach(() => {
  ctx.current = signedInContext();
  for (const mock of [
    getAlbumStickers,
    saveAlbumStickers,
    getGlobalSeenIds,
    markConceptsSeenGlobal,
    getPicturePool,
    requestPicture,
    getConceptTranslations,
    ensureConceptTranslation,
    generateNewConcept,
  ]) {
    mock.mockReset();
  }
  getAlbumStickers.mockResolvedValue([]);
  saveAlbumStickers.mockResolvedValue(undefined);
  getGlobalSeenIds.mockResolvedValue([]);
  markConceptsSeenGlobal.mockResolvedValue(undefined);
  // Growing works unless a test says otherwise: a word, a picture, and nothing
  // new to invent.
  ensureConceptTranslation.mockImplementation(async ({ conceptId }) => ({ word: grownWord(conceptId), baseForm: null }));
  requestPicture.mockImplementation(async (id) => ({ status: "ready", url: pictureUrl(id) }));
  generateNewConcept.mockRejectedValue(new Error("no new concept"));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ── useAlbumStickers ─────────────────────────────────────────────────────────

describe("useAlbumStickers", () => {
  const hook = async () => {
    const { useAlbumStickers } = await import("../../src/hooks/useAlbumStickers");
    return renderHook(() => useAlbumStickers());
  };

  it("loads the album for the player's practice language", async () => {
    getAlbumStickers.mockResolvedValue(["c1", "c2"]);
    const { result } = await hook();

    expect(result.current.isLoaded).toBe(false);
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    expect(getAlbumStickers).toHaveBeenCalledWith("tok", "u1", "pt-PT");
    expect([...result.current.stickers].sort()).toEqual(["c1", "c2"]);
  });

  it("says which stickers are new, and nothing for one already collected", async () => {
    getAlbumStickers.mockResolvedValue(["c1"]);
    const { result } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    let fresh;
    act(() => {
      fresh = result.current.collect(["c1", "c2", "c2", "", null]);
    });

    expect(fresh).toEqual(["c2"]);
    expect(result.current.stickers.has("c2")).toBe(true);
    act(() => {
      fresh = result.current.collect(["c2"]);
    });
    expect(fresh).toEqual([]);
  });

  it("writes the whole list once, a moment after the last sticker: four taps are one write", async () => {
    getAlbumStickers.mockResolvedValue(["c1"]);
    const { result } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    vi.useFakeTimers();

    act(() => {
      for (const id of ["c2", "c3", "c4", "c5"]) result.current.collect([id]);
    });
    expect(saveAlbumStickers).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(saveAlbumStickers).toHaveBeenCalledTimes(1);
    expect(saveAlbumStickers).toHaveBeenCalledWith("tok", "u1", "pt-PT", expect.arrayContaining(["c1", "c2", "c3", "c4", "c5"]));
    expect(saveAlbumStickers.mock.calls[0][3]).toHaveLength(5);
  });

  it("writes nothing when nothing is new", async () => {
    getAlbumStickers.mockResolvedValue(["c1"]);
    const { result } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    vi.useFakeTimers();

    act(() => {
      result.current.collect(["c1"]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(saveAlbumStickers).not.toHaveBeenCalled();
  });

  it("keeps a sticker earned before the album had loaded, and saves it with the rest", async () => {
    let resolveAlbum;
    getAlbumStickers.mockReturnValue(new Promise((resolve) => (resolveAlbum = resolve)));
    const { result } = await hook();

    let fresh;
    act(() => {
      fresh = result.current.collect(["early"]);
    });
    expect(fresh).toEqual(["early"]);
    expect(result.current.isLoaded).toBe(false);

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => {
      resolveAlbum(["c1"]);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.isLoaded).toBe(true);
    expect([...result.current.stickers].sort()).toEqual(["c1", "early"]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(saveAlbumStickers.mock.calls[0][3].sort()).toEqual(["c1", "early"]);
  });

  it("does not report the same early sticker twice", async () => {
    getAlbumStickers.mockReturnValue(new Promise(() => {}));
    const { result } = await hook();
    let first;
    let second;
    act(() => {
      first = result.current.collect(["early"]);
      second = result.current.collect(["early"]);
    });
    expect(first).toEqual(["early"]);
    expect(second).toEqual([]);
  });

  it("writes straight away when the player leaves", async () => {
    const { result, unmount } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.collect(["c9"]);
    });
    expect(saveAlbumStickers).not.toHaveBeenCalled();

    unmount();

    expect(saveAlbumStickers).toHaveBeenCalledWith("tok", "u1", "pt-PT", ["c9"]);
  });

  it("writes straight away when the page goes to the background", async () => {
    const { result } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.collect(["c9"]);
    });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    await waitFor(() => expect(saveAlbumStickers).toHaveBeenCalledTimes(1));
  });

  it("does not show a failed save, and writes the whole list again with the next sticker", async () => {
    saveAlbumStickers.mockRejectedValueOnce(new Error("offline"));
    const { result } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    vi.useFakeTimers();

    act(() => {
      result.current.collect(["c1"]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(saveAlbumStickers).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.collect(["c2"]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(saveAlbumStickers).toHaveBeenCalledTimes(2);
    expect(saveAlbumStickers.mock.calls[1][3].sort()).toEqual(["c1", "c2"]);
  });

  it("writes a sticker under the language it was earned in, even if the language changes before the save", async () => {
    getAlbumStickers.mockResolvedValue([]);
    const { useAlbumStickers } = await import("../../src/hooks/useAlbumStickers");
    const { result, rerender } = renderHook(() => useAlbumStickers());
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.collect(["c1"]);
    });
    // Before the debounce fires, they switch language.
    ctx.current = signedInContext({ user: { learningDialect: "fr-FR" } });
    rerender();

    await waitFor(() => expect(saveAlbumStickers).toHaveBeenCalledTimes(1));
    // The old language's sticker goes to the old language's album, not the new one.
    expect(saveAlbumStickers).toHaveBeenCalledWith("tok", "u1", "pt-PT", ["c1"]);
  });

  it("starts an empty album when the saved one cannot be read, rather than failing the game", async () => {
    getAlbumStickers.mockRejectedValue(new Error("down"));
    const { result } = await hook();
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.stickers.size).toBe(0);
  });

  it("is filed by practice language: a new language starts with an empty album", async () => {
    getAlbumStickers.mockImplementation(async (_t, _u, dialect) => (dialect === "pt-PT" ? ["c1"] : []));
    const { useAlbumStickers } = await import("../../src/hooks/useAlbumStickers");
    const { result, rerender } = renderHook(() => useAlbumStickers());
    await waitFor(() => expect(result.current.stickers?.size).toBe(1));

    ctx.current = signedInContext({ user: { learningDialect: "fr-FR" } });
    rerender();

    await waitFor(() => expect(getAlbumStickers).toHaveBeenCalledWith("tok", "u1", "fr-FR"));
    await waitFor(() => expect(result.current.stickers?.size).toBe(0));
  });
});

// ── useSeenConcepts ──────────────────────────────────────────────────────────

describe("useSeenConcepts", () => {
  const hook = async () => {
    const { useSeenConcepts } = await import("../../src/hooks/useSeenConcepts");
    return renderHook(() => useSeenConcepts());
  };

  it("writes a right answer a moment later, merged with the list stored at that moment", async () => {
    vi.useFakeTimers();
    getGlobalSeenIds.mockResolvedValue(["old"]);
    const { result } = await hook();

    act(() => result.current.markSeen(["c1"]));
    act(() => result.current.markSeen(["c2"]));
    expect(markConceptsSeenGlobal).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    // Four right answers are one write, and the stored list was read again just
    // before it, so a word marked in another game meanwhile is not lost.
    expect(markConceptsSeenGlobal).toHaveBeenCalledTimes(1);
    expect(markConceptsSeenGlobal).toHaveBeenCalledWith("tok", "u1", ["c1", "c2"], ["old"]);
  });

  it("knows what was marked in this visit before the write has landed", async () => {
    const { result } = await hook();
    act(() => result.current.markSeen(["c1"]));
    expect([...result.current.seenThisSession()]).toEqual(["c1"]);
  });

  it("writes nothing when every word was already stored", async () => {
    vi.useFakeTimers();
    getGlobalSeenIds.mockResolvedValue(["c1"]);
    const { result } = await hook();

    act(() => result.current.markSeen(["c1"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(getGlobalSeenIds).toHaveBeenCalled();
    expect(markConceptsSeenGlobal).not.toHaveBeenCalled();
  });

  it("ignores a word marked twice, and an empty call", async () => {
    vi.useFakeTimers();
    const { result } = await hook();

    act(() => result.current.markSeen(["c1", "c1", "", null]));
    act(() => result.current.markSeen(["c1"]));
    act(() => result.current.markSeen([]));
    act(() => result.current.markSeen(undefined));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(markConceptsSeenGlobal).toHaveBeenCalledTimes(1);
    expect(markConceptsSeenGlobal.mock.calls[0][2]).toEqual(["c1"]);
  });

  it("writes straight away when the player leaves", async () => {
    const { result, unmount } = await hook();
    act(() => result.current.markSeen(["c1"]));
    expect(markConceptsSeenGlobal).not.toHaveBeenCalled();

    unmount();

    await waitFor(() => expect(markConceptsSeenGlobal).toHaveBeenCalledTimes(1));
  });

  it("writes straight away when the page goes to the background", async () => {
    const { result } = await hook();
    act(() => result.current.markSeen(["c1"]));

    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });

    await waitFor(() => expect(markConceptsSeenGlobal).toHaveBeenCalledTimes(1));
  });

  it("does not show a failed save, and sends the words again with the next one", async () => {
    vi.useFakeTimers();
    markConceptsSeenGlobal.mockRejectedValueOnce(new Error("offline"));
    const { result } = await hook();

    act(() => result.current.markSeen(["c1"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    expect(markConceptsSeenGlobal).toHaveBeenCalledTimes(1);

    act(() => result.current.markSeen(["c2"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(markConceptsSeenGlobal).toHaveBeenCalledTimes(2);
    expect(markConceptsSeenGlobal.mock.calls[1][2].sort()).toEqual(["c1", "c2"]);
  });

  it("writes nothing for a player who is not signed in", async () => {
    vi.useFakeTimers();
    ctx.current = signedInContext({ user: { token: undefined } });
    const { result } = await hook();

    act(() => result.current.markSeen(["c1"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(markConceptsSeenGlobal).not.toHaveBeenCalled();
  });
});

// ── usePictureRound ──────────────────────────────────────────────────────────

describe("usePictureRound", () => {
  /**
   * A pool of `count` pictured concepts, `c0`…, with words for all but `skip`.
   * `seen` is what the player's profile says they have met.
   */
  const setUpWorld = ({ count = 20, topics = [], skip = [], unpictured = [], seen = [] } = {}) => {
    const pool = makePool(count, { topics });
    getPicturePool.mockResolvedValue({ pictured: pool, unpictured });
    getGlobalSeenIds.mockResolvedValue(seen);
    const words = translationsFor(pool, { skip });
    getConceptTranslations.mockImplementation(async (ids) => new Map([...words].filter(([id]) => ids.includes(id))));
    return pool;
  };

  const fresh = (...ids) => ids.map((id) => ({ id, sourceWord: `src-${id}`, topicIds: [], pos: null }));

  const round = async (options = { want: 6, minWords: 4 }) => {
    const { usePictureRound, clearRecentWords } = await import("../../src/hooks/usePictureRound");
    clearRecentWords();
    return renderHook(() => usePictureRound(options));
  };

  /** A background top-up is over: nothing is being fetched. */
  const idle = (result) => waitFor(() => expect(result.current.isFilling).toBe(false));

  const idsOf = (words) => words.map((word) => word.conceptId);

  it("gathers the words a round needs, each with its picture and its word", async () => {
    setUpWorld();
    const { result } = await round({ want: 6, poolSize: 12, minWords: 4 });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.words).toHaveLength(6);
    expect(result.current.pool.length).toBeGreaterThanOrEqual(12);
    for (const word of result.current.words) {
      expect(word.word).toMatch(/^PALAVRA\d+$/);
      expect(word.url).toBe(pictureUrl(word.conceptId));
      expect(word.sourceWord).toBe(`thing${word.conceptId.slice(1)}`);
    }
    expect(new Set(idsOf(result.current.words)).size).toBe(6);
    expect(result.current.pool.some((word) => word.seen)).toBe(false);
  });

  it("reads words a batch at a time and stops once it has enough, not for the whole pool", async () => {
    setUpWorld({ count: 200 });
    const { result } = await round({ want: 8, poolSize: 16, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const asked = getConceptTranslations.mock.calls.flatMap(([ids]) => ids);
    // 200 concepts are pictured; a round of 8 with 16 to choose from reads a batch or two.
    expect(asked.length).toBeLessThanOrEqual(48);
    expect(getConceptTranslations.mock.calls[0][0].length).toBeLessThanOrEqual(24);
  });

  it("starts from the words that already have a word in this language, and fetches the rest in the background", async () => {
    setUpWorld({ count: 10, skip: ["c0", "c1", "c2"] });
    const { result } = await round({ want: 7, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const ids = idsOf(result.current.pool);
    expect(ids).not.toContain("c0");
    expect(ids).toHaveLength(7);
    await idle(result);
  });

  describe("the seen rule", () => {
    it("never makes a word the answer that the player has already seen", async () => {
      setUpWorld({ count: 20, seen: Array.from({ length: 10 }, (_, i) => `c${i}`) });
      const { result } = await round({ want: 6, poolSize: 6, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(result.current.words).toHaveLength(6);
      for (const id of idsOf(result.current.words)) expect(Number(id.slice(1))).toBeGreaterThanOrEqual(10);
      await idle(result);
    });

    it("makes up the pool with words already seen, marked as such, for wrong options", async () => {
      // Ten words, six seen: four are new, and the rest of the pool is the six.
      setUpWorld({ count: 10, seen: ["c0", "c1", "c2", "c3", "c4", "c5"] });
      const { result } = await round({ want: 4, poolSize: 10, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(idsOf(result.current.words).sort()).toEqual(["c6", "c7", "c8", "c9"]);
      expect(result.current.pool).toHaveLength(10);
      expect(idsOf(result.current.pool.filter((word) => word.seen)).sort()).toEqual(["c0", "c1", "c2", "c3", "c4", "c5"]);
      expect(result.current.words.some((word) => word.seen)).toBe(false);
      await idle(result);
    });

    it("adds no seen words to a round that wants only its own", async () => {
      setUpWorld({ count: 12, seen: ["c0", "c1", "c2", "c3"] });
      const { result } = await round({ want: 6, poolSize: 6, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      // Words are read a batch at a time, so the pool may hold more than asked
      // for; what matters is that none of them is a word already seen.
      expect(result.current.pool.length).toBeGreaterThanOrEqual(6);
      expect(idsOf(result.current.pool).every((id) => Number(id.slice(1)) >= 4)).toBe(true);
      expect(result.current.pool.some((word) => word.seen)).toBe(false);
      await idle(result);
    });

    it("also leaves out what was just got right, before the write has landed", async () => {
      // The stored list still says nothing (the write is a moment behind), so only
      // this visit's own record keeps the four words from coming straight back.
      setUpWorld({ count: 4 });
      generateNewConcept.mockImplementation(async () => {
        const n = generateNewConcept.mock.calls.length;
        return { conceptId: `n${n}`, word: `NOVA${n}`, sourceWord: `new${n}`, topicIds: [] };
      });
      const { result } = await round({ want: 4, poolSize: 4, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      const first = idsOf(result.current.words);
      expect([...first].sort()).toEqual(["c0", "c1", "c2", "c3"]);
      await idle(result);

      act(() => result.current.markSeen(first));
      act(() => result.current.newRound());
      await waitFor(() => expect(result.current.roundId).toBe(2));

      expect(result.current.status).toBe("ready");
      expect(idsOf(result.current.words).every((id) => id.startsWith("n"))).toBe(true);
      await idle(result);
    });

    it("carries on when the seen list cannot be read: the worst case is a repeat", async () => {
      setUpWorld({ count: 12 });
      getGlobalSeenIds.mockRejectedValue(new Error("down"));
      const { result } = await round({ want: 6, poolSize: 6, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(result.current.words).toHaveLength(6);
      await idle(result);
    });

    it("hands markSeen to the game, the same one every render", async () => {
      setUpWorld({ count: 30 });
      const { result, rerender } = await round({ want: 6, poolSize: 14, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      const first = result.current.markSeen;
      rerender();
      expect(result.current.markSeen).toBe(first);
    });
  });

  describe("getting more words", () => {
    it("says it is preparing while a player who has run short is given enough to start", async () => {
      // Two of six have a word; the game needs four. Two more are translated.
      setUpWorld({ count: 6, skip: ["c0", "c1", "c2", "c3"] });
      const gate = deferred();
      ensureConceptTranslation.mockImplementation(async ({ conceptId }) => {
        await gate.promise;
        return { word: grownWord(conceptId), baseForm: null };
      });

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("preparing"));
      expect(result.current.words).toEqual([]);

      gate.resolve();
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(ensureConceptTranslation).toHaveBeenCalledTimes(2);
      expect(ensureConceptTranslation.mock.calls[0][0]).toMatchObject({
        userDialect: "pt-PT",
        learningDialect: "pt-PT",
        token: "tok",
      });
      expect(result.current.pool).toHaveLength(4);
      expect(result.current.pool.filter((word) => word.word.startsWith("NOVA_"))).toHaveLength(2);
      await idle(result);
    });

    it("gives a word a picture already drawn before it asks for one to be drawn", async () => {
      setUpWorld({ count: 6, skip: ["c5"] });
      const { result } = await round({ want: 2, minWords: 6 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(ensureConceptTranslation).toHaveBeenCalledTimes(1);
      expect(ensureConceptTranslation.mock.calls[0][0].conceptId).toBe("c5");
      expect(requestPicture).not.toHaveBeenCalled();
      expect(generateNewConcept).not.toHaveBeenCalled();
      await idle(result);
    });

    it("draws a picture for a concept that has none, after getting its word", async () => {
      setUpWorld({ count: 2, unpictured: fresh("u1", "u2", "u3") });
      const events = [];
      ensureConceptTranslation.mockImplementation(async ({ conceptId }) => {
        events.push(`word:${conceptId}`);
        return { word: grownWord(conceptId), baseForm: null };
      });
      requestPicture.mockImplementation(async (id) => {
        events.push(`picture:${id}`);
        return { status: "ready", url: pictureUrl(id) };
      });

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      // The word first: a picture is the dear call, and is not spent on a concept
      // this player could not be given a word for.
      expect(events).toHaveLength(4);
      expect(events[0]).toMatch(/^word:u\d$/);
      expect(events[1]).toBe(events[0].replace("word:", "picture:"));
      expect(events[2]).toMatch(/^word:u\d$/);
      expect(events[3]).toBe(events[2].replace("word:", "picture:"));
      expect(requestPicture).toHaveBeenCalledWith(expect.stringMatching(/^u\d$/), "tok");

      const drawn = result.current.pool.filter((word) => word.conceptId.startsWith("u"));
      expect(drawn).toHaveLength(2);
      expect(drawn[0].url).toBe(pictureUrl(drawn[0].conceptId));
      expect(generateNewConcept).not.toHaveBeenCalled();
      await idle(result);
    });

    it("does not count a concept whose picture could not be drawn", async () => {
      setUpWorld({ count: 3, unpictured: fresh("u1", "u2", "u3") });
      requestPicture.mockImplementation(async (id) =>
        id === "u1" ? { status: "failed", url: null } : { status: "ready", url: pictureUrl(id) },
      );

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(idsOf(result.current.pool)).not.toContain("u1");
      expect(result.current.pool).toHaveLength(4);
      await idle(result);
    });

    it("invents new concepts when everything the pool holds has been seen", async () => {
      setUpWorld({ count: 4, seen: ["c0", "c1", "c2", "c3"] });
      let next = 0;
      generateNewConcept.mockImplementation(async () => {
        next += 1;
        return { conceptId: `n${next}`, word: `NOVA${next}`, sourceWord: `new${next}`, topicIds: ["animals"] };
      });

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(generateNewConcept).toHaveBeenCalledTimes(4);
      expect(generateNewConcept).toHaveBeenCalledWith(
        expect.objectContaining({ token: "tok", userDialect: "pt-PT", learningDialect: "pt-PT" }),
      );
      expect(requestPicture).toHaveBeenCalledTimes(4);
      expect(idsOf(result.current.words).every((id) => id.startsWith("n"))).toBe(true);
      // The new words carry what a picture game needs, and the seen four make up the options.
      expect(result.current.words[0]).toMatchObject({ topicIds: ["animals"], url: expect.stringContaining("conceptPictures/n") });
      expect(idsOf(result.current.pool.filter((word) => word.seen)).sort()).toEqual(["c0", "c1", "c2", "c3"]);
      await idle(result);
    });

    it("passes the player's interests when it invents one", async () => {
      ctx.current = signedInContext({ user: { interests: ["home"] } });
      setUpWorld({ count: 4, seen: ["c0", "c1", "c2", "c3"] });
      await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(generateNewConcept).toHaveBeenCalled());
      expect(generateNewConcept.mock.calls[0][0].topics).toEqual([expect.objectContaining({ id: "home" })]);
    });

    it("does not use a new concept that turns out to be one the player has already seen", async () => {
      // The pool's uniqueness check can answer an invention with a concept it already held.
      setUpWorld({ count: 4, seen: ["c0", "c1", "c2", "c3"] });
      let next = 0;
      generateNewConcept.mockImplementation(async () => {
        next += 1;
        return next === 1
          ? { conceptId: "c0", word: "PALAVRA0", sourceWord: "thing0", topicIds: [] }
          : { conceptId: `n${next}`, word: `NOVA${next}`, sourceWord: `new${next}`, topicIds: [] };
      });

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));

      expect(requestPicture).not.toHaveBeenCalledWith("c0", expect.anything());
      expect(idsOf(result.current.words).every((id) => id.startsWith("n"))).toBe(true);
      await idle(result);
    });

    it("stops asking for pictures once the account's cap is reached, and starts with what it has", async () => {
      setUpWorld({ count: 4, seen: ["c0", "c1", "c2", "c3"] });
      generateNewConcept.mockResolvedValue({ conceptId: "n1", word: "NOVA1", sourceWord: "new1", topicIds: [] });
      requestPicture.mockResolvedValue({ status: "error", url: null, code: "PICTURE_CAP" });

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("thin"));

      expect(generateNewConcept).toHaveBeenCalledTimes(1);
      expect(requestPicture).toHaveBeenCalledTimes(1);
    });

    it("stops when the day's AI calls are spent, and starts with what it has", async () => {
      setUpWorld({ count: 6, skip: ["c0", "c1", "c2", "c3"] });
      ensureConceptTranslation.mockRejectedValue(limitError());

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("thin"));

      expect(ensureConceptTranslation).toHaveBeenCalledTimes(1);
      expect(result.current.words).toHaveLength(2);
    });

    it("stops when the player declines to spend a call", async () => {
      setUpWorld({ count: 6, skip: ["c0", "c1", "c2", "c3"] });
      ensureConceptTranslation.mockRejectedValue(Object.assign(new Error("declined"), { declined: true }));

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("thin"));
      expect(ensureConceptTranslation).toHaveBeenCalledTimes(1);
    });

    it("gives up on inventing after a few failures in a row, rather than spending on", async () => {
      setUpWorld({ count: 4, seen: ["c0", "c1", "c2", "c3"] });
      generateNewConcept.mockRejectedValue(new Error("the model said no"));

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("thin"));

      expect(generateNewConcept).toHaveBeenCalledTimes(3);
      expect(requestPicture).not.toHaveBeenCalled();
    });

    it("goes past one word that cannot be translated", async () => {
      setUpWorld({ count: 6, skip: ["c0", "c1", "c2", "c3"] });
      ensureConceptTranslation.mockImplementation(async ({ conceptId }) => {
        if (conceptId === "c0") throw new Error("the model said no");
        return { word: grownWord(conceptId), baseForm: null };
      });

      const { result } = await round({ want: 2, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      expect(idsOf(result.current.pool)).not.toContain("c0");
      expect(result.current.pool).toHaveLength(4);
      await idle(result);
    });

    it("says there is not enough when nothing can be made, and starts with what exists", async () => {
      setUpWorld({ count: 3 });
      const { result } = await round({ want: 6, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("thin"));
      expect(result.current.words).toHaveLength(3);
    });
  });

  describe("keeping the next round supplied", () => {
    it("does not fetch anything when two rounds of unseen words are in hand", async () => {
      setUpWorld({ count: 30, unpictured: fresh("u1") });
      const { result } = await round({ want: 6, poolSize: 14, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      await act(async () => {});

      expect(ensureConceptTranslation).not.toHaveBeenCalled();
      expect(requestPicture).not.toHaveBeenCalled();
      expect(generateNewConcept).not.toHaveBeenCalled();
      expect(result.current.isFilling).toBe(false);
    });

    it("tops up in the background, a few at a time, while the round is already playable", async () => {
      // Five words, so the round starts; two rounds would be twelve.
      setUpWorld({ count: 5, unpictured: fresh("u1", "u2", "u3", "u4", "u5", "u6") });
      const gate = deferred();
      ensureConceptTranslation.mockImplementation(async ({ conceptId }) => {
        await gate.promise;
        return { word: grownWord(conceptId), baseForm: null };
      });

      const { result } = await round({ want: 6, minWords: 4 });
      await waitFor(() => expect(result.current.isFilling).toBe(true));

      // Playable at once: the top-up is not waited for.
      expect(result.current.status).toBe("ready");
      expect(result.current.words).toHaveLength(5);

      gate.resolve();
      await idle(result);

      // Four at most, and the round on screen is not changed under the player.
      expect(ensureConceptTranslation).toHaveBeenCalledTimes(4);
      expect(requestPicture).toHaveBeenCalledTimes(4);
      expect(result.current.words).toHaveLength(5);
    });

    it("starts the next round with what the top-up fetched", async () => {
      const pool = makePool(5);
      getPicturePool.mockResolvedValue({ pictured: pool, unpictured: fresh("u1", "u2", "u3", "u4") });
      getConceptTranslations.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { word: `P${id}`, baseForm: null }])));
      const { result } = await round({ want: 6, minWords: 4 });
      await waitFor(() => expect(result.current.status).toBe("ready"));
      await idle(result);

      // The picture pool now has them, as it would on a fresh read.
      getPicturePool.mockResolvedValue({
        pictured: [...pool, ...fresh("u1", "u2", "u3", "u4").map((u) => ({ ...u, url: pictureUrl(u.id), width: 1, height: 1 }))],
        unpictured: [],
      });
      act(() => result.current.newRound());
      await waitFor(() => expect(result.current.roundId).toBe(2));

      expect(result.current.words.length).toBeGreaterThanOrEqual(6);
      await idle(result);
    });

    it("does not start a second top-up while one is running, however many rounds are played", async () => {
      setUpWorld({ count: 5, unpictured: fresh("u1", "u2", "u3", "u4") });
      const gate = deferred();
      ensureConceptTranslation.mockImplementation(async ({ conceptId }) => {
        await gate.promise;
        return { word: grownWord(conceptId), baseForm: null };
      });
      const { result } = await round({ want: 6, minWords: 4 });
      await waitFor(() => expect(result.current.isFilling).toBe(true));
      await waitFor(() => expect(ensureConceptTranslation).toHaveBeenCalledTimes(1));

      act(() => result.current.newRound());
      await waitFor(() => expect(result.current.roundId).toBe(2));
      await act(async () => {});

      // Sequential: the first call is still held, and nothing else has started.
      expect(ensureConceptTranslation).toHaveBeenCalledTimes(1);

      gate.resolve();
      await idle(result);
    });

    it("stops a top-up when the player leaves, without starting another word for nobody", async () => {
      setUpWorld({ count: 5, unpictured: fresh("u1", "u2", "u3", "u4") });
      const gate = deferred();
      ensureConceptTranslation.mockImplementation(async ({ conceptId }) => {
        await gate.promise;
        return { word: grownWord(conceptId), baseForm: null };
      });
      const { result, unmount } = await round({ want: 6, minWords: 4 });
      await waitFor(() => expect(result.current.isFilling).toBe(true));

      unmount();
      gate.resolve();
      await act(async () => {});

      // The word in flight finished; nothing was drawn or started after it.
      expect(ensureConceptTranslation).toHaveBeenCalledTimes(1);
      expect(requestPicture).not.toHaveBeenCalled();
      expect(generateNewConcept).not.toHaveBeenCalled();
    });
  });

  it("puts the player's interests first", async () => {
    ctx.current = signedInContext({ user: { interests: ["home"] } });
    setUpWorld({ count: 20, topics: ["animals", "home"] });
    const { result } = await round({ want: 8, poolSize: 8, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // c0, c2, … are animals; c1, c3, … are home. Ten are home, enough for all eight.
    const odd = result.current.words.filter((w) => Number(w.conceptId.slice(1)) % 2 === 1);
    expect(odd).toHaveLength(8);
    await idle(result);
  });

  it("leans away from the words of the round just played", async () => {
    setUpWorld({ count: 24 });
    const { usePictureRound, clearRecentWords } = await import("../../src/hooks/usePictureRound");
    clearRecentWords();
    const { result } = renderHook(() => usePictureRound({ want: 8, poolSize: 8, minWords: 4 }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const first = idsOf(result.current.words);

    act(() => result.current.newRound());
    await waitFor(() => expect(result.current.roundId).toBe(2));
    expect(result.current.status).toBe("ready");

    // 24 words, 8 just played: the next eight come from the other sixteen.
    const second = idsOf(result.current.words);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
    await idle(result);
  });

  it("starts a new round with its own id, so a board can start clean", async () => {
    setUpWorld({ count: 40 });
    const { result } = await round();
    await waitFor(() => expect(result.current.roundId).toBe(1));
    act(() => result.current.newRound());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.roundId).toBe(2));
  });

  it("says there was a problem when the pool cannot be read", async () => {
    getPicturePool.mockRejectedValue(new Error("down"));
    const { result } = await round();
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("down");
  });

  it("does nothing until there is a signed-in player", async () => {
    ctx.current = signedInContext({ user: { token: undefined } });
    setUpWorld();
    const { result } = await round();
    await act(async () => {});
    expect(result.current.status).toBe("loading");
    expect(getPicturePool).not.toHaveBeenCalled();
  });
});

describe("gatherPlayableWords", () => {
  it("stops when cancelled, with nothing to hand back", async () => {
    getConceptTranslations.mockResolvedValue(new Map());
    const { gatherPlayableWords } = await import("../../src/hooks/usePictureRound");
    const result = await gatherPlayableWords({
      pictured: makePool(5),
      token: "tok",
      locale: "pt-PT",
      target: 10,
      isCancelled: () => true,
    });
    expect(result).toBeNull();
  });

  it("only reads: a concept without a word is left out, never generated", async () => {
    const pool = makePool(4);
    getConceptTranslations.mockImplementation(async (ids) => translationsFor(pool.filter((c) => ids.includes(c.id)), { skip: ["c1"] }));
    const { gatherPlayableWords } = await import("../../src/hooks/usePictureRound");

    const words = await gatherPlayableWords({ pictured: pool, token: "tok", locale: "pt-PT", target: 10 });

    expect(words.map((word) => word.conceptId).sort()).toEqual(["c0", "c2", "c3"]);
    expect(ensureConceptTranslation).not.toHaveBeenCalled();
    expect(requestPicture).not.toHaveBeenCalled();
  });
});

describe("growPlayableWords", () => {
  const base = { token: "tok", locale: "pt-PT", userDialect: "pt-PT", topics: [], seen: new Set() };
  const unpicturedConcept = (id) => ({ id, sourceWord: `src-${id}`, topicIds: [], pos: null });

  const grow = async (options) => {
    const { growPlayableWords } = await import("../../src/hooks/usePictureRound");
    return growPlayableWords({ ...base, ...options });
  };

  it("spends the cheapest step first: a word for a picture that already exists", async () => {
    const added = await grow({ need: 1, pictured: makePool(3), unpictured: [unpicturedConcept("u1")] });

    expect(added).toHaveLength(1);
    expect(added[0].conceptId).toMatch(/^c\d$/);
    expect(requestPicture).not.toHaveBeenCalled();
    expect(generateNewConcept).not.toHaveBeenCalled();
  });

  it("then a picture for a concept that has none, then a new concept", async () => {
    generateNewConcept.mockResolvedValue({ conceptId: "n1", word: "NOVA1", sourceWord: "new1", topicIds: [] });

    // One pictured concept, already in hand; one unpictured; then it must invent.
    const added = await grow({
      need: 2,
      pictured: makePool(1),
      unpictured: [unpicturedConcept("u1")],
      have: new Set(["c0"]),
    });

    expect(added.map((word) => word.conceptId)).toEqual(["u1", "n1"]);
    expect(requestPicture.mock.calls.map(([id]) => id)).toEqual(["u1", "n1"]);
  });

  it("leaves out what is seen, and what is already in hand", async () => {
    const added = await grow({
      need: 5,
      pictured: makePool(3),
      unpictured: [],
      seen: new Set(["c0"]),
      have: new Set(["c1"]),
      maxAttempts: 4,
    });

    expect(added.map((word) => word.conceptId)).toEqual(["c2"]);
  });

  it("never throws: a failure is an attempt, and the caller gets what was added", async () => {
    ensureConceptTranslation.mockRejectedValue(new Error("boom"));
    await expect(grow({ need: 2, pictured: makePool(3), unpictured: [], maxAttempts: 3 })).resolves.toEqual([]);
    // Three candidates, three attempts, then nothing else is tried.
    expect(ensureConceptTranslation).toHaveBeenCalledTimes(3);
  });

  it("stops at once when cancelled", async () => {
    const added = await grow({ need: 3, pictured: makePool(5), unpictured: [], isCancelled: () => true });
    expect(added).toEqual([]);
    expect(ensureConceptTranslation).not.toHaveBeenCalled();
  });

  it("stops at a guest refusal as it does at the cap", async () => {
    requestPicture.mockResolvedValue({ status: "error", url: null, code: "PICTURE_GUEST" });
    const added = await grow({ need: 3, pictured: [], unpictured: [unpicturedConcept("u1"), unpicturedConcept("u2")] });
    expect(added).toEqual([]);
    expect(requestPicture).toHaveBeenCalledTimes(1);
  });
});
