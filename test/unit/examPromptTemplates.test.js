import { describe, it, expect, vi } from "vitest";

/**
 * The exam prompts render values only — the wording is in the admin-edited
 * templates. These pin the variables each prompt gets, and that nothing
 * written in code (Portuguese exam instructions, grammar descriptions,
 * labels) reaches the model any more: that is what made the exams
 * Portuguese-only.
 */

const templates = {
  "exam-reading-prompt": {
    variants: [
      { key: "multiple-choice", template: "R {{level}} {{targetLang}} {{passageLength}} {{questionCount}} {{extraItems}} {{grammarDescription}} {{examPhrasing}}" },
      { key: "matching", template: "M {{level}} {{extraItems}}" },
    ],
  },
  "exam-listening-prompt": {
    template: "L {{targetLang}} {{level}} {{audioFormat}} {{questionType}} {{questionCount}} {{duration}} {{listeningFieldList}}",
  },
  "exam-writing-prompt": { template: "W {{level}} {{targetLang}} {{textType}} {{minWords}} {{maxWords}} {{textTypeLabel}}" },
  "exam-oral-prompt": { template: "O {{level}} {{targetLang}} {{prepTimeMinutes}} {{speakingTimeMinutes}} {{oralType}}" },
};

vi.mock("../../src/services/promptService", () => ({
  getPrompt: async (id) => templates[id],
  renderTemplate: (template, vars) =>
    String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)),
}));

const { getReadingPrompt, getListeningPrompt, getWritingPrompt, getOralPrompt } = await import(
  "../../src/services/examPromptTemplates"
);

describe("exam prompt values", () => {
  it("reading gets level, dialect, passage length, counts — and no code-written sentences", async () => {
    const prompt = await getReadingPrompt("B1", "en-US", { type: "multiple-choice", questionCount: 5 });
    expect(prompt).toBe("R B1 en-US 150 5 3 {{grammarDescription}} {{examPhrasing}}");
  });

  it("reading picks the variant by type, with fewer distractors for beginners", async () => {
    expect(await getReadingPrompt("A1", "pt-PT", { type: "matching" })).toBe("M A1 2");
    expect(await getReadingPrompt("A1", "pt-PT", { type: "unknown" })).toMatch(/^R A1 pt-PT/);
  });

  it("listening sends the raw format and type keys", async () => {
    const prompt = await getListeningPrompt("A2", "en-GB", { type: "fill-blanks", audioFormat: "phone-message" });
    expect(prompt).toBe("L en-GB A2 phone-message fill-blanks 3 60 {{listeningFieldList}}");
  });

  it("writing sends the raw text type and word bounds", async () => {
    expect(await getWritingPrompt("B2", "pt-BR", { textType: "email" })).toBe("W B2 pt-BR email 140 170 {{textTypeLabel}}");
  });

  it("oral sends times and the raw type", async () => {
    expect(await getOralPrompt("C1", "pt-PT", { type: "roleplay" })).toBe("O C1 pt-PT 25 12 roleplay");
  });
});
