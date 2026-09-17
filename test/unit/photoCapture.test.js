import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * photoCaptureService — turning what a model read off a photograph into
 * proposals a person reviews.
 *
 * The risk this covers is not "the AI is wrong" — it will be, sometimes, and
 * the review screen exists for that. It is that a malformed or half-empty
 * answer becomes a row the person cannot tell is broken: half a mistake, a
 * word repeated six times, a blank question. Those get filed and studied.
 */

const askAI = vi.fn(async () => ({ text: "{}" }));
const getPrompt = vi.fn(async () => ({ template: "read it", maxTokens: 4096 }));
const fileToDownscaledImage = vi.fn(async () => ({
  data: "BASE64",
  mimeType: "image/jpeg",
  width: 1600,
  height: 1200,
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  isAiDeclined: () => false,
}));
vi.mock("../../src/services/promptService", () => ({
  getPrompt: (...a) => getPrompt(...a),
  renderTemplate: (template) => template,
}));
vi.mock("../../src/utils/imageDownscale", () => ({
  fileToDownscaledImage: (...a) => fileToDownscaledImage(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  askAI.mockResolvedValue({ text: "{}" });
  getPrompt.mockResolvedValue({ template: "read it", maxTokens: 4096 });
});

describe("toProposals", () => {
  it("maps each section onto the fields its widget actually stores", async () => {
    const { toProposals, PROPOSAL_KINDS } = await import("../../src/services/photoCaptureService");

    const proposals = toProposals({
      note: "Verbos irregulares",
      questions: [{ text: "Porque muda a raiz?" }],
      mistakes: [{ said: "eu fazi", correction: "eu fiz", why: "pretérito irregular" }],
      phrases: [{ phrase: "dar conta", translation: "to manage", note: "informal" }],
      words: ["fazer"],
    });

    const byKind = (kind) => proposals.find((p) => p.kind === kind).fields;
    // Field names are the contract with QuickAddForm and the widgets; a
    // rename here writes rows that render blank.
    expect(byKind(PROPOSAL_KINDS.NOTE)).toEqual({ text: "Verbos irregulares" });
    expect(byKind(PROPOSAL_KINDS.QUESTION)).toEqual({ text: "Porque muda a raiz?" });
    expect(byKind(PROPOSAL_KINDS.MISTAKE)).toEqual({
      said: "eu fazi",
      correction: "eu fiz",
      why: "pretérito irregular",
    });
    expect(byKind(PROPOSAL_KINDS.PHRASE)).toEqual({
      phrase: "dar conta",
      translation: "to manage",
      note: "informal",
    });
    expect(byKind(PROPOSAL_KINDS.WORD)).toEqual({ word: "fazer" });
  });

  it("drops a mistake missing either side of the correction", async () => {
    const { toProposals, PROPOSAL_KINDS } = await import("../../src/services/photoCaptureService");

    // Half a mistake says nothing — "you wrote X" with no correction, or a
    // correction with nothing it corrects. The widget's own form requires both.
    const proposals = toProposals({
      mistakes: [
        { said: "eu fazi", correction: "" },
        { said: "", correction: "eu fiz" },
        { said: "eu tenho 20 anos", correction: "eu tenho 20 anos de idade" },
      ],
    });

    const mistakes = proposals.filter((p) => p.kind === PROPOSAL_KINDS.MISTAKE);
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].fields.said).toBe("eu tenho 20 anos");
  });

  it("drops a phrase missing its translation", async () => {
    const { toProposals, PROPOSAL_KINDS } = await import("../../src/services/photoCaptureService");

    const proposals = toProposals({
      phrases: [{ phrase: "dar conta" }, { phrase: "a sério", translation: "really" }],
    });
    expect(proposals.filter((p) => p.kind === PROPOSAL_KINDS.PHRASE)).toHaveLength(1);
  });

  it("de-duplicates words, because the bank keys on the word itself", async () => {
    const { toProposals, PROPOSAL_KINDS } = await import("../../src/services/photoCaptureService");

    const proposals = toProposals({ words: ["Fazer", "fazer", "  fazer  ", "dizer"] });
    const words = proposals.filter((p) => p.kind === PROPOSAL_KINDS.WORD).map((p) => p.fields.word);

    // A page that repeats a term would otherwise propose the same chip several
    // times, and adding it twice is a no-op the person still has to read past.
    expect(words).toEqual(["fazer", "dizer"]);
  });

  it("collapses whitespace rather than asking the prompt to", async () => {
    const { toProposals } = await import("../../src/services/photoCaptureService");

    // Normalising is a .replace; spending prompt tokens instructing a model to
    // trim its output is not what the model is for.
    const [note] = toProposals({ note: "  Verbos   irregulares \n\n " });
    expect(note.fields.text).toBe("Verbos irregulares");
  });

  it("caps each section so the review stays readable", async () => {
    const { toProposals, PROPOSAL_KINDS } = await import("../../src/services/photoCaptureService");

    const proposals = toProposals({
      words: Array.from({ length: 40 }, (_, i) => `palavra${i}`),
      questions: Array.from({ length: 20 }, (_, i) => ({ text: `pergunta ${i}` })),
    });

    // Forty rows is a review nobody reads — they approve it wholesale, which
    // is the outcome the review exists to prevent.
    expect(proposals.filter((p) => p.kind === PROPOSAL_KINDS.WORD)).toHaveLength(15);
    expect(proposals.filter((p) => p.kind === PROPOSAL_KINDS.QUESTION)).toHaveLength(5);
  });

  it("returns nothing for an empty answer instead of blank rows", async () => {
    const { toProposals } = await import("../../src/services/photoCaptureService");

    expect(toProposals({})).toEqual([]);
    expect(toProposals({ note: "   ", questions: [{ text: "" }], words: [""] })).toEqual([]);
  });

  it("gives every proposal a distinct id", async () => {
    const { toProposals } = await import("../../src/services/photoCaptureService");

    const proposals = toProposals({ words: ["um", "dois", "tres"], note: "nota" });
    const ids = proposals.map((p) => p.id);
    // The review keys rows on these and edits by id; a collision would edit
    // two rows at once.
    expect(new Set(ids).size).toBe(ids.length);
    expect(proposals.every((p) => p.include)).toBe(true);
  });
});

describe("analysePhoto", () => {
  it("sends the downscaled image, not the original file", async () => {
    askAI.mockResolvedValue({ text: JSON.stringify({ summary: "uma página", words: ["casa"] }) });
    const { analysePhoto } = await import("../../src/services/photoCaptureService");

    const file = { name: "notes.jpg" };
    const result = await analysePhoto({
      token: "tok",
      file,
      learningLang: "pt-PT",
      interfaceLang: "en-US",
    });

    expect(fileToDownscaledImage).toHaveBeenCalledWith(file);
    const [, , providerParams, options] = askAI.mock.calls[0];
    // Only Gemini accepts images, and the endpoint rejects the request
    // outright on any other provider rather than answering without the photo.
    expect(providerParams.provider).toBe("gemini");
    expect(options.images).toEqual([
      { data: "BASE64", mimeType: "image/jpeg", width: 1600, height: 1200 },
    ]);
    expect(result.summary).toBe("uma página");
  });

  it("raises the spend confirmation rather than skipping it", async () => {
    askAI.mockResolvedValue({ text: "{}" });
    const { analysePhoto } = await import("../../src/services/photoCaptureService");

    await analysePhoto({ token: "tok", file: {}, learningLang: "pt-PT", interfaceLang: "en-US" });

    // This spends one of the student's daily AI calls on an action they just
    // took deliberately, which is exactly what the prompt is for. The
    // dictionary lookup is exempt because it fires on every tap; this does not.
    expect(askAI.mock.calls[0][3].skipConfirm).toBeUndefined();
  });

  it("throws a named error when the answer is not JSON", async () => {
    askAI.mockResolvedValue({ text: "I could not read the photo, sorry!" });
    const { analysePhoto } = await import("../../src/services/photoCaptureService");

    await expect(
      analysePhoto({ token: "tok", file: {}, learningLang: "pt-PT", interfaceLang: "en-US" })
    ).rejects.toThrow(/JSON/);
  });

  it("throws on an empty response rather than reporting nothing found", async () => {
    askAI.mockResolvedValue({ text: "" });
    const { analysePhoto } = await import("../../src/services/photoCaptureService");

    // "Nothing on this page" and "the call failed" are different messages to
    // show someone who just waited for a photo to be read.
    await expect(
      analysePhoto({ token: "tok", file: {}, learningLang: "pt-PT", interfaceLang: "en-US" })
    ).rejects.toThrow(/Empty/);
  });
});
