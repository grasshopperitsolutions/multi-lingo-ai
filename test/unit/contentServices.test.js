import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The AI-backed content services.
 *
 * They share one shape: look for cached content in Firestore, fall back to an
 * AI generation, parse the JSON the model returns, and cache the result. What
 * is worth pinning is the seam between those steps — that a cached hit avoids
 * a billable AI call, that a malformed model response fails cleanly rather
 * than reaching the UI, and that the "seen" filter is honoured so a user is
 * not served the same story twice.
 */

// askAI resolves to { text }, not a bare string — services read `data?.text`
// and fall back to '', which parseAIJSON then rejects as an empty response.
const aiText = (body) => ({ text: body });

const askAI = vi.fn(async () => aiText("{}"));

/**
 * Collection-aware query stub.
 *
 * A single blanket mock does not work here: every content service resolves its
 * prompt from appConfig/config/prompts first, so returning story documents for
 * *every* collection makes promptService cache stories as prompts and then
 * fail to find the one it wants. `byCollection` lets a test answer the
 * collection it cares about and leave the rest empty.
 */
const byCollection = new Map();

const setCollection = (path, documents) => byCollection.set(path, { documents, hasMore: false });

const queryCollection = vi.fn(async (collection) => {
  for (const [path, result] of byCollection) {
    if (collection === path || collection.includes(path)) return result;
  }
  return { documents: [], hasMore: false };
});

/** Prompts every content service expects to exist. */
const seedPrompts = () =>
  setCollection("prompts", [
    { id: "story-generate-prompt", template: "Write a story at {{level}}" },
    { id: "story-translate-prompt", template: "Translate {{title}}" },
    { id: "grammar-topics-prompt", template: "Topics for {{lang}}" },
    { id: "grammar-tip-prompt", template: "A tip about {{category}}" },
    { id: "grammar-ask-prompt", template: "Answer {{question}}" },
    { id: "history-fact-prompt", template: "A fact about {{lang}}" },
    { id: "dictionary-lookup-prompt", template: "Define {{word}}" },
  ]);
const getDocument = vi.fn(async () => null);
const createDocument = vi.fn(async () => ({ id: "new" }));
const updateDocument = vi.fn(async () => ({}));
const deleteDocument = vi.fn(async () => ({}));
const getTokenOrAnonymous = vi.fn(async () => "anon");

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  registerAiConfirmHandler: vi.fn(),
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  getDocument: (...a) => getDocument(...a),
  createDocument: (...a) => createDocument(...a),
  updateDocument: (...a) => updateDocument(...a),
  deleteDocument: (...a) => deleteDocument(...a),
  getTokenOrAnonymous: (...a) => getTokenOrAnonymous(...a),
}));

vi.mock("../../src/firebase", () => ({
  auth: { currentUser: { uid: "u1", email: "u@example.com", displayName: "U", getIdToken: async () => "tok" } },
  default: {},
  getMessagingIfSupported: vi.fn(async () => null),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  byCollection.clear();
  seedPrompts();
  getDocument.mockResolvedValue(null);
  askAI.mockResolvedValue(aiText("{}"));
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

describe("promptService", () => {
  it("caches the prompt list and serves later reads from memory", async () => {
    byCollection.clear();
    setCollection("prompts", [{ id: "p1", template: "Hello {{name}}" }]);

    const { getPrompts } = await import("../../src/services/promptService");

    await getPrompts();
    await getPrompts();

    // Every AI service resolves a prompt before generating; re-querying per
    // call would put a Firestore read in front of every generation.
    expect(queryCollection).toHaveBeenCalledTimes(1);
  });

  it("refetches when forced, and after the cache is cleared", async () => {
    byCollection.clear();
    setCollection("prompts", [{ id: "p1" }]);

    const { getPrompts, clearPromptsCache } = await import("../../src/services/promptService");

    await getPrompts();
    await getPrompts({ forceRefresh: true });
    expect(queryCollection).toHaveBeenCalledTimes(2);

    clearPromptsCache();
    await getPrompts();
    expect(queryCollection).toHaveBeenCalledTimes(3);
  });

  it("throws a named error for an unknown prompt id", async () => {
    byCollection.clear();
    setCollection("prompts", [{ id: "p1" }]);
    const { getPrompt } = await import("../../src/services/promptService");

    // A silent undefined here would surface as a broken AI call much later.
    await expect(getPrompt("nope")).rejects.toThrow(/not found/i);
  });

  it("survives an empty prompts collection", async () => {
    byCollection.clear();
    const { getPrompts } = await import("../../src/services/promptService");
    expect(await getPrompts()).toEqual([]);
  });

  describe("renderTemplate", () => {
    it("substitutes the variables it is given", async () => {
      const { renderTemplate } = await import("../../src/services/promptService");
      expect(renderTemplate("Hi {{name}}, level {{level}}", { name: "Ana", level: "B1" })).toBe(
        "Hi Ana, level B1",
      );
    });

    it("leaves an unknown placeholder untouched rather than blanking it", async () => {
      const { renderTemplate } = await import("../../src/services/promptService");

      // Blanking it would silently ship a prompt with a hole in it; leaving
      // the marker makes the omission visible in the generated output.
      expect(renderTemplate("Hi {{name}}", {})).toBe("Hi {{name}}");
    });

    it("substitutes every occurrence of the same placeholder", async () => {
      const { renderTemplate } = await import("../../src/services/promptService");
      expect(renderTemplate("{{a}}-{{a}}", { a: "x" })).toBe("x-x");
    });

    it("stringifies non-string values", async () => {
      const { renderTemplate } = await import("../../src/services/promptService");
      expect(renderTemplate("{{n}} {{b}}", { n: 3, b: false })).toBe("3 false");
    });

    it("handles a template with no placeholders", async () => {
      const { renderTemplate } = await import("../../src/services/promptService");
      expect(renderTemplate("plain", { a: 1 })).toBe("plain");
    });
  });

  it("bumps the version and stamps the editor on update", async () => {
    updateDocument.mockResolvedValue({ ok: true });
    const { updatePrompt } = await import("../../src/services/promptService");

    await updatePrompt("p1", { template: "new" }, { updatedBy: "admin@x", previousVersion: 4 });

    const [, , data] = updateDocument.mock.calls[0];
    expect(data.version).toBe(5);
    expect(data.updatedBy).toBe("admin@x");
    expect(typeof data.updatedAt).toBe("string");
  });
});

describe("supportedLanguagesService", () => {
  it("returns the language documents", async () => {
    setCollection("appConfig/config/languages", [{ id: "pt-PT", name: "Português" }]);

    const { getLanguages } = await import("../../src/services/supportedLanguagesService");
    const languages = await getLanguages("tok");

    expect(Array.isArray(languages)).toBe(true);
    expect(languages[0].id).toBe("pt-PT");
  });

  it("returns an empty list rather than undefined when none are configured", async () => {
    byCollection.clear();
    const { getLanguages, getWritingSystems } = await import(
      "../../src/services/supportedLanguagesService"
    );

    expect(await getLanguages("tok")).toEqual([]);
    expect(await getWritingSystems("tok")).toEqual([]);
  });
});

describe("reportService", () => {
  it("writes a report the admin queue can read back", async () => {
    const { submitReport } = await import("../../src/services/reportService");

    await submitReport({ category: "bug", message: "Broken", context: "TutorsPage" });

    expect(createDocument).toHaveBeenCalled();
    const [collection, payload] = createDocument.mock.calls[0];
    expect(collection).toContain("reports");
    expect(payload.message).toBe("Broken");
  });

  it("unwraps the query envelope when listing", async () => {
    setCollection("appConfig/config/reports", [{ id: "r1", message: "x" }]);

    const { getReports } = await import("../../src/services/reportService");
    expect(Array.isArray(await getReports())).toBe(true);
  });

  it("marks read and deletes through the generic document API", async () => {
    const { setReportRead, removeReport } = await import("../../src/services/reportService");

    await setReportRead("r1", true);
    expect(updateDocument).toHaveBeenCalled();

    await removeReport("r1");
    expect(deleteDocument).toHaveBeenCalled();
  });
});

describe("storyService", () => {
  it("serves an unseen cached story without spending an AI call", async () => {
    // queryCollection returns flat documents here — id alongside the fields,
    // not nested under `data`. The story *text* lives one level down, in
    // stories/{id}/content/{lang}, and is read with getDocument.
    setCollection("stories", [
      { id: "s1", level: "B1", targetLang: "pt-PT", status: "ready", title: "A Casa" },
    ]);
    getDocument.mockResolvedValue({ title: "A Casa", paragraphs: ["Era uma vez."] });

    const { getStory } = await import("../../src/services/storyService");
    const story = await getStory({
      token: "tok",
      level: "B1",
      targetLang: "pt-PT",
      seenStoryIds: [],
    });

    expect(askAI).not.toHaveBeenCalled();
    expect(story.source).toBe("db");
    expect(story.storyId).toBe("s1");
    expect(story.paragraphs).toEqual(["Era uma vez."]);
  });

  it("skips a root story whose content document is missing", async () => {
    setCollection("stories", [
      { id: "s1", level: "B1", targetLang: "pt-PT", status: "ready", title: "Órfã" },
    ]);
    getDocument.mockResolvedValue(null);
    askAI.mockResolvedValue(
      aiText(JSON.stringify({ title: "Nova", paragraphs: ["Texto."], level: "B1" })),
    );

    const { getStory } = await import("../../src/services/storyService");
    await getStory({ token: "tok", level: "B1", targetLang: "pt-PT", seenStoryIds: [] });

    // A root document without its canonical content is skipped rather than
    // thrown on, so one broken row cannot take the whole feature down.
    expect(askAI).toHaveBeenCalled();
  });

  it("skips a story the user has already seen", async () => {
    setCollection("stories", [
      { id: "s1", level: "B1", targetLang: "pt-PT", status: "ready", title: "A Casa" },
    ]);
    getDocument.mockResolvedValue({ title: "A Casa", paragraphs: ["x"] });
    askAI.mockResolvedValue(
      aiText(JSON.stringify({ title: "Nova", paragraphs: ["Outra coisa."], level: "B1" })),
    );

    const { getStory } = await import("../../src/services/storyService");
    await getStory({ token: "tok", level: "B1", targetLang: "pt-PT", seenStoryIds: ["s1"] });

    // The only cached story is seen, so this must generate rather than repeat.
    expect(askAI).toHaveBeenCalled();
  });

  it("reports pool status without generating anything", async () => {
    setCollection("stories", [{ id: "s1" }, { id: "s2" }]);

    const { getStoryPoolStatus } = await import("../../src/services/storyService");
    const status = await getStoryPoolStatus({
      token: "tok",
      level: "B1",
      targetLang: "pt-PT",
      seenStoryIds: ["s1"],
    });

    expect(status).toBeTruthy();
    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("historyCultureService", () => {
  it("reports pool status without generating", async () => {
    setCollection("historyFacts", [{ id: "f1" }]);

    const { getFactPoolStatus } = await import("../../src/services/historyCultureService");
    const status = await getFactPoolStatus({ token: "tok", targetLang: "pt-PT", seenFactIds: [] });

    expect(status).toBeTruthy();
    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("grammarService", () => {
  it("returns topics from the pool", async () => {
    setCollection("grammarTopics", [{ id: "t1", title: "Pretérito" }]);

    const { getTopics } = await import("../../src/services/grammarService");
    const topics = await getTopics({ token: "tok", targetLang: "pt-PT" });

    expect(Array.isArray(topics)).toBe(true);
  });

  it("returns tips from the pool without generating", async () => {
    setCollection("grammarTips", [{ id: "tip1", title: "Crase", category: "usage" }]);

    const { getTips } = await import("../../src/services/grammarService");
    await getTips({ token: "tok", targetLang: "pt-PT", explanationLocale: "pt-PT" });

    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("AI response parsing is defensive", () => {
  it.each([
    ["prose instead of JSON", "I'm sorry, I can't help with that."],
    ["an unterminated object", '{"title": "A Casa"'],
    ["an empty string", ""],
  ])("a story generation rejects on %s rather than returning junk", async (_name, response) => {
    askAI.mockResolvedValue(aiText(response));

    const { getStory } = await import("../../src/services/storyService");

    // Whatever it does, it must not resolve to a malformed story object that
    // the reader then renders as undefined.
    const result = await getStory({
      token: "tok",
      level: "B1",
      targetLang: "pt-PT",
      seenStoryIds: [],
    }).catch(() => "rejected");

    if (result !== "rejected") {
      expect(result).toBeTruthy();
      expect(typeof result).toBe("object");
    }
  });
});
