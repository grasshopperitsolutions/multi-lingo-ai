import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The professional tools' two load-bearing mechanisms: fitting a long
 * document under the backend's prompt cap, and getting the formal/informal
 * register as far as the model.
 *
 * Both fail silently if they break — a CV would be truncated without anyone
 * being told, or the tone toggle would appear to work and change nothing.
 */

const askAI = vi.fn(async () => ({ text: "{}" }));
const getPrompt = vi.fn();

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  isAiDeclined: () => false,
}));

vi.mock("../../src/services/promptService", async (importOriginal) => ({
  ...(await importOriginal()),
  getPrompt: (...a) => getPrompt(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("fitting a prompt under the cap", () => {
  it("leaves a prompt that already fits completely alone", async () => {
    const { fitToPromptBudget } = await import("../../src/utils/promptBudget");

    const result = fitToPromptBudget("Review this: {{body}}", { body: "short cv" }, "body");

    expect(result.truncated).toBe(false);
    expect(result.prompt).toBe("Review this: short cv");
    expect(result.usedChars).toBe("short cv".length);
  });

  it("trims the body, never the instructions", async () => {
    const { fitToPromptBudget } = await import("../../src/utils/promptBudget");

    const instructions = "INSTRUCTIONS THAT MUST SURVIVE. ".repeat(20);
    const body = "x".repeat(9000);

    const result = fitToPromptBudget(
      `${instructions}{{body}}`,
      { body },
      "body",
      { max: 2000 },
    );

    expect(result.prompt.length).toBeLessThanOrEqual(2000);
    expect(result.truncated).toBe(true);
    expect(result.prompt.startsWith(instructions)).toBe(true);
    expect(result.totalChars).toBe(9000);
    expect(result.usedChars).toBeLessThan(9000);
  });

  it("measures the rendered prompt, so a long template shrinks the body", async () => {
    const { fitToPromptBudget } = await import("../../src/utils/promptBudget");

    const body = "y".repeat(1000);
    const lean = fitToPromptBudget("{{body}}", { body }, "body", { max: 1200 });
    const verbose = fitToPromptBudget(
      `${"padding ".repeat(100)}{{body}}`,
      { body },
      "body",
      { max: 1200 },
    );

    // The same document survives whole under a lean template and is cut under
    // a verbose one — which is the point, because the template is admin-edited.
    expect(lean.truncated).toBe(false);
    expect(verbose.truncated).toBe(true);
  });

  it("keeps a body that appears twice in the template inside the budget", async () => {
    const { fitToPromptBudget } = await import("../../src/utils/promptBudget");

    const result = fitToPromptBudget(
      "First: {{body}} --- Again: {{body}}",
      { body: "z".repeat(4000) },
      "body",
      { max: 1000 },
    );

    expect(result.prompt.length).toBeLessThanOrEqual(1000);
  });
});

describe("the register reaches the model", () => {
  const promptDoc = {
    id: "pro-tone-rewrite-prompt",
    template: "Rewrite in {{lang}} in a {{tone}} register.\n\n{{text}}",
    maxTokens: 2048,
  };

  it("passes the bare tone value, not a sentence built in code", async () => {
    getPrompt.mockResolvedValue(promptDoc);
    askAI.mockResolvedValue({ text: JSON.stringify({ rewritten: "ok", changed: [] }) });

    const { rewriteTone } = await import("../../src/services/professionalToolsService");
    await rewriteTone({ token: "tok", text: "olá", targetLang: "pt-PT", tone: "informal" });

    const prompt = askAI.mock.calls[0][1];
    expect(prompt).toContain("in a informal register");
    // The register rules themselves live in the editable template, not here.
    expect(prompt).toContain("European Portuguese");
  });

  it("leaves no unresolved placeholder in a rendered prompt", async () => {
    getPrompt.mockResolvedValue(promptDoc);
    askAI.mockResolvedValue({ text: JSON.stringify({ rewritten: "ok" }) });

    const { rewriteTone } = await import("../../src/services/professionalToolsService");
    await rewriteTone({ token: "tok", text: "olá", targetLang: "pt-PT", tone: "formal" });

    expect(askAI.mock.calls[0][1]).not.toContain("{{");
  });

  it("warns when the stored template has no slot for the tone", async () => {
    getPrompt.mockResolvedValue({ ...promptDoc, template: "Rewrite this:\n\n{{text}}" });
    askAI.mockResolvedValue({ text: JSON.stringify({ rewritten: "ok" }) });

    const { rewriteTone } = await import("../../src/services/professionalToolsService");
    await rewriteTone({ token: "tok", text: "olá", targetLang: "pt-PT", tone: "formal" });

    // Silent would be the dangerous outcome: the toggle would look like it works.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("{{tone}}"));
  });
});

describe("when a prompt document is missing", () => {
  it("reports it as unconfigured rather than as a model failure", async () => {
    getPrompt.mockRejectedValue(
      new Error('[promptService] Prompt "pro-cv-review-prompt" not found in appConfig/config/prompts'),
    );

    const { reviewCv } = await import("../../src/services/professionalToolsService");

    await expect(
      reviewCv({ token: "tok", cvText: "cv", targetLang: "pt-PT", interfaceLang: "en-US", tone: "formal" }),
    ).rejects.toMatchObject({ code: "PROMPT_NOT_CONFIGURED" });
    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("the email tool's variants", () => {
  const emailDoc = {
    id: "pro-email-prompt",
    maxTokens: 2048,
    variants: [
      { key: "write", template: "WRITE MODE {{tone}} {{targetLang}} {{brief}}" },
      { key: "review", template: "REVIEW MODE {{tone}} {{targetLang}} {{draft}}" },
    ],
  };

  it("picks the variant for the mode, from one document", async () => {
    getPrompt.mockResolvedValue(emailDoc);
    askAI.mockResolvedValue({ text: JSON.stringify({ subject: "s", body: "b" }) });

    const { writeEmail } = await import("../../src/services/professionalToolsService");
    await writeEmail({ token: "tok", brief: "ask for a day off", targetLang: "pt-PT", tone: "formal" });

    expect(askAI.mock.calls[0][1]).toContain("WRITE MODE");
    expect(askAI.mock.calls[0][1]).not.toContain("REVIEW MODE");
  });

  it("re-validates the response and rejects a half-object", async () => {
    getPrompt.mockResolvedValue(emailDoc);
    askAI.mockResolvedValue({ text: JSON.stringify({ subject: "s" }) }); // no body

    const { writeEmail } = await import("../../src/services/professionalToolsService");

    await expect(
      writeEmail({ token: "tok", brief: "x", targetLang: "pt-PT", tone: "formal" }),
    ).rejects.toThrow(/incomplete/);
  });
});
