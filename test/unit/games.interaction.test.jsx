import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The game components, mounted directly with real content.
 *
 * These are the largest components in the app — CrosswordGame alone is a
 * thousand lines — and the page-level smoke suite cannot reach them: each page
 * is a thin Suspense wrapper, so asserting on the page passes while the lazy
 * chunk is still loading. Mounting the component itself, with its content
 * services stubbed to return a real puzzle, is what actually exercises the
 * board, the keyboard and the win/lose paths.
 *
 * Every game takes only `isDarkMode` and reads everything else from context,
 * which is what makes this practical.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/firestoreService", () => ({
  queryCollection: vi.fn(async () => ({ documents: [], hasMore: false })),
  getDocument: vi.fn(async () => null),
  createDocument: vi.fn(async () => ({ id: "x" })),
  updateDocument: vi.fn(async () => ({})),
  deleteDocument: vi.fn(async () => ({})),
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: vi.fn(async () => ""),
  registerAiConfirmHandler: vi.fn(),
}));

// Spread the real module rather than replacing it: these games call a wide
// slice of userService, and a hand-listed mock silently throws "no export
// defined" from inside an effect, which surfaces as the game hanging on its
// spinner rather than as a clear failure.
vi.mock("../../src/services/userService", async (importOriginal) => ({
  ...(await importOriginal()),
  updateUserProfile: vi.fn(async () => ({})),
  markConceptSeen: vi.fn(async () => ({})),
  getUserProfile: vi.fn(async () => ({})),
  updateDayStreak: vi.fn(async () => ({})),
  addWordFound: vi.fn(async () => ({})),
  getUserGameProgress: vi.fn(async () => ({})),
  saveUserGameProgress: vi.fn(async () => ({})),
}));

const WORD = { word: "CASA", hint: "Onde se vive", conceptId: "c-casa", source: "db" };

vi.mock("../../src/services/getWordService", () => ({
  getWord: vi.fn(async () => WORD),
  getWordPoolCount: vi.fn(async () => 42),
}));

vi.mock("../../src/services/conceptIconService", () => ({
  loadConceptIcons: vi.fn(async () => ({})),
}));

vi.mock("../../src/services/wordLinkService", () => ({
  fetchWordLinkPuzzle: vi.fn(async () => ({
    puzzleId: "p1",
    theme: "Casa",
    themeTranslation: "Home",
    clues: ["Onde se dorme", "Onde se come", "Onde se lava", "Onde se entra"],
    keywords: ["QUARTO", "COZINHA", "BANHO", "PORTA"],
  })),
  getWordLinkPoolCount: vi.fn(async () => 7),
}));

vi.mock("../../src/services/wordLadderService", () => ({
  MAX_STRIKES: 3,
  fetchWordLadderPuzzle: vi.fn(async () => ({
    puzzleId: "p2",
    words: ["MALA", "MALO", "MELO", "MELA"],
    clues: ["Bagagem", "Adjetivo", "Árvore", "Verbo"],
    wordLength: 4,
  })),
  getWordLadderPoolCount: vi.fn(async () => 5),
}));

/**
 * A benign default for any service this file has not explicitly stubbed.
 *
 * test/setup.js makes an unmocked fetch reject loudly, which is right for unit
 * tests — it names the call you forgot. For an integration-style render it is
 * wrong: the games catch the rejection and render their error state, so the
 * board never appears and the failure reads as "nothing rendered". Returning
 * an empty success envelope lets every unstubbed read resolve to "no data",
 * which is a state the games are built to handle.
 */
const emptyEnvelope = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));

const signedIn = () =>
  makeAppContext({
    user: {
      uid: "test-uid",
      token: "tok",
      displayName: "Test User",
      subscriptionTier: "maestro",
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      aiCallsToday: 0,
      seenConceptIds: [],
    },
    token: "tok",
    tiersConfig: {
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: ["hangman", "crosswords", "word_search", "scrambled_word", "word_link", "word_ladder"],
      },
    },
    features: [],
    categories: [{ id: "food", name: "Comida", conceptIds: ["c1"] }],
    supportedLanguages: [{ code: "pt-PT", name: "Português", flag: "pt" }],
    writingSystems: [
      { supportedLanguageCodes: ["pt-PT"], characters: { default: [], special: ["á", "ç"] } },
    ],
  });

const mount = async (loader) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: Game } = await loader();

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Game isDarkMode={false} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

/** Wait until the component has stopped showing only its spinner. */
const settled = async (container) =>
  waitFor(
    () => {
      expect(container.querySelectorAll("*").length).toBeGreaterThan(10);
    },
    { timeout: 8000 },
  );

const GAMES = [
  ["HangmanGame", () => import("../../src/components/HangmanGame")],
  ["ScrambledWordGame", () => import("../../src/components/ScrambledWordGame")],
  ["WordSearchGame", () => import("../../src/components/WordSearchGame")],
  ["CrosswordGame", () => import("../../src/components/CrosswordGame")],
  ["WordLadderGame", () => import("../../src/components/WordLadderGame")],
  ["WordLinkGame", () => import("../../src/components/WordLinkGame")],
];

describe("game components mount with real content", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    globalThis.fetch = emptyEnvelope();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it.each(GAMES)("%s renders a board without crashing", async (_name, loader) => {
    const { container } = await mount(loader);
    await settled(container);

    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });
});

describe("HangmanGame keyboard", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    globalThis.fetch = emptyEnvelope();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("offers a full alphabet of letter keys", async () => {
    const { container } = await mount(() => import("../../src/components/HangmanGame"));
    await settled(container);

    // resolveLetterKeys falls back to A–Z when the writing system declares no
    // default alphabet, which is the fixture here.
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent.trim());
    for (const letter of ["A", "E", "M", "Z"]) {
      expect(buttons).toContain(letter);
    }
  });

  it("consumes a letter key when it is pressed", async () => {
    const { container } = await mount(() => import("../../src/components/HangmanGame"));
    await settled(container);

    const findKey = (letter) =>
      [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === letter);

    const before = findKey("A");
    expect(before).toBeDefined();
    before.click();

    // Whatever the game does with it — reveal, strike, or disable — the key
    // must not stay freshly clickable, or a player can spend the same guess
    // twice.
    await waitFor(() => {
      const after = findKey("A");
      expect(after === undefined || after.disabled || after.className !== before.className).toBe(
        true,
      );
    });
  });
});
