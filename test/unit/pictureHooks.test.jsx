import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { makePool, translationsFor, signedInContext, pictureUrl } from "../helpers/pictureFixtures";

/**
 * The two hooks under the picture games: the album's stickers (loaded, collected,
 * written back debounced) and the round (which words, in what order, and when a
 * thin pool asks for more).
 */

const ctx = { current: signedInContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const getAlbumStickers = vi.fn(async () => []);
const saveAlbumStickers = vi.fn(async () => {});
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  getAlbumStickers: (...a) => getAlbumStickers(...a),
  saveAlbumStickers: (...a) => saveAlbumStickers(...a),
}));

const getPicturePool = vi.fn();
const fillPictures = vi.fn(async () => 0);
vi.mock("../../src/services/getImageService", async (importOriginal) => ({
  ...(await importOriginal()),
  getPicturePool: (...a) => getPicturePool(...a),
  fillPictures: (...a) => fillPictures(...a),
}));

const getConceptTranslations = vi.fn();
vi.mock("../../src/services/getWordService", () => ({
  getConceptTranslations: (...a) => getConceptTranslations(...a),
  getWord: vi.fn(),
  getWordPoolCount: vi.fn(),
}));

beforeEach(() => {
  ctx.current = signedInContext();
  for (const mock of [getAlbumStickers, saveAlbumStickers, getPicturePool, fillPictures, getConceptTranslations]) mock.mockReset();
  getAlbumStickers.mockResolvedValue([]);
  saveAlbumStickers.mockResolvedValue(undefined);
  fillPictures.mockResolvedValue(0);
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

// ── usePictureRound ──────────────────────────────────────────────────────────

describe("usePictureRound", () => {
  const setUpWorld = ({ count = 20, topics = [], skip = [], unpictured = [] } = {}) => {
    const pool = makePool(count, { topics });
    getPicturePool.mockResolvedValue({ pictured: pool, unpictured });
    const words = translationsFor([...pool, ...unpictured.map((u) => ({ id: u.id }))], { skip });
    getConceptTranslations.mockImplementation(async (ids) => new Map([...words].filter(([id]) => ids.includes(id))));
    return pool;
  };

  const round = async (options = { want: 6, minWords: 4 }) => {
    const { usePictureRound, clearRecentWords } = await import("../../src/hooks/usePictureRound");
    clearRecentWords();
    return renderHook(() => usePictureRound(options));
  };

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
    expect(new Set(result.current.words.map((w) => w.conceptId)).size).toBe(6);
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

  it("never uses a concept with no word in the practice language", async () => {
    setUpWorld({ count: 10, skip: ["c0", "c1", "c2"] });
    const { result } = await round({ want: 7, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const ids = result.current.pool.map((w) => w.conceptId);
    expect(ids).not.toContain("c0");
    expect(ids).toHaveLength(7);
  });

  it("says the pool is thin when too few words are playable, and starts with what exists", async () => {
    setUpWorld({ count: 3 });
    const { result } = await round({ want: 6, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("thin"));
    expect(result.current.words).toHaveLength(3);
  });

  it("puts the player's interests first", async () => {
    ctx.current = signedInContext({ user: { interests: ["home"] } });
    setUpWorld({ count: 20, topics: ["animals", "home"] });
    const { result } = await round({ want: 8, poolSize: 8, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // c0, c2, … are animals; c1, c3, … are home. Ten are home, enough for all eight.
    const odd = result.current.words.filter((w) => Number(w.conceptId.slice(1)) % 2 === 1);
    expect(odd).toHaveLength(8);
  });

  it("leans away from the words of the round just played", async () => {
    setUpWorld({ count: 24 });
    const { usePictureRound, clearRecentWords } = await import("../../src/hooks/usePictureRound");
    clearRecentWords();
    const { result } = renderHook(() => usePictureRound({ want: 8, poolSize: 8, minWords: 4 }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const first = result.current.words.map((w) => w.conceptId);

    act(() => result.current.newRound());
    await waitFor(() => expect(result.current.roundId).toBe(2));
    expect(result.current.status).toBe("ready");

    // 24 words, 8 just played: the next eight come from the other sixteen.
    const second = result.current.words.map((w) => w.conceptId);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });

  it("starts a new round with its own id, so a board can start clean", async () => {
    setUpWorld();
    const { result } = await round();
    await waitFor(() => expect(result.current.roundId).toBe(1));
    act(() => result.current.newRound());
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.roundId).toBe(2));
  });

  it("does not ask for more pictures when there are enough", async () => {
    setUpWorld({ count: 12, unpictured: [{ id: "u1", sourceWord: "x", topicIds: [], pos: null }] });
    const { result } = await round({ want: 6, minWords: 4 });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => {});
    expect(fillPictures).not.toHaveBeenCalled();
  });

  it("asks for a few more, once, when fewer than twelve words have a picture", async () => {
    setUpWorld({
      count: 6,
      unpictured: ["u1", "u2", "u3", "u4", "u5"].map((id) => ({ id, sourceWord: id, topicIds: [], pos: null })),
    });
    const { result } = await round({ want: 6, minWords: 4 });
    await waitFor(() => expect(fillPictures).toHaveBeenCalledTimes(1));

    const [ids, options] = fillPictures.mock.calls[0];
    expect(ids.sort()).toEqual(["u1", "u2", "u3", "u4", "u5"]);
    expect(options).toMatchObject({ token: "tok", max: 4 });

    // And not again, however many rounds are played.
    act(() => result.current.newRound());
    await waitFor(() => expect(result.current.roundId).toBe(2));
    await act(async () => {});
    expect(fillPictures).toHaveBeenCalledTimes(1);
  });

  it("asks only for words a player of this language could use", async () => {
    getPicturePool.mockResolvedValue({
      pictured: makePool(2),
      unpictured: [
        { id: "has", sourceWord: "has", topicIds: [], pos: null },
        { id: "lacks", sourceWord: "lacks", topicIds: [], pos: null },
      ],
    });
    getConceptTranslations.mockImplementation(async (ids) => new Map(ids.filter((id) => id !== "lacks").map((id) => [id, { word: id.toUpperCase(), baseForm: null }])));
    await round({ want: 6, minWords: 4 });
    await waitFor(() => expect(fillPictures).toHaveBeenCalled());
    expect(fillPictures.mock.calls[0][0]).toEqual(["has"]);
  });

  it("tries again once when nothing was playable and a picture has arrived", async () => {
    // Two pictured words: thin. A fill draws one more.
    const pictured = makePool(2);
    getPicturePool.mockResolvedValue({ pictured, unpictured: [{ id: "u1", sourceWord: "u1", topicIds: [], pos: null }] });
    getConceptTranslations.mockImplementation(async (ids) => new Map(ids.map((id) => [id, { word: id.toUpperCase(), baseForm: null }])));
    fillPictures.mockImplementation(async () => {
      getPicturePool.mockResolvedValue({
        pictured: [...pictured, ...makePool(4).slice(2)],
        unpictured: [],
      });
      return 2;
    });

    const { result } = await round({ want: 4, minWords: 4 });

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.pool).toHaveLength(4);
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
});
