import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The smaller seams of the picture games: the album and seen-scene calls in
 * userService, the translation read the games depend on, and the TEMPORARY
 * prompt seeder.
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

// ── TEMPORARY prompt seeder ──────────────────────────────────────────────────

describe("the prompt seeder (TEMPORARY)", () => {
  const createDocument = vi.fn(async () => ({ id: "x" }));
  const getPrompts = vi.fn();

  beforeEach(() => {
    createDocument.mockClear();
    getPrompts.mockReset();
  });

  const seeder = async () => {
    vi.resetModules();
    vi.doMock("../../src/services/firestoreService", () => ({
      createDocument: (...a) => createDocument(...a),
      queryCollection: vi.fn(async () => ({ documents: [] })),
      updateDocument: vi.fn(),
    }));
    vi.doMock("../../src/services/promptService", () => ({
      PROMPTS_COLLECTION: "appConfig/config/prompts",
      getPrompts: (...a) => getPrompts(...a),
      clearPromptsCache: vi.fn(),
    }));
    return import("../../src/services/promptSeedService");
  };

  it("carries the four prompts of the picture games, in English, each with the placeholder it is about", async () => {
    const { PROMPT_SEEDS } = await seeder();
    expect(PROMPT_SEEDS.map((p) => p.id)).toEqual([
      "concept-picturable-prompt",
      "concept-picture-prompt",
      "picture-scene-prompt",
      "picture-describe-feedback-prompt",
    ]);

    const byId = Object.fromEntries(PROMPT_SEEDS.map((p) => [p.id, p]));
    // The API refuses to draw a template without these, because a picture is paid once and kept for ever.
    expect(byId["concept-picturable-prompt"].template).toContain("{{sourceWord}}");
    expect(byId["concept-picture-prompt"].template).toContain("{{sourceWord}}");
    expect(byId["picture-scene-prompt"].template).toContain("{{sourceWords}}");

    // Every variable a seed declares is one its template uses, and the other way round.
    for (const seed of PROMPT_SEEDS) {
      const used = [...seed.template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      expect([...new Set(used)].sort(), seed.id).toEqual(seed.variables.map((v) => v.name).sort());
    }
  });

  it("keeps the picture prompts free of text, letters, numbers, logos, real people and brands", async () => {
    const { PROMPT_SEEDS } = await seeder();
    for (const id of ["concept-picture-prompt", "picture-scene-prompt"]) {
      const template = PROMPT_SEEDS.find((p) => p.id === id).template;
      for (const never of ["text", "letters", "numbers", "logos", "real people", "brands"]) {
        expect(template, `${id} mentions ${never}`).toContain(never);
      }
    }
  });

  it("names every model, and uses the image models the plan chose", async () => {
    const { PROMPT_SEEDS } = await seeder();
    const byId = Object.fromEntries(PROMPT_SEEDS.map((p) => [p.id, p.model]));
    expect(byId["concept-picture-prompt"]).toBe("gemini-3.1-flash-lite-image");
    expect(byId["picture-scene-prompt"]).toBe("gemini-3.1-flash-image");
    expect(Object.values(byId).every(Boolean)).toBe(true);
  });

  it("puts no age wording in a prompt", async () => {
    const { PROMPT_SEEDS } = await seeder();
    for (const seed of PROMPT_SEEDS) {
      expect(seed.template.toLowerCase(), seed.id).not.toMatch(/\b(kid|kids|child|children|toddler|baby)\b/);
    }
  });

  it("creates the missing ones and never overwrites an existing one", async () => {
    getPrompts.mockResolvedValue([{ id: "concept-picture-prompt" }]);
    const { seedPrompts } = await seeder();

    const outcome = await seedPrompts("tok");

    expect(outcome.skipped).toEqual(["concept-picture-prompt"]);
    expect(outcome.created).toHaveLength(3);
    expect(createDocument.mock.calls.map((c) => c[2]).sort()).toEqual(outcome.created.sort());
    expect(createDocument.mock.calls.every((c) => c[0] === "appConfig/config/prompts" && c[3] === "tok")).toBe(true);
  });

  it("is harmless to press twice", async () => {
    getPrompts.mockResolvedValue(
      ["concept-picturable-prompt", "concept-picture-prompt", "picture-scene-prompt", "picture-describe-feedback-prompt"].map((id) => ({ id })),
    );
    const { seedPrompts } = await seeder();
    expect((await seedPrompts("tok")).created).toEqual([]);
    expect(createDocument).not.toHaveBeenCalled();
  });
});
