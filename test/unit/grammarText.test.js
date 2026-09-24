import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isGrammarSectionAvailable,
  isGrammarSupported,
} from "../../src/config/grammarSupport";
import { GRAMMAR_SECTIONS } from "../../src/config/favouritableFeatures";

/**
 * Practice Text — the first part of the grammar hub that is not pt-PT only.
 *
 * Two separate things are worth pinning. The **language gate** now runs per
 * section rather than over the whole hub, and getting that backwards is
 * invisible either way: too strict and a section is merely absent, too loose
 * and unreviewed grammar ships for a language nobody has checked. And the
 * **prompt**, where the learner's own words are the entire request — a
 * template edited to drop `{{focus}}` still returns a perfectly good passage,
 * just not about anything they asked for.
 */

const TEMPLATE = [
  "Write a practice text in {{targetLang}} at {{level}}.",
  "Asked to practise: {{focus}}",
  "Words: {{requiredWords}}",
  "Note in {{explanationLang}}, up to {{maxHighlights}} highlights.",
].join("\n");

const GOOD_RESPONSE = JSON.stringify({
  title: "Uma manhã difícil",
  paragraphs: ["Primeiro parágrafo.", "Segundo parágrafo."],
  focusNote: "Procura o pretérito imperfeito.",
  highlights: ["andava", "queria"],
});

const askAI = vi.fn();
const getPrompt = vi.fn();

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  isAiDeclined: () => false,
}));

vi.mock("../../src/services/promptService", () => ({
  getPrompt: (...a) => getPrompt(...a),
  // The real implementation; substituting a fake here would test the fake.
  renderTemplate: (template, vars) =>
    String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)),
}));

const BASE_CALL = {
  token: "t",
  targetLang: "es-ES",
  explanationLang: "pt-PT",
  level: "B1",
  focus: "pretérito imperfeito",
};

beforeEach(() => {
  vi.clearAllMocks();
  askAI.mockResolvedValue({ text: GOOD_RESPONSE });
  getPrompt.mockResolvedValue({ template: TEMPLATE, model: "", explorerModel: "" });
});

describe("which sections a language gets", () => {
  it("keeps the library sections to the languages that have one", () => {
    expect(isGrammarSupported("pt-PT")).toBe(true);

    for (const section of GRAMMAR_SECTIONS) {
      // Practice follows the exam switch instead — see grammarPractice.test.js.
      if (section.needsLibrary === false || section.availability === "structured-practice") continue;
      expect(isGrammarSectionAvailable(section, "es-ES"), section.id).toBe(false);
      expect(isGrammarSectionAvailable(section, "pt-PT"), section.id).toBe(true);
    }
  });

  it("gives Practice Text to every language", () => {
    const text = GRAMMAR_SECTIONS.find((s) => s.id === "text");

    expect(text).toBeTruthy();
    expect(isGrammarSectionAvailable(text, "es-ES")).toBe(true);
    expect(isGrammarSectionAvailable(text, "th-TH")).toBe(true);
    // Including the case where nothing is set at all, mid-onboarding.
    expect(isGrammarSectionAvailable(text, undefined)).toBe(true);
  });

  it("defaults a section with no flag to needing the library", () => {
    // The safe direction: forgetting the flag makes a section absent, not
    // makes it ship unreviewed grammar.
    expect(isGrammarSectionAvailable({ id: "invented" }, "es-ES")).toBe(false);
  });

  it("every section title and description resolves in the base locale", async () => {
    // Resolved from a variable in GrammarMenu, so the i18n canary — which
    // scans for literal t("...") calls — cannot see any of these.
    const pt = (await import("../../src/locales/pt/translation.json")).default;
    const resolve = (key) => key.split(".").reduce((node, part) => node?.[part], pt);

    for (const section of GRAMMAR_SECTIONS) {
      expect(typeof resolve(section.titleKey), `${section.id} titleKey`).toBe("string");
      expect(typeof resolve(section.descKey), `${section.id} descKey`).toBe("string");
    }
  });
});

describe("generatePracticeText", () => {
  async function generate(overrides = {}) {
    const { generatePracticeText } = await import("../../src/services/grammarTextService");
    return generatePracticeText({ ...BASE_CALL, ...overrides });
  }

  it("puts what the learner typed into the prompt", async () => {
    await generate({ focus: "verbos de movimento" });

    expect(askAI.mock.calls[0][1]).toContain("verbos de movimento");
  });

  it("sends the banked words, and '(none)' when there are none", async () => {
    await generate({ requiredWords: ["despensa", "jantar"] });
    expect(askAI.mock.calls[0][1]).toContain("despensa, jantar");

    askAI.mockClear();
    await generate();
    expect(askAI.mock.calls[0][1]).toContain("(none)");
  });

  it("carries both models from the prompt document", async () => {
    getPrompt.mockResolvedValue({
      template: TEMPLATE,
      model: "gemini-3.8-flash",
      explorerModel: "gemini-3.5-flash-lite",
    });
    await generate();

    const params = askAI.mock.calls[0][2];
    expect(params.model).toBe("gemini-3.8-flash");
    expect(params.explorerModel).toBe("gemini-3.5-flash-lite");
  });

  it("warns when an edited template has lost {{focus}}", async () => {
    // The failure this guards is silent: the model still writes a fine passage,
    // it just is not about what was asked for.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getPrompt.mockResolvedValue({ template: "Write something at {{level}}.", model: "" });

    await generate();

    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toContain("{{focus}}");
    warn.mockRestore();
  });

  it("refuses to spend an AI call with nothing to focus on", async () => {
    await expect(generate({ focus: "   " })).rejects.toThrow(/focus is required/);
    expect(askAI).not.toHaveBeenCalled();
  });

  it("still returns the passage when the model skipped the extras", async () => {
    // focusNote and highlights are presentational. Throwing here would spend
    // one of the reader's daily calls and show them nothing.
    askAI.mockResolvedValue({
      text: JSON.stringify({ title: "Título", paragraphs: ["Um parágrafo."] }),
    });

    const result = await generate();

    expect(result.paragraphs).toEqual(["Um parágrafo."]);
    expect(result.focusNote).toBe("");
    expect(result.highlights).toEqual([]);
  });

  it("caps the highlights rather than rendering whatever came back", async () => {
    askAI.mockResolvedValue({
      text: JSON.stringify({
        title: "Título",
        paragraphs: ["Um parágrafo."],
        focusNote: "Nota.",
        highlights: Array.from({ length: 30 }, (_, i) => `forma${i}`),
      }),
    });

    const result = await generate();

    expect(result.highlights.length).toBeLessThanOrEqual(8);
  });
});
