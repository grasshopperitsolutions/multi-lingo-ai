import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The smaller seams of the picture games: the album and seen-scene calls in
 * userService, and the translation read the games depend on.
 */

const okJson = (data = {}) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the album, in userService", () => {
  it("is read from the challenge progress document for the practice language", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ id: "x", data: { stickerConceptIds: ["c1", "c2"], totalPlayed: 4 } }));
    const { getAlbumStickers } = await import("../../src/services/userService");

    expect(await getAlbumStickers("tok", "u1", "pt-PT")).toEqual(["c1", "c2"]);

    const url = decodeURIComponent(fetchMock.mock.calls[0][0]);
    expect(url).toContain("collection=userGameProgress/u1/games");
    expect(url).toContain("id=picture_album__pt-PT");
  });

  it("is empty when there is no document yet, or the field is missing or wrong", async () => {
    const { getAlbumStickers } = await import("../../src/services/userService");
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    expect(await getAlbumStickers("tok", "u1", "pt-PT")).toEqual([]);
    fetchMock.mockResolvedValueOnce(okJson({ data: { totalPlayed: 1 } }));
    expect(await getAlbumStickers("tok", "u1", "pt-PT")).toEqual([]);
    fetchMock.mockResolvedValueOnce(okJson({ data: { stickerConceptIds: "nope" } }));
    expect(await getAlbumStickers("tok", "u1", "pt-PT")).toEqual([]);
  });

  it("is saved by the whole list, as an upsert on the same document, without touching the play count", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ id: "picture_album__pt-PT" }));
    const { saveAlbumStickers } = await import("../../src/services/userService");

    await saveAlbumStickers("tok", "u1", "pt-PT", ["c1", "c2", "c2"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/firestore$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.collection).toBe("userGameProgress/u1/games");
    expect(body.id).toBe("picture_album__pt-PT");
    expect(body.data).toMatchObject({ gameId: "picture_album", learningDialect: "pt-PT", stickerConceptIds: ["c1", "c2"] });
    // The challenge games' own counter lives on the same document; this must not reset it.
    expect(body.data).not.toHaveProperty("totalPlayed");
  });

  it("keeps each practice language's album apart", async () => {
    fetchMock.mockResolvedValue(okJson());
    const { saveAlbumStickers } = await import("../../src/services/userService");
    await saveAlbumStickers("tok", "u1", "pt-PT", ["a"]);
    await saveAlbumStickers("tok", "u1", "fr-FR", ["b"]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).id).toBe("picture_album__pt-PT");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).id).toBe("picture_album__fr-FR");
  });

  it("reports a failed save, so the caller can try again with the next sticker", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "nope" }) });
    const { saveAlbumStickers } = await import("../../src/services/userService");
    await expect(saveAlbumStickers("tok", "u1", "pt-PT", ["a"])).rejects.toThrow("nope");
  });
});

describe("seen scenes, in userService", () => {
  it("reads, appends without duplicates, and resets users/{uid}.seenSceneIds", async () => {
    const { getSeenSceneIds, markSceneSeen, resetSeenScenes } = await import("../../src/services/userService");

    fetchMock.mockResolvedValueOnce(okJson({ id: "u1", data: { seenSceneIds: ["s1"] } }));
    expect(await getSeenSceneIds("tok", "u1")).toEqual(["s1"]);

    fetchMock.mockResolvedValueOnce(okJson());
    await markSceneSeen("tok", "u1", "s2", ["s1", "s2"]);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).data).toEqual({ seenSceneIds: ["s1", "s2"] });

    fetchMock.mockResolvedValueOnce(okJson());
    await resetSeenScenes("tok", "u1");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).data).toMatchObject({ seenSceneIds: [] });
  });
});

describe("getConceptTranslations", () => {
  const translationResponse = (word, baseForm) => okJson({ data: { word, baseForm } });
  const notFound = () => ({ ok: false, status: 404, json: async () => ({}) });
  const urlOf = (call) => decodeURIComponent(call[0]);

  const load = async () => {
    const mod = await import("../../src/services/getWordService");
    mod.clearTranslationCache();
    return mod;
  };

  it("reads the word for each concept in the practice language, and nothing else", async () => {
    fetchMock.mockImplementation(async (url) =>
      decodeURIComponent(url).includes("wordPool/c1/") ? translationResponse("gato", null) : notFound(),
    );
    const { getConceptTranslations } = await load();

    const found = await getConceptTranslations(["c1", "c2"], "pt-PT", "tok");

    expect([...found.keys()]).toEqual(["c1"]);
    expect(found.get("c1")).toEqual({ word: "gato", baseForm: null });
    expect(fetchMock.mock.calls.map(urlOf).every((url) => url.includes("/translations") && url.includes("id=pt-PT"))).toBe(true);
  });

  it("never asks an AI for a translation that is missing: it is a read", async () => {
    fetchMock.mockResolvedValue(notFound());
    const { getConceptTranslations } = await load();
    await getConceptTranslations(["c1"], "pt-PT", "tok");
    // Only GETs of the translation document: nothing was written, no AI path was touched.
    expect(fetchMock.mock.calls.every(([, init]) => init.method === "GET")).toBe(true);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("ask-ai"))).toBe(false);
  });

  it("keeps the dictionary form for a word that has one", async () => {
    fetchMock.mockResolvedValue(translationResponse("foram", "ir"));
    const { getConceptTranslations } = await load();
    expect((await getConceptTranslations(["c1"], "pt-PT", "tok")).get("c1")).toEqual({ word: "foram", baseForm: "ir" });
  });

  it("remembers a word it found: a pooled wording is never rewritten under anyone", async () => {
    fetchMock.mockResolvedValue(translationResponse("gato", null));
    const { getConceptTranslations } = await load();
    await getConceptTranslations(["c1"], "pt-PT", "tok");
    await getConceptTranslations(["c1"], "pt-PT", "tok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps each language's word apart", async () => {
    fetchMock.mockResolvedValue(translationResponse("gato", null));
    const { getConceptTranslations } = await load();
    await getConceptTranslations(["c1"], "pt-PT", "tok");
    await getConceptTranslations(["c1"], "es-ES", "tok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("remembers a missing word only for a couple of minutes: another game may write it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    fetchMock.mockResolvedValue(notFound());
    const { getConceptTranslations } = await load();

    await getConceptTranslations(["c1"], "pt-PT", "tok");
    await getConceptTranslations(["c1"], "pt-PT", "tok");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-10-02T12:03:00Z"));
    await getConceptTranslations(["c1"], "pt-PT", "tok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats a failed read as missing for now, and does not remember it", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(translationResponse("gato", null));
    const { getConceptTranslations } = await load();

    expect((await getConceptTranslations(["c1"], "pt-PT", "tok")).size).toBe(0);
    expect((await getConceptTranslations(["c1"], "pt-PT", "tok")).size).toBe(1);
  });

  it("asks once per concept even when it is listed twice", async () => {
    fetchMock.mockResolvedValue(translationResponse("gato", null));
    const { getConceptTranslations } = await load();
    await getConceptTranslations(["c1", "c1", "c1"], "pt-PT", "tok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
