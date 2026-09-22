import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * pronunciationService — a passage to read, and feedback on the reading.
 *
 * The two halves have opposite economics and the tests follow that split. The
 * passage is pooled, so the thing worth pinning is that a pool hit costs no AI
 * call at all. The feedback is per-person, so what matters is that the
 * recording actually reaches the model, and that a response from a
 * transcription model — which may return a transcript and little else —
 * degrades into something renderable instead of throwing away the call.
 */

const askAI = vi.fn();
const getPrompt = vi.fn();
const queryCollection = vi.fn();
const createDocument = vi.fn();

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  isAiDeclined: () => false,
}));

vi.mock("../../src/services/promptService", () => ({
  getPrompt: (...a) => getPrompt(...a),
  renderTemplate: (template, vars) =>
    String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)),
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: (...a) => queryCollection(...a),
  createDocument: (...a) => createDocument(...a),
}));

const PASSAGE_TEMPLATE = "Write {{sentenceCount}} sentences in {{targetLang}} at {{level}}. Avoid: {{avoidTexts}}";
const FEEDBACK_TEMPLATE =
  "Passage: {{text}}. Reply in {{explanationLang}} about {{targetLang}} at {{level}}, max {{maxIssues}} issues.";

const GOOD_FEEDBACK = JSON.stringify({
  transcript: "O pao estava quente",
  score: 72,
  summary: "Quase lá.",
  issues: [{ word: "pão", heard: "pau", tip: "Fecha mais a boca no final." }],
});

const AUDIO = { data: "T2dnUwAC", mimeType: "audio/webm;codecs=opus" };

async function service() {
  return import("../../src/services/pronunciationService");
}

beforeEach(() => {
  vi.clearAllMocks();
  queryCollection.mockResolvedValue({ documents: [] });
  createDocument.mockResolvedValue({ id: "new-passage" });
  askAI.mockResolvedValue({ text: GOOD_FEEDBACK });
  getPrompt.mockImplementation(async (id) => ({
    template: id === "pronunciation-passage-prompt" ? PASSAGE_TEMPLATE : FEEDBACK_TEMPLATE,
    model: "",
    explorerModel: "",
  }));
});

describe("getPassage", () => {
  const call = async (overrides = {}) => {
    const { getPassage } = await service();
    return getPassage({ token: "t", level: "B1", targetLang: "pt-PT", ...overrides });
  };

  it("serves from the pool without spending an AI call", async () => {
    queryCollection.mockResolvedValue({
      documents: [{ id: "p1", text: "Uma manhã fria.", focus: ["ã", "lh"] }],
    });

    const result = await call();

    expect(result).toMatchObject({ passageId: "p1", source: "db", focus: ["ã", "lh"] });
    // The whole argument for pooling: everyone practising pt-PT at B1 wants
    // the same difficult sounds, so only the first reader pays.
    expect(askAI).not.toHaveBeenCalled();
  });

  it("skips what this reader has already read aloud", async () => {
    queryCollection.mockResolvedValue({
      documents: [{ id: "p1", text: "Já lido." }, { id: "p2", text: "Novo." }],
    });

    const result = await call({ seenPassageIds: ["p1"] });

    expect(result.passageId).toBe("p2");
  });

  it("generates and pools one when everything has been seen", async () => {
    queryCollection.mockResolvedValue({ documents: [{ id: "p1", text: "Já lido." }] });
    askAI.mockResolvedValue({
      text: JSON.stringify({ text: "O avô olhou o mar.", focus: ["ô", "lh"] }),
    });

    const result = await call({ seenPassageIds: ["p1"] });

    expect(result).toMatchObject({ source: "ai", passageId: "new-passage" });
    // Written back for the next reader, which is what makes the pool a pool.
    expect(createDocument).toHaveBeenCalled();
    expect(createDocument.mock.calls[0][1]).toMatchObject({
      level: "B1",
      targetLang: "pt-PT",
      status: "ready",
    });
  });

  it("tells the model what is already pooled, so it writes something else", async () => {
    queryCollection.mockResolvedValue({ documents: [{ id: "p1", text: "Uma manhã fria." }] });
    askAI.mockResolvedValue({ text: JSON.stringify({ text: "Outro.", focus: [] }) });

    await call({ seenPassageIds: ["p1"] });

    expect(askAI.mock.calls[0][1]).toContain("Uma manhã fria.");
  });
});

describe("gradePronunciation", () => {
  const call = async (overrides = {}) => {
    const { gradePronunciation } = await service();
    return gradePronunciation({
      token: "t",
      audio: AUDIO,
      text: "O pão estava quente.",
      targetLang: "pt-PT",
      explanationLang: "pt-PT",
      level: "B1",
      ...overrides,
    });
  };

  it("attaches the recording to the request", async () => {
    await call();

    // Fourth argument to askAI is the options bag. Without this the model
    // grades a reading it never heard.
    expect(askAI.mock.calls[0][3]).toEqual({ audio: [AUDIO] });
  });

  it("sends the passage, so there is something to compare against", async () => {
    await call();

    expect(askAI.mock.calls[0][1]).toContain("O pão estava quente.");
  });

  it("falls back to the ordinary text model, not a transcription one", async () => {
    // It defaulted to gemini-3.5-transcribe once, and that model did exactly
    // what this file's own comment warned it might: returned the transcript
    // and ignored the instruction, so every reading came back with no score,
    // no summary and no issues while still costing a daily call. The task is
    // judgement about a reading; audio is merely how it arrives.
    await call();

    expect(askAI.mock.calls[0][2].model).toBe("gemini-3.5-flash-lite");
  });

  it("lets the prompt document override the model without a deploy", async () => {
    // How the fix above was confirmed in production before it was code.
    getPrompt.mockResolvedValue({ template: FEEDBACK_TEMPLATE, model: "gemini-3.8-flash" });

    await call();

    expect(askAI.mock.calls[0][2].model).toBe("gemini-3.8-flash");
  });

  it("warns when an edited template has lost {{text}}", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getPrompt.mockResolvedValue({ template: "Just listen and comment.", model: "" });

    await call();

    // Without the passage the model is guessing at what was meant to be read,
    // and every verdict becomes a guess dressed as feedback.
    expect(warn.mock.calls.flat().join(" ")).toContain("{{text}}");
    warn.mockRestore();
  });

  it("refuses to spend a call with no recording", async () => {
    await expect(call({ audio: null })).rejects.toThrow(/audio is required/);
    expect(askAI).not.toHaveBeenCalled();
  });

  it("clamps a score outside the scale, and survives a missing one", async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify({ transcript: "x", score: 140, summary: "", issues: [] }),
    });
    expect((await call()).score).toBe(100);

    askAI.mockResolvedValue({ text: JSON.stringify({ transcript: "x", issues: [] }) });
    // Null rather than 0 — the page hides the number entirely rather than
    // telling somebody they scored zero because the model omitted a field.
    expect((await call()).score).toBeNull();
  });

  it("returns something renderable from a transcript-only reply", async () => {
    // What a transcription model may plausibly send back. Throwing here would
    // spend one of the reader's daily calls and show them nothing.
    askAI.mockResolvedValue({ text: JSON.stringify({ transcript: "O pau estava quente" }) });

    const result = await call();

    expect(result.transcript).toBe("O pau estava quente");
    expect(result.issues).toEqual([]);
    expect(result.summary).toBe("");
  });

  it("drops half-formed issues rather than rendering blanks", async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify({
        transcript: "x",
        score: 50,
        summary: "",
        issues: [
          { word: "pão", tip: "Fecha a boca." },
          { word: "", tip: "sem palavra" },
          { word: "sem dica" },
        ],
      }),
    });

    const result = await call();

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ word: "pão", heard: "" });
  });

  it("caps the issue list rather than rendering whatever came back", async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify({
        transcript: "x",
        score: 10,
        summary: "",
        issues: Array.from({ length: 20 }, (_, i) => ({ word: `w${i}`, tip: "t" })),
      }),
    });

    expect((await call()).issues.length).toBeLessThanOrEqual(6);
  });
});
