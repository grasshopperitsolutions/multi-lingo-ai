import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * Reading practice-language text: the tappable paragraph shared by tales,
 * Practice Text and culture pieces; Practice Text's on-demand translation;
 * and the grammar hub, which now honours "hidden" and every language.
 */

const ctx = { current: makeAppContext() };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const askAI = vi.fn();
vi.mock("../../src/services/aiService", async (importOriginal) => ({
  ...(await importOriginal()),
  askAI: (...a) => askAI(...a),
}));

vi.mock("../../src/services/promptService", () => ({
  getPrompt: vi.fn(async (id) => ({ id, template: "{{title}} {{paragraphsJson}}", model: "" })),
  renderTemplate: (template, vars) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? "")),
}));

const createDocument = vi.fn(async () => ({}));
vi.mock("../../src/services/firestoreService", async (importOriginal) => ({
  ...(await importOriginal()),
  createDocument: (...a) => createDocument(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = makeAppContext();
});

afterEach(() => vi.useRealTimers());

const withProviders = async (ui) => {
  const { default: i18n } = await import("../../src/i18n");
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>,
  );
};

describe("TappableParagraph", () => {
  const TEXT = "O gato dorme. A casa é azul.";

  async function mountParagraph() {
    const { default: TappableParagraph } = await import("../../src/components/TappableParagraph");
    const onLookup = vi.fn();
    const onBank = vi.fn();
    const utils = render(
      <TappableParagraph text={TEXT} lang="pt-PT" onLookup={onLookup} onBank={onBank} isDarkMode={false} />,
    );
    return { ...utils, onLookup, onBank };
  }

  it("is justified and hyphenated in the text's own language", async () => {
    const { container } = await mountParagraph();
    const p = container.querySelector("p");
    expect(p.getAttribute("lang")).toBe("pt-PT");
    expect(p.className).toContain("text-justify");
    expect(p.className).toContain("hyphens-auto");
  });

  it("looks a tapped word up with the sentence it sits in", async () => {
    const { onLookup, onBank } = await mountParagraph();
    const word = screen.getByText("casa");

    fireEvent.pointerDown(word, { button: 0 });
    fireEvent.pointerUp(word, { button: 0 });

    expect(onLookup).toHaveBeenCalledTimes(1);
    const [tapped, sentence] = onLookup.mock.calls[0];
    expect(tapped).toBe("casa");
    // The second sentence, not the whole paragraph.
    expect(sentence).toContain("A casa é azul");
    expect(sentence).not.toContain("gato");
    expect(onBank).not.toHaveBeenCalled();
  });

  it("banks a held word instead of looking it up", async () => {
    vi.useFakeTimers();
    const { onLookup, onBank } = await mountParagraph();
    const word = screen.getByText("gato");

    fireEvent.pointerDown(word, { button: 0 });
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.pointerUp(word, { button: 0 });

    expect(onBank).toHaveBeenCalledWith("gato");
    expect(onLookup).not.toHaveBeenCalled();
  });
});

describe("translatePracticeText", () => {
  it("translates with the tale's prompt, labelled for Pulse, and stores nothing", async () => {
    askAI.mockResolvedValueOnce({
      text: JSON.stringify({ title: "The cat", paragraphs: ["The cat sleeps.", "The house is blue."] }),
    });
    const { translatePracticeText } = await import("../../src/services/grammarTextService");

    const result = await translatePracticeText({
      token: "tok",
      sourceLang: "pt-PT",
      locale: "en-US",
      title: "O gato",
      paragraphs: ["O gato dorme.", "A casa é azul."],
    });

    expect(result).toEqual({ title: "The cat", paragraphs: ["The cat sleeps.", "The house is blue."] });
    const [, , providerParams] = askAI.mock.calls[0];
    expect(providerParams.feature).toBe("grammar-text-translate");
    // A Practice Text is never stored, so neither is its translation.
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("refuses a translation that loses a paragraph", async () => {
    askAI.mockResolvedValueOnce({ text: JSON.stringify({ title: "The cat", paragraphs: ["Only one."] }) });
    const { translatePracticeText } = await import("../../src/services/grammarTextService");

    await expect(
      translatePracticeText({ token: "tok", sourceLang: "pt-PT", locale: "en-US", title: "O gato", paragraphs: ["a", "b"] }),
    ).rejects.toThrow(/paragraph count/);
  });
});

describe("the grammar hub", () => {
  const grammarKeys = ["grammar_structures", "grammar_tips", "grammar_ask", "grammar_practice", "grammar_text"];
  const tiersConfig = {
    explorer: { id: "explorer", label: "Explorer", order: 1, isFree: true, aiCallsPerDay: 3, features: grammarKeys },
  };
  const registry = (hidden) =>
    grammarKeys.map((id, order) => ({ id, label: id, order, hidden: hidden.includes(id) }));

  async function mountHub({ dialect, hidden = [], examSupported = false }) {
    ctx.current = makeAppContext({
      user: { uid: "u1", token: "tok", learningDialect: dialect, subscriptionTier: "explorer" },
      tiersConfig,
      features: registry(hidden),
      supportedLanguages: [{ code: dialect, label: `Language ${dialect}`, examSupported }],
    });
    const { default: GrammarMenu } = await import("../../src/components/GrammarMenu");
    return withProviders(<GrammarMenu isDarkMode={false} />);
  }

  it("leaves out sections hidden in Admin, as everywhere else", async () => {
    const utils = await mountHub({ dialect: "pt-PT", hidden: ["grammar_structures", "grammar_tips"] });
    const { default: i18n } = await import("../../src/i18n");

    expect(utils.queryByText(i18n.t("grammar.structures"))).toBeNull();
    expect(utils.queryByText(i18n.t("grammar.tips"))).toBeNull();
    expect(utils.getByText(i18n.t("grammar.ask"))).toBeTruthy();
  });

  it("opens Ask and Practice Text in any language", async () => {
    const utils = await mountHub({ dialect: "es-ES", hidden: ["grammar_structures", "grammar_tips"], examSupported: true });
    const { default: i18n } = await import("../../src/i18n");

    expect(utils.getByText(i18n.t("grammar.ask"))).toBeTruthy();
    expect(utils.getByText(i18n.t("grammar.text"))).toBeTruthy();
    // Nothing visible is missing for this language, so there is no notice.
    expect(utils.queryByText(i18n.t("grammar.not_available_for_language"))).toBeNull();
  });

  it("explains only when a visible section is missing for the language", async () => {
    // Drills open per language once it is marked tested; es-ES is not.
    const utils = await mountHub({ dialect: "es-ES", hidden: ["grammar_structures", "grammar_tips"] });
    const { default: i18n } = await import("../../src/i18n");
    expect(utils.getByText(i18n.t("grammar.not_available_for_language"))).toBeTruthy();
  });

  it("shows the practice-language badge in its title", async () => {
    const utils = await mountHub({ dialect: "es-ES" });
    // The badge shows the code; its tooltip carries the name.
    expect(utils.getAllByText("es-ES").length).toBeGreaterThan(0);
  });
});
