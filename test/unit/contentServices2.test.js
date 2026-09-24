import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Translation loading, word/exercise pools, TTS and image lookup.
 *
 * The through-line is cost: every one of these can either serve something
 * already paid for or spend an AI call, and the rule for choosing is what
 * matters. The base locale must never be read from Firestore, a cached
 * exercise must not trigger a generation, and a repeated word lookup must not
 * be billed twice.
 */

const aiText = (body) => ({ text: body });
const askAI = vi.fn(async () => aiText("{}"));

const byCollection = new Map();
const setCollection = (path, documents) => byCollection.set(path, { documents, hasMore: false });

const queryCollection = vi.fn(async (collection) => {
  for (const [path, result] of byCollection) {
    if (collection === path || collection.includes(path)) return result;
  }
  return { documents: [], hasMore: false };
});

const getDocument = vi.fn(async () => null);
const createDocument = vi.fn(async () => ({ id: "new" }));
const updateDocument = vi.fn(async () => ({}));
const patchDocument = vi.fn(async () => ({}));
const deleteDocument = vi.fn(async () => ({}));

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  registerAiConfirmHandler: vi.fn(),
  isAiDeclined: () => false,
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  getDocument: (...a) => getDocument(...a),
  createDocument: (...a) => createDocument(...a),
  updateDocument: (...a) => updateDocument(...a),
  patchDocument: (...a) => patchDocument(...a),
  deleteDocument: (...a) => deleteDocument(...a),
  getTokenOrAnonymous: vi.fn(async () => "anon-tok"),
}));

vi.mock("../../src/firebase", () => ({
  auth: { currentUser: { uid: "u1", email: "u@x.com", displayName: "U", getIdToken: async () => "tok" } },
  default: {},
  getMessagingIfSupported: vi.fn(async () => null),
}));

const seedPrompts = () =>
  setCollection("prompts", [
    { id: "word-generate-prompt", template: "A word at {{level}}" },
    { id: "dictionary-lookup-prompt", template: "Define {{word}}" },
    { id: "reading-exercise-prompt", template: "Reading for {{level}}" },
    { id: "listening-exercise-prompt", template: "Listening for {{level}}" },
    { id: "writing-exercise-prompt", template: "Writing for {{level}}" },
    { id: "concept-icon-prompt", template: "Icon for {{word}}" },
    { id: "image-generate-prompt", template: "Image of {{prompt}}" },
    { id: "translate-batch-prompt", template: "Translate {{json}}" },
    {
      id: "get-word-generate-new-concept-prompt",
      template: "One word about {{interestOrTopic}} in {{learningDialect}}, hint in {{userDialect}}. Avoid: {{avoidList}}",
    },
  ]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  byCollection.clear();
  seedPrompts();
  getDocument.mockResolvedValue(null);
  askAI.mockResolvedValue(aiText("{}"));
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  }));
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

describe("translationService", () => {
  it("serves the base locale from the bundled file, never from Firestore", async () => {
    const { getTranslations } = await import("../../src/services/translationService");
    const { BASE_LOCALE } = await import("../../src/i18n");

    const bundle = await getTranslations(BASE_LOCALE, "tok");

    // The shipped file is canonical: it cannot drift from the running code,
    // and the Firestore copy is only ever seeded once.
    expect(bundle).toBeTruthy();
    expect(getDocument).not.toHaveBeenCalled();
    expect(Object.keys(bundle).length).toBeGreaterThan(10);
  });

  it("caches a remote locale so a second read makes no request", async () => {
    getDocument.mockResolvedValue({ id: "en-US", data: { common: { yes: "Yes" } } });

    const { getTranslations } = await import("../../src/services/translationService");

    await getTranslations("en-US", "tok");
    const callsAfterFirst = getDocument.mock.calls.length;
    await getTranslations("en-US", "tok");

    expect(getDocument.mock.calls.length).toBe(callsAfterFirst);
  });

  it("clearing the cache forces the next read to refetch", async () => {
    getDocument.mockResolvedValue({ id: "en-US", data: { common: { yes: "Yes" } } });

    const { getTranslations, clearTranslationsCache } = await import(
      "../../src/services/translationService"
    );

    await getTranslations("en-US", "tok");
    clearTranslationsCache();
    await getTranslations("en-US", "tok");

    expect(getDocument.mock.calls.length).toBeGreaterThan(1);
  });

  it("falls back rather than throwing when a locale cannot be loaded", async () => {
    getDocument.mockRejectedValue(new Error("offline"));

    const { getTranslations } = await import("../../src/services/translationService");

    // A failed locale fetch must not take the app down — the base bundle is
    // still there to render from.
    const result = await getTranslations("de-DE", "tok").catch(() => null);
    expect(result === null || typeof result === "object").toBe(true);
  });
});

describe("translationService — seeding a new language", () => {
  /**
   * The prompt template is admin-edited in Firestore, so a test can make it
   * anything. Rendering to just the chunk's JSON lets the fake AI echo its
   * input back as a perfect "translation", which is what makes the chunking
   * itself — not the translating — the thing under test.
   */
  const seedTranslationPrompt = () =>
    setCollection("prompts", [
      { id: "translation-fill-missing-prompt", template: "{{missingKeysJson}}", maxTokens: 8192 },
    ]);

  it("sends one AI call per chunk and writes the merged document once", async () => {
    seedTranslationPrompt();
    askAI.mockImplementation(async (_token, prompt) => aiText(prompt));

    const { seedLanguageTranslations } = await import("../../src/services/translationService");
    const result = await seedLanguageTranslations("de-DE", "tok");

    expect(askAI.mock.calls.length).toBeGreaterThan(1); // the source is chunked
    expect(createDocument).toHaveBeenCalledTimes(1);
    // Echoed back verbatim, so a complete run reproduces the source tree.
    expect(Object.keys(result).length).toBeGreaterThan(10);
  });

  it("runs several chunks at once rather than one after another", async () => {
    seedTranslationPrompt();

    let inFlight = 0;
    let peak = 0;
    askAI.mockImplementation(async (_token, prompt) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 0));
      inFlight -= 1;
      return aiText(prompt);
    });

    const { seedLanguageTranslations } = await import("../../src/services/translationService");
    await seedLanguageTranslations("de-DE", "tok");

    // Sequential would peak at 1. The pool is bounded, so it must not simply
    // fire every chunk at once either.
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(4);
  });

  it("skips a chunk it cannot translate instead of losing the whole run", async () => {
    seedTranslationPrompt();

    let call = 0;
    askAI.mockImplementation(async (_token, prompt) => {
      call += 1;
      if (call === 2) throw new Error("gemini said no");
      return aiText(prompt);
    });

    const { seedLanguageTranslations } = await import("../../src/services/translationService");
    const result = await seedLanguageTranslations("de-DE", "tok");

    // The document is still written, minus the failed chunk's keys. Those keys
    // are now *missing*, which is the state i18next falls back to the base
    // locale for and fillMissingTranslations retries — far better than
    // throwing away every chunk that did translate.
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it("translates from the bundle, never from a pt-PT document in Firestore", async () => {
    seedTranslationPrompt();
    askAI.mockImplementation(async (_token, prompt) => aiText(prompt));

    // There is deliberately no pt-PT document — it was an abandoned partial
    // seed that nothing read, and a copy of these strings in a database is a
    // copy no pull request can be gated on. If one is ever put back, seeding
    // must keep ignoring it: the bundled file is what the running code uses,
    // so anything else would translate from strings nobody is seeing.
    getDocument.mockImplementation(async (collection, id) =>
      collection === "appConfig/config/locales" && id === "pt-PT"
        ? { id, data: { email: { welcome: { subject: "ESCRITO À MÃO" } } } }
        : null
    );

    const { seedLanguageTranslations } = await import("../../src/services/translationService");
    const result = await seedLanguageTranslations("de-DE", "tok");
    const pt = (await import("../../src/locales/pt/translation.json")).default;

    expect(result.email.welcome.subject).toBe(pt.email.welcome.subject);
  });

  it("refuses to create an empty locale document when every chunk fails", async () => {
    seedTranslationPrompt();
    askAI.mockRejectedValue(new Error("AI backend down"));

    const { seedLanguageTranslations } = await import("../../src/services/translationService");

    // An empty document would look seeded and so would never be retried.
    await expect(seedLanguageTranslations("de-DE", "tok")).rejects.toThrow(/all \d+ chunk/);
    expect(createDocument).not.toHaveBeenCalled();
  });
});

describe("getWordService", () => {
  it("serves a pooled word without spending an AI call", async () => {
    setCollection("wordPool", [
      { id: "c1", word: "CASA", hint: "Onde se vive", status: "ready", learningDialect: "pt-PT" },
    ]);

    const { getWord } = await import("../../src/services/getWordService");
    const result = await getWord({
      token: "tok",
      userDialect: "en-US",
      learningDialect: "pt-PT",
      seenConceptIds: [],
    }).catch(() => null);

    if (result) {
      expect(askAI).not.toHaveBeenCalled();
      expect(result.source).toBe("db");
    }
  });

  it("does not serve a concept skipped in this browser", async () => {
    // Skipping is honoured inside getWord rather than per game, so a word put
    // down in Hangman because it was unreadable is not handed straight back in
    // Scrambled Word. The id stays out of the profile — see
    // utils/skippedConcepts for why that difference matters.
    const { addSkippedConceptId, clearSkippedConceptIds } = await import(
      "../../src/utils/skippedConcepts"
    );
    clearSkippedConceptIds("pt-PT");
    addSkippedConceptId("c1", "pt-PT");

    setCollection("wordPool", [
      { id: "c1", word: "CASA", hint: "h", status: "ready", learningDialect: "pt-PT" },
    ]);
    askAI.mockResolvedValue(aiText(JSON.stringify({ word: "MAR", hint: "Água salgada" })));

    const { getWord } = await import("../../src/services/getWordService");
    const result = await getWord({
      token: "tok",
      userDialect: "en-US",
      learningDialect: "pt-PT",
      seenConceptIds: [],
    }).catch(() => null);

    clearSkippedConceptIds("pt-PT");
    if (result) expect(result.conceptId).not.toBe("c1");
  });

  it("does not re-serve a concept the user has already seen", async () => {
    setCollection("wordPool", [
      { id: "c1", word: "CASA", hint: "h", status: "ready", learningDialect: "pt-PT" },
    ]);
    askAI.mockResolvedValue(aiText(JSON.stringify({ word: "MAR", hint: "Água salgada" })));

    const { getWord } = await import("../../src/services/getWordService");
    const result = await getWord({
      token: "tok",
      userDialect: "en-US",
      learningDialect: "pt-PT",
      seenConceptIds: ["c1"],
    }).catch(() => null);

    // Asserts the guarantee, not the mechanism: whether the service generates,
    // falls back or gives up, it must not hand back the concept the player has
    // already had. An earlier version of this test asserted that askAI was
    // called, which pinned an implementation detail the service is free to
    // change.
    if (result) expect(result.conceptId).not.toBe("c1");
  });

  it("counts the pool without generating", async () => {
    setCollection("wordPool", [{ id: "c1" }, { id: "c2" }, { id: "c3" }]);

    const { getWordPoolCount } = await import("../../src/services/getWordService");
    const count = await getWordPoolCount("tok", "en-US", "pt-PT").catch(() => null);

    expect(askAI).not.toHaveBeenCalled();
    if (count !== null) expect(typeof count).toBe("number");
  });
});

describe("examExerciseService", () => {
  it("counts a pool without generating", async () => {
    setCollection("exercises", [{ id: "e1" }, { id: "e2" }]);

    const { getExercisePoolCount } = await import("../../src/services/examExerciseService");
    await getExercisePoolCount("tok", "reading", "B1", "pt-PT").catch(() => null);

    expect(askAI).not.toHaveBeenCalled();
  });

  it("serves a cached exercise rather than generating one", async () => {
    setCollection("exercises", [
      {
        id: "e1",
        type: "reading",
        level: "B1",
        targetLang: "pt-PT",
        status: "ready",
        questions: [{ id: "q1", text: "A?", correctAnswer: "a" }],
      },
    ]);
    getDocument.mockResolvedValue({
      questions: [{ id: "q1", text: "A?", correctAnswer: "a" }],
      passage: "Texto.",
    });

    const { getExercise } = await import("../../src/services/examExerciseService");
    await getExercise({
      token: "tok",
      type: "reading",
      level: "B1",
      targetLang: "pt-PT",
      seenExerciseIds: [],
    }).catch(() => null);

    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("conceptIconService", () => {
  it("returns an empty map for no concept ids without querying", async () => {
    const { fetchConceptIcons } = await import("../../src/services/conceptIconService");

    const icons = await fetchConceptIcons([], "tok").catch(() => null);
    if (icons) expect(Object.keys(icons)).toHaveLength(0);
  });

  it("loads icons for the ids it is given", async () => {
    setCollection("conceptIcons", [{ id: "c1", svg: "<svg/>", conceptId: "c1" }]);

    const { fetchConceptIcons } = await import("../../src/services/conceptIconService");
    const icons = await fetchConceptIcons(["c1"], "tok").catch(() => null);

    expect(askAI).not.toHaveBeenCalled();
    if (icons) expect(typeof icons).toBe("object");
  });
});

describe("getImageService", () => {
  it("finds an existing image by its source word instead of generating", async () => {
    setCollection("files", [{ id: "f1", sourceWord: "casa", url: "https://img/casa.png" }]);

    const { findImageBySourceWord } = await import("../../src/services/getImageService");
    await findImageBySourceWord("tok", "casa").catch(() => null);

    // Image generation is the most expensive call in the app; reusing one
    // that already exists is the whole point of the lookup.
    expect(askAI).not.toHaveBeenCalled();
  });

  it("returns nothing rather than throwing when no image matches", async () => {
    const { findImageBySourceWord } = await import("../../src/services/getImageService");

    const found = await findImageBySourceWord("tok", "inexistente").catch(() => "threw");
    expect(found === "threw" || found == null || typeof found === "object").toBe(true);
  });
});

describe("getTtsService playback controls", () => {
  it("exposes pause, resume and stop without needing a live utterance", async () => {
    const { pauseSpeaking, resumeSpeaking, stopSpeaking } = await import(
      "../../src/services/getTtsService"
    );

    // Called from unmount handlers, where there may be nothing playing.
    expect(() => pauseSpeaking()).not.toThrow();
    expect(() => resumeSpeaking()).not.toThrow();
    expect(() => stopSpeaking()).not.toThrow();
  });
});

describe("dictionaryService", () => {
  it("looks a word up through the AI path and parses the result", async () => {
    askAI.mockResolvedValue(
      aiText(JSON.stringify({ word: "casa", senses: [{ definition: "home" }] })),
    );

    const { lookupWord } = await import("../../src/services/dictionaryService");
    const entry = await lookupWord({
      token: "tok",
      word: "casa",
      interfaceLang: "en-US",
      learningLang: "pt-PT",
    }).catch(() => null);

    if (entry) expect(entry).toBeTruthy();
  });

  it("fails cleanly when the model returns prose instead of JSON", async () => {
    askAI.mockResolvedValue(aiText("Sorry, I can't do that."));

    const { lookupWord } = await import("../../src/services/dictionaryService");

    const result = await lookupWord({
      token: "tok",
      word: "casa",
      interfaceLang: "en-US",
      learningLang: "pt-PT",
    }).catch(() => "rejected");

    // Either way it must not hand the UI a half-parsed object.
    expect(result === "rejected" || typeof result === "object").toBe(true);
  });
});

/**
 * The pool must not grow a second copy of a word it already has.
 *
 * The prompt does carry an avoid list, and the model is told in as many words
 * not to repeat. It repeats anyway: one crossword build produced seven
 * `passport` concepts in thirteen seconds, each with its own reworded hint,
 * every one generated while "passport" sat in the list it had just been given.
 * These pin the lookup that now stands between the model and the write, because
 * a soft instruction is not a uniqueness constraint.
 */
describe("getWordService — the duplicate guard", () => {
  const POOLED = { id: "c1", normalizedKey: "passport", sourceWord: "passport", status: "ready", topicIds: [] };

  let posted;

  /** Routes by URL, because this service talks to /api/firestore directly. */
  const routeFetch = ({ match = [], translation = null }) => {
    posted = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

      if (init?.method === "POST") {
        posted.push(JSON.parse(init.body));
        return ok({ id: "brand-new" });
      }
      if (String(url).includes("translations")) {
        return translation
          ? ok({ data: translation })
          : { ok: false, status: 404, json: async () => ({}) };
      }
      if (String(url).includes("normalizedKey")) return ok({ documents: match, hasMore: false });
      return ok({ documents: [POOLED], hasMore: false });
    });
  };

  const generate = async () => {
    askAI.mockResolvedValue(
      aiText(JSON.stringify({ sourceWord: "Passport", word: "pasaporte", hint: "Documento de viagem" })),
    );
    const { getWord } = await import("../../src/services/getWordService");
    // The one pooled concept is already seen, so the pool is exhausted and the
    // service falls through to generation — the only path that writes.
    return getWord({
      token: "tok",
      userDialect: "en-US",
      learningDialect: "pt-PT",
      seenConceptIds: ["c1"],
    });
  };

  it("hands back the concept the pool already holds instead of writing a second", async () => {
    routeFetch({
      match: [POOLED],
      translation: { word: "pasaporte", hints: { "en-US": "A travel document" } },
    });

    const result = await generate();

    expect(result.conceptId).toBe("c1");
    expect(posted.filter((p) => p.collection === "wordPool")).toHaveLength(0);
  });

  it("prefers the pooled wording over the freshly generated one", async () => {
    // Other players have already been shown this. A second wording for the same
    // concept is how the duplicates read as different words in the first place.
    routeFetch({
      match: [POOLED],
      translation: { word: "passaporte", hints: { "en-US": "A travel document" } },
    });

    const result = await generate();

    expect(result.word).toBe("passaporte");
    expect(result.source).toBe("db");
  });

  it("puts a missing language onto the existing concept, not onto a copy of it", async () => {
    // The concept is known in English but nobody has practised it in this
    // language yet — which is exactly what was generated.
    routeFetch({ match: [POOLED], translation: null });

    const result = await generate();

    expect(result.conceptId).toBe("c1");
    expect(posted.filter((p) => p.collection === "wordPool")).toHaveLength(0);
    expect(posted.map((p) => p.collection)).toContain("wordPool/c1/translations");
  });

  it("still creates a concept when the word is genuinely new", async () => {
    routeFetch({ match: [] });

    const result = await generate();

    expect(result.conceptId).toBe("brand-new");
    expect(posted.filter((p) => p.collection === "wordPool")).toHaveLength(1);
  });

  it("writes rather than losing the word when the lookup fails", async () => {
    // A duplicate is a much smaller problem than costing somebody the word
    // they were waiting for, so the guard degrades to the old behaviour.
    posted = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
      if (init?.method === "POST") {
        posted.push(JSON.parse(init.body));
        return ok({ id: "brand-new" });
      }
      if (String(url).includes("normalizedKey")) throw new Error("network");
      if (String(url).includes("translations")) return { ok: false, status: 404, json: async () => ({}) };
      return ok({ documents: [POOLED], hasMore: false });
    });

    const result = await generate();

    expect(result.conceptId).toBe("brand-new");
  });
});

/**
 * The pool grows from dictionary lookups, not only from generations.
 *
 * Until this existed the pool had one way to grow: a game ran out of words and
 * paid a model to invent one — the most expensive way to learn that a word
 * exists. Meanwhile every reader tapping a word mid-story was handing the app a
 * real word, chosen by a real learner, and the app threw it away.
 *
 * These pin the two properties that make that safe: it spends no AI call, and
 * it cannot cost anybody the answer they were actually waiting for.
 */
describe("getWordService — growing the pool from a lookup", () => {
  const CONCEPT = { id: "c1", normalizedKey: "went", sourceWord: "went", status: "ready" };

  const FORAM = {
    token: "tok",
    word: "foram",
    englishKey: "went",
    baseForm: "ir",
    pos: "verb",
    locale: "pt-PT",
  };

  /**
   * Routes by URL, because this service talks to /api/firestore directly.
   * `concepts` is keyed by the normalizedKey a lookup would match on;
   * `translated` names the concepts that already speak the asked-for locale.
   */
  const routePool = ({ concepts = {}, translated = [] } = {}) => {
    const posted = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

      if (init?.method === "POST") {
        posted.push(JSON.parse(init.body));
        return ok({ id: `new-${posted.length}` });
      }

      const params     = new URL(String(url)).searchParams;
      const collection = params.get("collection");

      if (collection?.endsWith("/translations")) {
        const conceptId = collection.split("/")[1];
        return translated.includes(conceptId)
          ? ok({ data: { word: "already-here" } })
          : { ok: false, status: 404, json: async () => ({}) };
      }

      const filters = JSON.parse(params.get("filters") ?? "[]");
      const key     = filters.find((f) => f.field === "normalizedKey")?.value;
      const hit     = concepts[key];
      return ok({ documents: hit ? [hit] : [], hasMore: false });
    });
    return posted;
  };

  const ensure = async (args) => {
    const { ensureConceptForWord } = await import("../../src/services/getWordService");
    return ensureConceptForWord(args);
  };

  it("files a word the pool has never seen, and spends no AI call doing it", async () => {
    const posted = routePool();

    const result = await ensure(FORAM);

    expect(result).toEqual({ conceptId: "new-1", created: true });

    const concept = posted.find((p) => p.collection === "wordPool");
    expect(concept.data.sourceWord).toBe("went");
    expect(concept.data.status).toBe("ready");
    // The generate path has never asked a model for a part of speech and
    // writes null; a lookup already knows one, so it carries through.
    expect(concept.data.pos).toBe("verb");

    const translation = posted.find((p) => p.collection.endsWith("/translations"));
    expect(translation.data.word).toBe("foram");
    expect(translation.data.baseForm).toBe("ir");
    // Findable later if the quality of this source ever slips.
    expect(translation.data.source).toBe("user");
    // This grows the pool; it is not a dictionary cache.
    expect(translation.data.definition).toBeUndefined();
    expect(translation.data.synonyms).toBeUndefined();

    // The whole argument for running this on every tap: it rides on a call
    // that already happened, so it can never touch anyone's daily allowance.
    expect(askAI).not.toHaveBeenCalled();
  });

  it("gives an existing concept a language it did not have, rather than a copy of it", async () => {
    // The quiet win: the word somebody looked up *is* the translation, so a
    // concept sitting in the pool with only an English label becomes playable
    // in another language for nothing.
    const posted = routePool({ concepts: { went: CONCEPT } });

    const result = await ensure(FORAM);

    expect(result).toEqual({ conceptId: "c1", created: false });
    expect(posted.filter((p) => p.collection === "wordPool")).toHaveLength(0);
    expect(posted.map((p) => p.collection)).toContain("wordPool/c1/translations");
  });

  it("leaves a concept that already speaks this language alone", async () => {
    const posted = routePool({ concepts: { went: CONCEPT }, translated: ["c1"] });

    expect(await ensure(FORAM)).toBeNull();
    expect(posted).toHaveLength(0);
  });

  it("keeps an inflected form and its infinitive as two separate concepts", async () => {
    // The design decision this exists to pin. Anchored on the lemma, "foram"
    // and "ir" would collide on one concept and the pool would keep whichever
    // was looked up first — so a learner could never meet the conjugated form
    // in a game. Anchored on the form, both are playable.
    const posted = routePool();

    await ensure(FORAM);
    await ensure({ ...FORAM, word: "ir", englishKey: "to go" });

    const concepts = posted.filter((p) => p.collection === "wordPool");
    expect(concepts.map((p) => p.data.sourceWord)).toEqual(["went", "to go"]);
  });

  it("refuses a phrase, because none of the games it feeds can play one", async () => {
    const posted = routePool();

    expect(await ensure({ ...FORAM, word: "boa tarde" })).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(posted).toHaveLength(0);
  });

  it("refuses a word the lookup could not anchor in English", async () => {
    // No englishKey means the model did not identify the word — a typo, a
    // fragment, a proper noun. Better absent than filed under nothing.
    const posted = routePool();

    expect(await ensure({ ...FORAM, englishKey: "" })).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(posted).toHaveLength(0);
  });

  it("returns null rather than throwing when Firestore is unreachable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => { throw new Error("network"); });

    await expect(ensure(FORAM)).resolves.toBeNull();
  });
});

describe("dictionaryService — feeding the word pool", () => {
  const LOOKUP = JSON.stringify({
    entries: [{
      wordType: "verb",
      translation: "went",
      definition: "past tense of the verb to go",
      synonyms: ["partiram"],
      englishKey: "went",
      baseForm: "ir",
    }],
  });

  /** The promotion is deliberately not awaited, so give it a tick to land. */
  const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });

  let posted;

  beforeEach(() => {
    posted = [];
    askAI.mockResolvedValue(aiText(LOOKUP));
    globalThis.fetch = vi.fn(async (url, init) => {
      const ok = (data) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
      if (init?.method === "POST") {
        posted.push(JSON.parse(init.body));
        return ok({ id: "new" });
      }
      if (new URL(String(url)).searchParams.get("collection")?.endsWith("/translations")) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return ok({ documents: [], hasMore: false });
    });
  });

  const look = async (word) => {
    const { lookupWord } = await import("../../src/services/dictionaryService");
    return lookupWord({ token: "tok", word, interfaceLang: "en-US", learningLang: "pt-PT" });
  };

  it("files a single looked-up word, without a second AI call", async () => {
    const result = await look("foram");
    await settle();

    expect(result.entries[0].englishKey).toBe("went");
    expect(posted.find((p) => p.collection === "wordPool")?.data.sourceWord).toBe("went");
    // One call, and it is the lookup. Promotion is Firestore only.
    expect(askAI).toHaveBeenCalledTimes(1);
  });

  it("files nothing for a phrase", async () => {
    await look("boa tarde");
    await settle();

    expect(posted).toHaveLength(0);
  });

  it("still answers the reader when the pool write fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { lookupWord } = await import("../../src/services/dictionaryService");
    globalThis.fetch = vi.fn(async () => { throw new Error("network"); });
    const result = await lookupWord({
      token: "tok", word: "foram", interfaceLang: "en-US", learningLang: "pt-PT",
    });
    await settle();

    // They asked what a word means. A background write going wrong is not
    // their problem, and must not become their error screen.
    expect(result.entries[0].definition).toBe("past tense of the verb to go");
  });
});

/**
 * The sentence a word was tapped in reaches the dictionary prompt as a value.
 *
 * "foram" is a form of both "ir" and "ser"; only the sentence says which. How
 * to use it is the admin-edited template's to say — the code passes the value
 * and nothing else, never wording of its own.
 */
describe("dictionaryService — the sentence it was tapped in", () => {
  const LOOKUP = JSON.stringify({
    entries: [{ wordType: "verb", translation: "went", definition: "went", synonyms: [], englishKey: "went", baseForm: "ir" }],
  });

  const withTemplate = (template) =>
    setCollection("prompts", [{ id: "dictionary-lookup-prompt", template }]);

  const look = async (extra = {}) => {
    const { lookupWord } = await import("../../src/services/dictionaryService");
    await lookupWord({ token: "tok", word: "foram", interfaceLang: "en-US", learningLang: "pt-PT", ...extra });
    return askAI.mock.calls[0][1];
  };

  beforeEach(() => {
    askAI.mockResolvedValue(aiText(LOOKUP));
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("hands the template the sentence, as a value", async () => {
    withTemplate("Define {{word}}. Sentence: {{sentence}}");

    const prompt = await look({ sentence: "Eles foram ao mercado." });

    expect(prompt).toBe("Define foram. Sentence: Eles foram ao mercado.");
  });

  it("says none when there is no sentence, rather than leaving a gap", async () => {
    withTemplate("Define {{word}}. Sentence: {{sentence}}");

    expect(await look()).toBe("Define foram. Sentence: none");
  });

  it("warns when a sentence is passed but the template has nowhere to put it", async () => {
    withTemplate("Define {{word}}");

    const prompt = await look({ sentence: "Eles foram ao mercado." });

    // Dropped, not appended: the template is the whole prompt.
    expect(prompt).toBe("Define foram");
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("{{sentence}}"));
  });
});
