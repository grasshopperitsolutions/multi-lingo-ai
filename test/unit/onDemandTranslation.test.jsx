import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * Translations are fetched when somebody asks to see one, and not before.
 *
 * Both reading features used to translate eagerly: the story reader fired
 * `getStoryTranslation` the moment a story loaded, while every paragraph
 * rendered collapsed, and History & Culture fetched its piece already
 * translated. Most readers never open a translation at all, so the call was
 * made on their behalf and thrown away.
 *
 * The result is cached per locale in Firestore, so this only ever cost the
 * *first* reader of a piece in a given language — which is still a reader
 * paying for something they did not ask for, and on a free tier that is one of
 * three calls for the day.
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

const STORY = {
  storyId: "s1",
  title: "O gato",
  paragraphs: ["O gato dorme.", "O cão ladra."],
  targetLang: "pt-PT",
  level: "A1",
};

const getStory = vi.fn(async () => STORY);
const getStoryTranslation = vi.fn(async () => ({
  title: "The cat",
  paragraphs: ["The cat sleeps.", "The dog barks."],
  locale: "en-US",
}));

vi.mock("../../src/services/storyService", () => ({
  getStory: (...a) => getStory(...a),
  getStoryTranslation: (...a) => getStoryTranslation(...a),
  getStoryPoolStatus: vi.fn(async () => ({ exhausted: false, remaining: 5 })),
}));

vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  markStorySeen: vi.fn(async () => ({})),
  updateUserProfile: vi.fn(async () => ({})),
}));

/** Reading in Portuguese with an English interface, so a translation exists. */
const signedIn = () =>
  makeAppContext({
    user: {
      uid: "u1",
      token: "tok",
      displayName: "Test",
      subscriptionTier: "maestro",
      learningDialect: "pt-PT",
      interfaceLang: "en-US",
      level: "A1",
      aiCallsToday: 0,
      seenStoryIds: [],
    },
    token: "tok",
    interfaceLang: "en-US",
    tiersConfig: {
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: ["story_generator", "custom_requests"],
      },
    },
    features: [],
    categories: [],
    supportedLanguages: [{ code: "pt-PT", name: "Português", flag: "pt" }],
    writingSystems: [],
  });

const mount = async () => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: StoryReader } = await import("../../src/components/StoryReader");

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <StoryReader isDarkMode={false} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const loadStory = async (container) => {
  // By its own label: the page also carries a back arrow, a level picker and a
  // theme picker, and "the first enabled button" is none of them.
  const { default: i18n } = await import("../../src/i18n");
  const label = i18n.t("story.get_story");
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label,
  );
  expect(button, `no button labelled "${label}"`).toBeTruthy();

  fireEvent.click(button);
  await waitFor(() => expect(container.textContent).toContain("O gato dorme."));
};

/**
 * The per-paragraph reveals, by their own label.
 *
 * Not `button[aria-expanded]`: NeoDropdown's trigger carries that too, so the
 * level and theme pickers match it — and clicking one of those opens a menu
 * while the test waits for a translation that was never asked for.
 */
const revealButtons = async (container) => {
  const { default: i18n } = await import("../../src/i18n");
  const show = i18n.t("story.show_translation");
  const hide = i18n.t("story.hide_translation");
  return [...container.querySelectorAll("button")].filter((b) => {
    const text = b.textContent.trim();
    return text === show || text === hide;
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = signedIn();
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

describe("the story reader", () => {
  it("does not translate a story nobody has asked to see translated", async () => {
    const { container } = await mount();
    await loadStory(container);

    // The paragraphs are on screen and closed. That is the whole of what most
    // readers ever do with a story.
    expect(getStory).toHaveBeenCalled();
    expect(getStoryTranslation).not.toHaveBeenCalled();
  });

  it("still offers the reveal before there is anything to reveal", async () => {
    const { container } = await mount();
    await loadStory(container);

    // The button used to render only once the translation had arrived, which
    // with a lazy fetch would mean it never rendered at all.
    expect((await revealButtons(container)).length).toBeGreaterThan(0);
  });

  it("fetches once when the first paragraph is opened", async () => {
    const { container } = await mount();
    await loadStory(container);

    fireEvent.click((await revealButtons(container))[0]);

    await waitFor(() => expect(container.textContent).toContain("The cat sleeps."));
    expect(getStoryTranslation).toHaveBeenCalledTimes(1);
  });

  it("does not fetch again for the second paragraph", async () => {
    const { container } = await mount();
    await loadStory(container);

    fireEvent.click((await revealButtons(container))[0]);
    await waitFor(() => expect(getStoryTranslation).toHaveBeenCalledTimes(1));
    fireEvent.click((await revealButtons(container))[1]);

    await waitFor(() => expect(container.textContent).toContain("The dog barks."));
    expect(getStoryTranslation).toHaveBeenCalledTimes(1);
  });

  it("asks once when several paragraphs are opened at the same moment", async () => {
    const { container } = await mount();
    await loadStory(container);

    // Two presses before the first request settles must not be two requests —
    // that is what the in-flight ref is for.
    const buttons = await revealButtons(container);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);

    await waitFor(() => expect(container.textContent).toContain("The cat sleeps."));
    expect(getStoryTranslation).toHaveBeenCalledTimes(1);
  });
});
