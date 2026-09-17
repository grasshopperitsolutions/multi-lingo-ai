import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * tutorUrlValidation's AI path, now that its prompt lives in Firestore.
 *
 * The wording used to be built in code, where it could not change without a
 * deploy but also could not be broken by an edit. Moving a moderation policy
 * into an admin-editable document trades one failure mode for another, and
 * these are the two that matter: the URL must reach the model, and a template
 * that has lost its placeholder must say so rather than returning confident
 * verdicts about nothing.
 *
 * There was no test here before — the comment claiming one asserted the
 * prompt's shape was aspirational.
 */

const askAI = vi.fn(async () => ({ text: '{"ok": true, "platform": "Example"}' }));
const getPrompt = vi.fn(async () => ({
  template: "Judge this link.\n\nURL: {{url}}\n\nReply with JSON.",
  model: "",
  explorerModel: "",
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
  isAiDeclined: () => false,
}));

vi.mock("../../src/services/promptService", () => ({
  getPrompt: (...a) => getPrompt(...a),
  // The real one; substituting a fake here would test the fake.
  renderTemplate: (template, vars) =>
    String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)),
}));

const URL_UNDER_TEST = "https://tutor.example.com/book";

beforeEach(() => {
  vi.clearAllMocks();
  askAI.mockResolvedValue({ text: '{"ok": true, "platform": "Example"}' });
  getPrompt.mockResolvedValue({
    template: "Judge this link.\n\nURL: {{url}}\n\nReply with JSON.",
    model: "",
    explorerModel: "",
  });
});

describe("the prompt comes from Firestore", () => {
  it("renders the stored template with the URL in it", async () => {
    const { validateUrlWithAi } = await import("../../src/services/tutorUrlValidation");

    await validateUrlWithAi("tok", URL_UNDER_TEST);

    expect(getPrompt).toHaveBeenCalledWith("tutor-link-validate-prompt");
    const [, prompt] = askAI.mock.calls[0];
    expect(prompt).toContain(URL_UNDER_TEST);
    expect(prompt).toContain("Judge this link.");
    // The placeholder is substituted, not passed through.
    expect(prompt).not.toContain("{{url}}");
  });

  it("warns when the stored template has lost its placeholder", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getPrompt.mockResolvedValue({ template: "Judge the link. Reply with JSON." });

    const { validateUrlWithAi } = await import("../../src/services/tutorUrlValidation");
    await validateUrlWithAi("tok", URL_UNDER_TEST);

    // Without this, the model judges a link it was never shown and every
    // verdict afterwards is noise about nothing.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("{{url}}"));
    warn.mockRestore();
  });

  it("passes both model candidates through so the tier split applies", async () => {
    getPrompt.mockResolvedValue({
      template: "URL: {{url}}",
      model: "big-model",
      explorerModel: "small-model",
    });

    const { validateUrlWithAi } = await import("../../src/services/tutorUrlValidation");
    await validateUrlWithAi("tok", URL_UNDER_TEST);

    const [, , providerParams] = askAI.mock.calls[0];
    // The server picks between them; this only has to carry both.
    expect(providerParams).toMatchObject({
      provider: "openai",
      model: "big-model",
      explorerModel: "small-model",
    });
  });

  it("sends no model at all when the document pins none", async () => {
    const { validateUrlWithAi } = await import("../../src/services/tutorUrlValidation");
    await validateUrlWithAi("tok", URL_UNDER_TEST);

    // An empty string is not a model id — it would be a 400 from the
    // provider rather than a fallback to its default.
    expect(askAI.mock.calls[0][2].model).toBeUndefined();
  });

  it("reports an unreachable prompt document as an un-validated link", async () => {
    getPrompt.mockRejectedValue(new Error("prompt not found"));

    const { validateUrlWithAi } = await import("../../src/services/tutorUrlValidation");
    const result = await validateUrlWithAi("tok", URL_UNDER_TEST);

    // Never throws: the tutor sees "could not validate" and can retry, not a
    // stack trace in the middle of editing their profile.
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("prompt not found");
    expect(askAI).not.toHaveBeenCalled();
  });

  it("does not spend a call on a URL that never parses", async () => {
    const { validateUrlWithAi } = await import("../../src/services/tutorUrlValidation");
    const result = await validateUrlWithAi("tok", "not a url");

    expect(result.ok).toBe(false);
    expect(getPrompt).not.toHaveBeenCalled();
    expect(askAI).not.toHaveBeenCalled();
  });
});
