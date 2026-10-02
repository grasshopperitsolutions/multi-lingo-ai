import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * getImageService, rebuilt. The old one could never have worked (nothing called
 * it, the API could not return an image, its uploads would have been refused).
 * The new one only *reads* the picture collections and asks the server to draw
 * through the picture mode of ask-ai, naming a concept and nothing else.
 *
 * What these pin down is cost and trust: a word that has a picture is never
 * asked for again, nothing here can choose what is drawn, only our own bucket's
 * URLs are ever handed back, and a failed picture never throws into a game.
 */

const BUCKET = "my-bucket";
const ORIGIN = `https://storage.googleapis.com/${BUCKET}/`;
const pic = (id) => `${ORIGIN}conceptPictures/${id}/abc.webp`;
const scn = (id) => `${ORIGIN}pictureScenes/${id}/abc.webp`;

const askAI = vi.fn();
const queryCollection = vi.fn();

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
}));

const getPrompt = vi.fn();
vi.mock("../../src/services/promptService", () => ({
  getPrompt: (...a) => getPrompt(...a),
  renderTemplate: (template, vars) =>
    template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? String(vars[key]) : m)),
}));

const svc = async () => import("../../src/services/getImageService");

/** The queries the service makes, keyed by collection. */
const collections = {};
const setCollection = (name, documents) => {
  collections[name] = documents;
};

beforeEach(async () => {
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", BUCKET);
  askAI.mockReset();
  queryCollection.mockReset();
  getPrompt.mockReset();
  for (const key of Object.keys(collections)) delete collections[key];
  queryCollection.mockImplementation(async (collection) => ({ documents: collections[collection] ?? [] }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  (await svc()).clearPictureCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isOwnPictureUrl", () => {
  it("accepts a picture in our own bucket's picture folder", async () => {
    const { isOwnPictureUrl } = await svc();
    expect(isOwnPictureUrl(pic("c1"))).toBe(true);
    expect(isOwnPictureUrl(scn("s1"), "scene")).toBe(true);
  });

  it("refuses anything else, even a lookalike", async () => {
    const { isOwnPictureUrl } = await svc();
    for (const url of [
      "https://evil.example/conceptPictures/c1/a.webp",
      `https://storage.googleapis.com/other-bucket/conceptPictures/c1/a.webp`,
      `${ORIGIN}avatars/u1/me.png`,
      `${ORIGIN.replace("https", "http")}conceptPictures/c1/a.webp`,
      `https://storage.googleapis.com/${BUCKET}.evil.com/conceptPictures/c1/a.webp`,
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isOwnPictureUrl(url), String(url)).toBe(false);
    }
  });

  it("keeps a picture and a scene apart", async () => {
    const { isOwnPictureUrl } = await svc();
    expect(isOwnPictureUrl(scn("s1"), "concept")).toBe(false);
    expect(isOwnPictureUrl(pic("c1"), "scene")).toBe(false);
  });

  it("fails closed with no bucket configured", async () => {
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "");
    const { isOwnPictureUrl } = await svc();
    expect(isOwnPictureUrl(pic("c1"))).toBe(false);
  });
});

describe("reading pictures", () => {
  beforeEach(() => {
    setCollection("conceptPictures", [
      { id: "c1", status: "ready", url: pic("c1"), width: 512, height: 512 },
      { id: "c2", status: "ready", url: pic("c2") },
      { id: "c3", status: "skipped" },
      { id: "c4", status: "failed" },
      { id: "c5", status: "pending" },
      { id: "c6", status: "ready", url: "https://evil.example/x.webp" },
      { id: "c7", status: "ready" },
    ]);
  });

  it("returns only ready pictures that are on our own bucket", async () => {
    const { getReadyPictures } = await svc();
    const ready = await getReadyPictures("tok");
    expect([...ready.keys()].sort()).toEqual(["c1", "c2"]);
    expect(ready.get("c1")).toEqual({ url: pic("c1"), width: 512, height: 512 });
  });

  it("answers any number of ids with one read, absent when there is no picture", async () => {
    const { getConceptPictures } = await svc();
    const found = await getConceptPictures(["c1", "c2", "c3", "nope"], "tok");
    expect([...found.keys()].sort()).toEqual(["c1", "c2"]);
    await getConceptPictures(["c1"], "tok");
    expect(queryCollection).toHaveBeenCalledTimes(1);
  });

  it("asks for only the fields it uses", async () => {
    const { getReadyPictures } = await svc();
    await getReadyPictures("tok");
    expect(queryCollection).toHaveBeenCalledWith(
      "conceptPictures",
      {},
      expect.objectContaining({ select: expect.arrayContaining(["status", "url"]) }),
      "tok",
    );
  });

  it("does not remember a failed read", async () => {
    queryCollection.mockRejectedValueOnce(new Error("down"));
    const { getReadyPictures } = await svc();
    await expect(getReadyPictures("tok")).rejects.toThrow("down");
    expect((await getReadyPictures("tok")).size).toBe(2);
  });
});

describe("getPicturePool", () => {
  it("joins ready concepts with their pictures, and finds what has never been asked for", async () => {
    setCollection("wordPool", [
      { id: "c1", sourceWord: "cat", senseKey: "animal", topicIds: ["animals"] },
      { id: "c2", sourceWord: "dog" },
      { id: "c3", sourceWord: "freedom", pos: "noun" },
      { id: "c4", sourceWord: "knife" },
      { id: "c5", sourceWord: "tree", topicIds: ["nature"], pos: "noun" },
      { id: "c6", sourceWord: "" },
    ]);
    setCollection("conceptPictures", [
      { id: "c1", status: "ready", url: pic("c1") },
      { id: "c2", status: "ready", url: "https://evil.example/x.webp" },
      { id: "c3", status: "skipped" },
      { id: "c4", status: "failed" },
    ]);

    const { getPicturePool } = await svc();
    const { pictured, unpictured } = await getPicturePool("tok");

    expect(pictured).toEqual([
      { id: "c1", sourceWord: "cat", senseKey: "animal", topicIds: ["animals"], url: pic("c1"), width: undefined, height: undefined },
    ]);
    // A skipped or declined word is in neither list: asking again is pointless.
    expect(unpictured.map((c) => c.id)).toEqual(["c5"]);
    expect(unpictured[0]).toMatchObject({ topicIds: ["nature"], pos: "noun" });
  });

  it("reads only ready concepts", async () => {
    const { getPicturePool } = await svc();
    await getPicturePool("tok");
    expect(queryCollection).toHaveBeenCalledWith("wordPool", { status: "ready" }, expect.any(Object), "tok");
  });
});

describe("asking the server to draw", () => {
  it("names a concept and nothing else, without a prompt, and does not ask first", async () => {
    askAI.mockResolvedValueOnce({ picture: { conceptId: "c1", status: "ready", url: pic("c1") } });
    const { requestPicture } = await svc();

    const result = await requestPicture("c1", "tok");

    expect(result).toEqual({ status: "ready", url: pic("c1") });
    const [token, prompt, params, options] = askAI.mock.calls[0];
    expect(token).toBe("tok");
    expect(prompt).toBe("");
    expect(params).toEqual({ provider: "gemini", feature: "concept-picture-prompt", picture: { conceptId: "c1" } });
    // Pictures do not spend the daily allowance, so there is no spend prompt.
    expect(options.skipConfirm).toBe(true);
    expect(options.timeout).toBeGreaterThan(25_000);
  });

  it("never rejects: a game must not stop for a decoration", async () => {
    askAI.mockRejectedValueOnce(new Error("boom"));
    const { requestPicture, requestConceptPicture } = await svc();
    expect(await requestPicture("c1", "tok")).toEqual({ status: "error", url: null, code: undefined });
    askAI.mockRejectedValueOnce(new Error("boom"));
    expect(await requestConceptPicture("c1", "tok")).toBeNull();
  });

  it("carries the server's reason for a refusal", async () => {
    askAI.mockRejectedValueOnce(Object.assign(new Error("cap"), { code: "PICTURE_CAP" }));
    const { requestPicture } = await svc();
    expect(await requestPicture("c1", "tok")).toMatchObject({ status: "error", code: "PICTURE_CAP" });
  });

  it("reports a word that is skipped, declined or being drawn as no picture", async () => {
    const { requestPicture, requestConceptPicture } = await svc();
    for (const status of ["skipped", "failed", "pending"]) {
      askAI.mockResolvedValueOnce({ picture: { conceptId: "c1", status } });
      expect(await requestPicture("c1", "tok")).toEqual({ status, url: null });
    }
    askAI.mockResolvedValueOnce({ picture: { conceptId: "c1", status: "skipped" } });
    expect(await requestConceptPicture("c1", "tok")).toBeNull();
  });

  it("refuses to hand back a URL that is not on our own bucket", async () => {
    askAI.mockResolvedValueOnce({ picture: { conceptId: "c1", status: "ready", url: "https://evil.example/x.webp" } });
    const { requestConceptPicture } = await svc();
    expect(await requestConceptPicture("c1", "tok")).toBeNull();
  });

  it("does nothing without a concept or a token", async () => {
    const { requestPicture } = await svc();
    expect((await requestPicture("", "tok")).status).toBe("error");
    expect((await requestPicture("c1", "")).status).toBe("error");
    expect(askAI).not.toHaveBeenCalled();
  });

  it("forgets what it had read when a picture is drawn, so the next round sees it", async () => {
    setCollection("conceptPictures", []);
    const { getReadyPictures, requestPicture } = await svc();
    expect((await getReadyPictures("tok")).size).toBe(0);

    setCollection("conceptPictures", [{ id: "c1", status: "ready", url: pic("c1") }]);
    askAI.mockResolvedValueOnce({ picture: { status: "ready", url: pic("c1") } });
    await requestPicture("c1", "tok");

    expect((await getReadyPictures("tok")).size).toBe(1);
  });
});

describe("fillPictures", () => {
  it("asks one at a time and hands each picture over as it arrives", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    askAI.mockImplementation(async (_t, _p, params) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const id = params.picture.conceptId;
      return { picture: { status: "ready", url: pic(id) } };
    });
    const { fillPictures } = await svc();
    const got = [];

    const count = await fillPictures(["a", "b", "c"], { token: "tok", onPicture: (id, url) => got.push([id, url]), max: 5 });

    expect(count).toBe(3);
    expect(got).toEqual([["a", pic("a")], ["b", pic("b")], ["c", pic("c")]]);
    expect(maxInFlight).toBe(1);
  });

  it("stops at max", async () => {
    askAI.mockResolvedValue({ picture: { status: "ready", url: pic("x") } });
    const { fillPictures } = await svc();
    expect(await fillPictures(["a", "b", "c", "d", "e"], { token: "tok", max: 2 })).toBe(2);
    expect(askAI).toHaveBeenCalledTimes(2);
  });

  it("stops asking once the account's daily cap is hit", async () => {
    askAI
      .mockResolvedValueOnce({ picture: { status: "ready", url: pic("a") } })
      .mockRejectedValueOnce(Object.assign(new Error("cap"), { code: "PICTURE_CAP" }));
    const { fillPictures } = await svc();
    expect(await fillPictures(["a", "b", "c", "d"], { token: "tok", max: 4 })).toBe(1);
    expect(askAI).toHaveBeenCalledTimes(2);
  });

  it("keeps going past a word that cannot be drawn", async () => {
    askAI
      .mockResolvedValueOnce({ picture: { status: "skipped" } })
      .mockResolvedValueOnce({ picture: { status: "ready", url: pic("b") } });
    const { fillPictures } = await svc();
    expect(await fillPictures(["a", "b"], { token: "tok", max: 4 })).toBe(1);
  });

  it("stops when the caller goes away, without handing over the last one", async () => {
    let cancelled = false;
    askAI.mockImplementation(async () => {
      cancelled = true;
      return { picture: { status: "ready", url: pic("a") } };
    });
    const { fillPictures } = await svc();
    const onPicture = vi.fn();
    await fillPictures(["a", "b"], { token: "tok", onPicture, isCancelled: () => cancelled });
    expect(onPicture).not.toHaveBeenCalled();
    expect(askAI).toHaveBeenCalledTimes(1);
  });
});

describe("reporting and regenerating", () => {
  it("reports a picture through the picture mode, and says whether it was counted", async () => {
    askAI.mockResolvedValueOnce({ picture: { conceptId: "c1", reported: true } });
    const { reportPicture } = await svc();
    expect(await reportPicture("c1", "tok")).toBe(true);
    expect(askAI.mock.calls[0][2]).toEqual({
      provider: "gemini",
      feature: "concept-picture-prompt",
      picture: { action: "report", conceptId: "c1" },
    });

    askAI.mockResolvedValueOnce({ picture: { conceptId: "c1", reported: false } });
    expect(await reportPicture("c1", "tok")).toBe(false);
  });

  it("never throws from a report", async () => {
    askAI.mockRejectedValueOnce(new Error("offline"));
    const { reportPicture } = await svc();
    expect(await reportPicture("c1", "tok")).toBe(false);
  });

  it("regenerates and returns the new url, or null", async () => {
    askAI.mockResolvedValueOnce({ picture: { status: "ready", url: pic("c1") } });
    const { regeneratePicture } = await svc();
    expect(await regeneratePicture("c1", "tok")).toBe(pic("c1"));
    expect(askAI.mock.calls[0][2].picture).toEqual({ action: "regenerate", conceptId: "c1" });

    askAI.mockRejectedValueOnce(new Error("no"));
    expect(await regeneratePicture("c1", "tok")).toBeNull();
  });
});

describe("scenes", () => {
  const scene = (id, over = {}) => ({
    id,
    url: scn(id),
    conceptIds: ["a", "b", "c", "d"],
    sourceWords: ["a", "b", "c", "d"],
    topicId: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    ...over,
  });

  it("lists ready scenes on our own bucket, newest first", async () => {
    setCollection("pictureScenes", [
      { ...scene("old"), createdAt: "2026-09-01T00:00:00.000Z" },
      { ...scene("new"), createdAt: "2026-10-02T00:00:00.000Z" },
      { ...scene("evil"), url: "https://evil.example/s.webp" },
      { ...scene("broken"), conceptIds: undefined },
    ]);
    const { getScenes } = await svc();
    expect((await getScenes("tok")).map((s) => s.id)).toEqual(["new", "old"]);
  });

  it("puts a scene with no date after the dated ones, not before", async () => {
    setCollection("pictureScenes", [{ ...scene("nodate"), createdAt: undefined }, scene("dated")]);
    const { getScenes } = await svc();
    expect((await getScenes("tok")).map((s) => s.id)).toEqual(["dated", "nodate"]);
  });

  it("ranks unseen scenes, interests first, then newest", async () => {
    const { rankScenes, chooseScene } = await svc();
    const scenes = [scene("a"), scene("b", { topicId: "farm" }), scene("c"), scene("d", { topicId: "farm" })];

    expect(rankScenes(scenes, { seenIds: ["a"], preferTopicIds: ["farm"] }).map((s) => s.id)).toEqual(["b", "d", "c"]);
    expect(rankScenes(scenes, { seenIds: [] }).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(chooseScene(scenes, { seenIds: ["a", "b", "c", "d"] })).toBeNull();
    expect(chooseScene([], {})).toBeNull();
  });

  it("asks for a new scene by concept ids, and returns it", async () => {
    askAI.mockResolvedValueOnce({
      picture: { sceneId: "s9", url: scn("s9"), conceptIds: ["a", "b", "c", "d"], topicId: "farm" },
    });
    const { requestScene } = await svc();

    const created = await requestScene(["a", "b", "c", "d"], "tok");

    expect(created).toMatchObject({ id: "s9", url: scn("s9"), topicId: "farm" });
    expect(askAI.mock.calls[0][2]).toEqual({
      provider: "gemini",
      feature: "picture-scene-prompt",
      picture: { action: "scene", conceptIds: ["a", "b", "c", "d"] },
    });
    expect(askAI.mock.calls[0][3].skipConfirm).toBe(true);
  });

  it("rejects, with the reason, so the page can say why there is no new scene", async () => {
    askAI.mockRejectedValueOnce(Object.assign(new Error("tier"), { code: "SCENE_TIER" }));
    const { requestScene } = await svc();
    await expect(requestScene(["a", "b", "c", "d"], "tok")).rejects.toMatchObject({ code: "SCENE_TIER" });
  });

  it("rejects a scene whose url is not ours", async () => {
    askAI.mockResolvedValueOnce({ picture: { sceneId: "s9", url: "https://evil.example/s.webp" } });
    const { requestScene } = await svc();
    await expect(requestScene(["a", "b", "c", "d"], "tok")).rejects.toThrow();
  });
});

describe("requestDescribeFeedback", () => {
  const prompt = {
    id: "picture-describe-feedback-prompt",
    template: "{{targetLanguage}}|{{nativeLanguage}}|{{level}}|{{description}}|{{foundWords}}|{{missedWords}}",
    model: "gemini-3.8-flash",
    maxTokens: 1500,
  };
  const found = [{ word: "gato" }, { word: "cão" }];
  const missed = [{ word: "pássaro" }, { word: "árvore" }, { word: "bola" }];
  const base = {
    token: "tok",
    sceneId: "s1",
    description: "  Vejo um gato e um cão.  ",
    level: "B1",
    targetLanguage: "pt-PT",
    nativeLanguage: "en-US",
    found,
    missed,
  };

  beforeEach(() => {
    getPrompt.mockResolvedValue(prompt);
  });

  it("hands over values, never sentences, and says none when there are none", async () => {
    askAI.mockResolvedValueOnce({ text: JSON.stringify({ feedback: "Boa!", corrections: [], tryNext: [] }) });
    const { requestDescribeFeedback } = await svc();

    await requestDescribeFeedback({ ...base, found: [], missed: found });

    expect(askAI.mock.calls[0][1]).toBe("pt-PT|en-US|B1|Vejo um gato e um cão.|none|gato, cão");
  });

  it("names the scene so the server attaches the picture, and is an ordinary counted call", async () => {
    askAI.mockResolvedValueOnce({ text: JSON.stringify({ feedback: "Boa!", corrections: [], tryNext: [] }) });
    const { requestDescribeFeedback } = await svc();

    await requestDescribeFeedback(base);

    const [, , params, options] = askAI.mock.calls[0];
    expect(params).toMatchObject({
      provider: "gemini",
      model: "gemini-3.8-flash",
      feature: "picture-describe-feedback-prompt",
      sceneId: "s1",
      jsonMode: true,
      maxOutputTokens: 1500,
    });
    // The scene never travels through the browser.
    expect(options.images).toBeUndefined();
    // Counted like any other call: it asks first.
    expect(options.skipConfirm).toBeUndefined();
  });

  it("cuts a long description to the limit the server prompt expects", async () => {
    askAI.mockResolvedValueOnce({ text: JSON.stringify({ feedback: "ok", corrections: [], tryNext: [] }) });
    const { requestDescribeFeedback, MAX_DESCRIPTION_LENGTH } = await svc();
    await requestDescribeFeedback({ ...base, description: "x".repeat(5000) });
    const rendered = askAI.mock.calls[0][1];
    expect(rendered.split("|")[3]).toHaveLength(MAX_DESCRIPTION_LENGTH);
  });

  it("returns the feedback, the corrections and two words to try", async () => {
    askAI.mockResolvedValueOnce({
      text: JSON.stringify({
        feedback: " Muito bem! ",
        corrections: [{ original: "um gato", corrected: "o gato", explanation: "Artigo definido." }],
        tryNext: [
          { word: "pássaro", question: "Vês o pássaro?" },
          { word: "árvore", question: "Onde está a árvore?" },
        ],
      }),
    });
    const { requestDescribeFeedback } = await svc();

    const result = await requestDescribeFeedback(base);

    expect(result.feedback).toBe("Muito bem!");
    expect(result.corrections).toEqual([{ original: "um gato", corrected: "o gato", explanation: "Artigo definido." }]);
    expect(result.tryNext).toEqual([
      { word: "pássaro", question: "Vês o pássaro?" },
      { word: "árvore", question: "Onde está a árvore?" },
    ]);
  });

  it("throws away a next word the model invented: it phrases the missed words, it cannot add one", async () => {
    askAI.mockResolvedValueOnce({
      text: JSON.stringify({
        feedback: "Bom.",
        corrections: [],
        tryNext: [
          { word: "elefante", question: "Vês o elefante?" },
          { word: "gato", question: "Vês o gato?" },
          { word: "PASSARO", question: "Vês o pássaro?" },
          { word: "bola", question: "" },
        ],
      }),
    });
    const { requestDescribeFeedback } = await svc();

    const { tryNext } = await requestDescribeFeedback(base);

    // Not the invented one, not a word they already found, not an empty question;
    // and a missed word comes back as the stored spelling.
    expect(tryNext).toEqual([{ word: "pássaro", question: "Vês o pássaro?" }]);
  });

  it("keeps at most two next words and five corrections", async () => {
    askAI.mockResolvedValueOnce({
      text: JSON.stringify({
        feedback: "ok",
        corrections: Array.from({ length: 8 }, (_, i) => ({ original: `o${i}`, corrected: `c${i}`, explanation: "" })),
        tryNext: missed.map((m) => ({ word: m.word, question: `Vês ${m.word}?` })),
      }),
    });
    const { requestDescribeFeedback } = await svc();
    const result = await requestDescribeFeedback(base);
    expect(result.tryNext).toHaveLength(2);
    expect(result.corrections).toHaveLength(5);
  });

  it("drops a correction that has nothing to correct", async () => {
    askAI.mockResolvedValueOnce({
      text: JSON.stringify({
        feedback: "ok",
        corrections: [
          { original: "", corrected: "x", explanation: "" },
          { original: "y", corrected: "  ", explanation: "" },
          { original: "z", corrected: "w", explanation: "" },
        ],
        tryNext: [],
      }),
    });
    const { requestDescribeFeedback } = await svc();
    expect((await requestDescribeFeedback(base)).corrections).toEqual([{ original: "z", corrected: "w", explanation: "" }]);
  });

  it("copes with a model that returns almost nothing", async () => {
    askAI.mockResolvedValueOnce({ text: "{}" });
    const { requestDescribeFeedback } = await svc();
    expect(await requestDescribeFeedback(base)).toEqual({ feedback: "", corrections: [], tryNext: [] });
  });

  it("lets a failed call reach the page, which decides what to say", async () => {
    askAI.mockRejectedValueOnce(Object.assign(new Error("limit"), { code: "DAILY_LIMIT" }));
    const { requestDescribeFeedback } = await svc();
    await expect(requestDescribeFeedback(base)).rejects.toMatchObject({ code: "DAILY_LIMIT" });
  });
});
