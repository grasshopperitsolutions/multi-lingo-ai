import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The Tale Creator and the culture pieces show how much of their pool the
 * reader has been through, with a reset, and can be asked to write about one
 * of the reader's own interests — a custom request, gated like the free-text
 * box, and one at a time with it.
 */

const ctx = { current: makeAppContext() };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: vi.fn(async () => ""),
  registerAiConfirmHandler: vi.fn(),
  isAiDeclined: () => false,
}));

const getStory = vi.fn(async () => ({
  storyId: "s9", title: "O gato", paragraphs: ["O gato dorme."], targetLang: "pt-PT", level: "A1",
}));
vi.mock("../../src/services/storyService", () => ({
  getStory: (...a) => getStory(...a),
  getStoryTranslation: vi.fn(async () => null),
  getStoryPoolStatus: vi.fn(async () => ({ total: 4, unseen: 1, exhausted: false })),
}));

const getFact = vi.fn(async () => ({
  factId: "f9", title: "O fado", paragraphs: ["Canta-se."], locale: "pt-PT", sourceLocale: "pt-PT", source: "ai",
}));
vi.mock("../../src/services/historyCultureService", () => ({
  getFact: (...a) => getFact(...a),
  getFactContent: vi.fn(async () => null),
  getFactPoolStatus: vi.fn(async () => ({ total: 2, unseen: 1, exhausted: false })),
}));

const resetSeenStories = vi.fn(async () => {});
const resetSeenHistoryFacts = vi.fn(async () => {});
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  markStorySeen: vi.fn(async () => ({})),
  markHistoryFactSeen: vi.fn(async () => ({})),
  updateUserProfile: vi.fn(async () => ({})),
  resetSeenStories: (...a) => resetSeenStories(...a),
  resetSeenHistoryFacts: (...a) => resetSeenHistoryFacts(...a),
}));

const withCustomRequests = (tierFeatures) =>
  makeAppContext({
    user: {
      uid: "u1",
      token: "tok",
      subscriptionTier: "voyager",
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      aiCallsToday: 0,
      interests: ["food", "sport"],
      seenStoryIds: ["a", "b", "c"],
      seenHistoryFactsIds: ["x"],
    },
    interfaceLang: "pt-PT",
    tiersConfig: {
      voyager: {
        id: "voyager", label: "Voyager", order: 2, isFree: false, aiCallsPerDay: 20,
        features: ["story_generator", "history_culture", ...tierFeatures],
      },
    },
    features: [],
    categories: [
      { id: "food", label: "Comida" },
      { id: "sport", label: "Desporto" },
    ],
    supportedLanguages: [{ code: "pt-PT", label: "Português (Portugal)" }],
  });

const mount = async (loader, Props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: Page } = await loader();
  const utils = render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Page isDarkMode={false} {...Props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return { ...utils, i18n };
};

const TALES = () => import("../../src/components/StoryReader");
const CULTURE = () => import("../../src/pages/dashboard/HistoryCulturePage");

// The Tale Creator's sidebar is drawn twice, a desktop column and a phone
// strip, one of them hidden by CSS, so every query takes the first match.
const first = async (query, ...args) => (await screen[`findAll${query}`](...args))[0];

/** Opens the interest dropdown and picks `label`. */
const chooseInterest = async (i18n, label) => {
  // The dropdown's trigger shows the current choice.
  const trigger = (await screen.findAllByRole("button"))
    .find((b) => b.textContent.includes(i18n.t("interest_picker.none")));
  expect(trigger, "no interest dropdown").toBeTruthy();
  fireEvent.click(trigger);
  fireEvent.click(within(screen.getByRole("listbox")).getByText(label));
};

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = withCustomRequests(["custom_requests"]);
  for (const level of ["error", "warn"]) vi.spyOn(console, level).mockImplementation(() => {});
});

describe.each([
  ["the Tale Creator", TALES, "story", "75%", "3 de 4", () => resetSeenStories, "seenStoryIds"],
  ["the culture pieces", CULTURE, "history_culture", "50%", "1 de 2", () => resetSeenHistoryFacts, "seenHistoryFactsIds"],
])("%s", (_name, loader, ns, pct, count, reset, field) => {
  it("shows how much of the pool has been read", async () => {
    const { i18n } = await mount(loader);

    expect(await first("ByText", i18n.t(`${ns}.seen_title`))).toBeTruthy();
    expect(await first("ByText", pct)).toBeTruthy();
    expect(await first("ByText", count)).toBeTruthy();
  });

  it("forgets what was seen once the reset is confirmed", async () => {
    const { i18n } = await mount(loader);

    fireEvent.click(await first("ByRole", "button", { name: i18n.t(`${ns}.reset_seen_btn`) }));
    fireEvent.click(screen.getByRole("button", { name: i18n.t(`${ns}.reset_seen_confirm`) }));

    await waitFor(() => expect(reset()).toHaveBeenCalledWith("tok", "u1"));
    const update = ctx.current.setUser.mock.calls.at(-1)[0];
    expect(update({ [field]: ["old"] })[field]).toEqual([]);
  });

  it("locks choosing an interest for a plan without custom requests", async () => {
    ctx.current = withCustomRequests([]);
    const { i18n } = await mount(loader);

    expect(await first("ByText", i18n.t("interest_picker.locked"))).toBeTruthy();
    expect(screen.queryByText(i18n.t("interest_picker.none"))).toBeNull();
  });
});

describe("choosing an interest", () => {
  it("writes the next tale about it, and closes the description box meanwhile", async () => {
    const { i18n } = await mount(TALES);

    await chooseInterest(i18n, "Comida");

    const box = screen.getByPlaceholderText(i18n.t("interest_picker.description_blocked"));
    expect(box.disabled).toBe(true);

    fireEvent.click(await first("ByRole", "button", { name: new RegExp(i18n.t("story.get_story"), "i") }));
    await waitFor(() => expect(getStory).toHaveBeenCalled());
    expect(getStory.mock.calls[0][0].interest).toEqual({ id: "food", label: "Comida" });
  });

  it("writes the next culture piece about it", async () => {
    const { i18n } = await mount(CULTURE);

    await chooseInterest(i18n, "Desporto");
    expect(screen.getByPlaceholderText(i18n.t("interest_picker.description_blocked")).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(i18n.t("history_culture.discover"), "i") }));
    await waitFor(() => expect(getFact).toHaveBeenCalled());
    expect(getFact.mock.calls[0][0].interest).toEqual({ id: "sport", label: "Desporto" });
  });

  it("sends none when nothing in particular is chosen", async () => {
    const { i18n } = await mount(TALES);

    fireEvent.click(await first("ByRole", "button", { name: new RegExp(i18n.t("story.get_story"), "i") }));
    await waitFor(() => expect(getStory).toHaveBeenCalled());
    expect(getStory.mock.calls[0][0].interest).toBeNull();
  });
});

describe("a culture piece's actions", () => {
  it("puts the PDF beside the practice-language toggle, as in the Tale Creator", async () => {
    // Written in English, so there is a pt-PT version to offer.
    getFact.mockResolvedValueOnce({
      factId: "f8", title: "Fado", paragraphs: ["It is sung."], locale: "en-US", sourceLocale: "en-US", source: "ai",
    });
    const { i18n } = await mount(CULTURE);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(i18n.t("history_culture.discover"), "i") }));

    const toggle = await screen.findByRole("button", { name: i18n.t("history_culture.show_practice", { locale: "pt-PT" }) });
    const pdf = screen.getByRole("button", { name: i18n.t("pdf.download") });
    const row = toggle.closest(".flex-wrap");
    expect(row).toBeTruthy();
    expect(row.contains(pdf)).toBe(true);
    // Not up in the title row any more.
    expect(screen.getByRole("heading", { name: "Fado" }).parentElement.contains(pdf)).toBe(false);
  });
});

describe("a culture piece in the language being practised", () => {
  it("translates the title along with the paragraphs", async () => {
    getFact.mockResolvedValueOnce({
      factId: "f7", title: "Fado", paragraphs: ["It is sung."], locale: "en-US", sourceLocale: "en-US", source: "ai",
    });
    const { getFactContent } = await import("../../src/services/historyCultureService");
    getFactContent.mockResolvedValueOnce({ title: "O fado", paragraphs: ["Canta-se."], locale: "pt-PT" });
    const { i18n } = await mount(CULTURE);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(i18n.t("history_culture.discover"), "i") }));
    fireEvent.click(await screen.findByRole("button", { name: i18n.t("history_culture.show_practice", { locale: "pt-PT" }) }));

    // Tappable, so it arrives a word at a time; the paragraph holds the whole.
    const title = await waitFor(() => {
      const found = [...document.querySelectorAll('p[lang="pt-PT"]')].find((p) => p.textContent === "O fado");
      expect(found).toBeTruthy();
      return found;
    });
    expect(title.textContent).toBe("O fado");
    expect(await screen.findByText("Canta-se.", { exact: false })).toBeTruthy();

    // Hidden again with the rest of the practice version.
    fireEvent.click(screen.getByRole("button", { name: i18n.t("history_culture.hide_practice", { locale: "pt-PT" }) }));
    expect([...document.querySelectorAll('p[lang="pt-PT"]')].some((p) => p.textContent === "O fado")).toBe(false);
  });
});
