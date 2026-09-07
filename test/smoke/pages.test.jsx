import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";
import ptBundle from "../../src/locales/pt/translation.json";

/**
 * Render smoke tests.
 *
 * The bar is deliberately low and deliberately broad: every page mounts, gets
 * past its effects, and puts something real on the screen. That is the
 * assertion a dependency bump breaks — React 19 turned the dashboard into one
 * column, and a page that renders nothing at all is the next version of the
 * same failure.
 *
 * Feature pages lazy-load their heavy component (HangmanGame, ReadingExercise,
 * FullExamExercise…), so waiting for real content here exercises those too —
 * which is where most of this app's code actually lives.
 *
 * They are not behaviour tests. Anything asserting *what* a page does belongs
 * in a suite next to that feature; this one only has to notice when the app
 * stops rendering, which is the part `lint` and `build` cannot see.
 */

// The mock factory is hoisted above everything, so it reads the context
// through a mutable holder rather than closing over a fixed value. That lets
// one file cover both the signed-out and signed-in trees, which render very
// different components.
const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

// Services all talk to the proxy. Left real, each page would sit in a loading
// state waiting on a rejected fetch, so the smoke test would prove nothing.
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

/**
 * Game content. Without these the four puzzle games mount their lazy chunk and
 * then sit in their own "loading words" state forever, because the generic
 * firestore mock returns no documents — so the board, which is most of the
 * code, never renders.
 */
vi.mock("../../src/services/getWordService", () => ({
  getWord: vi.fn(async () => ({
    word: "CASA",
    hint: "Onde se vive",
    conceptId: "c-casa",
    source: "db",
  })),
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
    keywords: ["QUARTO", "COZINHA", "CASADEBANHO", "PORTA"],
  })),
  getWordLinkPoolCount: vi.fn(async () => 7),
}));

vi.mock("../../src/services/wordLadderService", () => ({
  MAX_STRIKES: 3,
  fetchWordLadderPuzzle: vi.fn(async () => ({
    puzzleId: "p2",
    words: ["MALA", "MALO", "MELO", "MELA"],
    clues: ["Bagagem", "Adjetivo", "Arvore", "Verbo"],
    wordLength: 4,
  })),
  getWordLadderPoolCount: vi.fn(async () => 5),
}));

/**
 * Matches text shaped like `<namespace>.<something>` where <namespace> is a
 * real top-level group in the pt-PT bundle. Built from the bundle itself, so a
 * new section is covered without anyone editing this file.
 */
const I18N_KEY_RE = new RegExp(
  `\\b(?:${Object.keys(ptBundle).join("|")})(?:\\.[a-z0-9_]+)+\\b`,
);

/**
 * What "rendered correctly" means for a smoke test.
 *
 * `textContent.length > 0` is not enough — a page with a broken i18n backend
 * or a collapsed layout still paints characters. These three checks each fail
 * on a real dependency regression:
 *
 *  - a non-trivial element count catches a tree that mounted and then bailed;
 *  - the error-boundary fallback catches a page that threw and was caught;
 *  - a raw translation key on screen catches react-i18next resolving nothing,
 *    which otherwise renders as plausible-looking dotted text.
 *
 * That last check is anchored to the bundle's own top-level namespaces rather
 * than to "any dotted lowercase word". A generic pattern cannot tell a key
 * from a domain, and the legal pages legitimately print one
 * (grasshopper.it.solutions), so it flagged Terms and Privacy on first run.
 */
const expectRendered = (container) => {
  expect(container.querySelectorAll("*").length).toBeGreaterThan(3);

  const text = container.textContent;
  expect(text.trim().length).toBeGreaterThan(0);

  const rawKey = text.match(I18N_KEY_RE);
  expect(rawKey, `untranslated key rendered: ${rawKey?.[0]}`).toBeNull();
};

const renderPage = async (Component) => {
  const { default: i18n } = await import("../../src/i18n");
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Component />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

/**
 * A benign default for services this file does not stub explicitly.
 *
 * test/setup.js makes an unmocked fetch reject loudly, which is right for unit
 * tests. For a page render it is wrong: the page catches the rejection and
 * renders its error state, so the real content never appears and the smoke
 * test passes against an error screen. An empty success envelope resolves each
 * unstubbed read to "no data", which every page is built to handle.
 */
const emptyEnvelope = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));

const quietConsole = () => {
  globalThis.fetch = emptyEnvelope();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
};

/** Pages with no required props, reachable without a signed-in user. */
const PUBLIC_PAGES = [
  ["HomePage", () => import("../../src/pages/HomePage")],
  ["LoginPage", () => import("../../src/pages/LoginPage")],
  ["TermsPage", () => import("../../src/pages/TermsPage")],
  ["PrivacyPage", () => import("../../src/pages/PrivacyPage")],
  ["ContactPage", () => import("../../src/pages/ContactPage")],
  ["PricingPage", () => import("../../src/pages/PricingPage")],
  ["AppUnavailablePage", () => import("../../src/pages/AppUnavailablePage")],
];

describe("public pages render", () => {
  beforeEach(() => {
    ctx.current = makeAppContext();
    quietConsole();
  });

  it.each(PUBLIC_PAGES)("%s mounts and paints", async (_name, load) => {
    const { default: Page } = await load();
    const { container } = await renderPage(Page);

    await waitFor(() => expectRendered(container));
  });
});

/**
 * A signed-in Maestro with the tier config loaded — what useTierAccess needs
 * before `isReady` is true and the dashboard renders tiles rather than a
 * loading state.
 */
const signedIn = () =>
  makeAppContext({
    user: {
      uid: "test-uid",
      displayName: "Test User",
      email: "test@example.com",
      subscriptionTier: "maestro",
      aiCallsToday: 0,
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      level: "B1",
    },
    tiersConfig: {
      explorer: {
        id: "explorer",
        label: "Explorer",
        order: 0,
        isFree: true,
        hidden: false,
        aiCallsPerDay: 5,
        features: [],
      },
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: [
          "translator",
          "dictionary",
          "real_person_tutor",
          "story_generator",
          "history_culture",
          "hangman",
          "crosswords",
          "word_search",
          "scrambled_word",
          "word_link",
          "word_ladder",
          "reading_exercise",
          "listening_exercise",
          "writing_exercise",
          "full_exam",
          "grammar_structures",
          "grammar_tips",
          "grammar_ask",
        ],
      },
    },
    features: [],
    // Real category ids: the app renders these through a dynamic
    // t(`categories.${id}`), so an invented id renders as a raw key and
    // trips the leaked-key check above — correctly, since that is exactly
    // what a user would see.
    categories: [
      { id: "food", name: "Comida", conceptIds: ["c1", "c2"] },
      { id: "travel", name: "Viagens", conceptIds: ["c3"] },
    ],
    supportedLanguages: [
      { code: "pt-PT", name: "Português", flag: "pt" },
      { code: "en-US", name: "English", flag: "us" },
    ],
    writingSystems: [
      { supportedLanguageCodes: ["pt-PT"], characters: { default: [], special: ["á", "ç"] } },
    ],
  });

const DASHBOARD_PAGES = [
  ["DashboardHomePage", () => import("../../src/pages/dashboard/DashboardHomePage")],
  ["TranslatorPage", () => import("../../src/pages/dashboard/TranslatorPage")],
  ["DictionaryPage", () => import("../../src/pages/dashboard/DictionaryPage")],
  ["TutorsPage", () => import("../../src/pages/dashboard/TutorsPage")],
  ["StoryGeneratorPage", () => import("../../src/pages/dashboard/StoryGeneratorPage")],
  ["HistoryCulturePage", () => import("../../src/pages/dashboard/HistoryCulturePage")],
  ["SettingsPage", () => import("../../src/pages/SettingsPage")],
  ["OnboardingPage", () => import("../../src/pages/OnboardingPage")],
  ["SubscriptionResultPage", () => import("../../src/pages/SubscriptionResultPage")],
];

describe("dashboard pages render for a signed-in user", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    quietConsole();
  });

  it.each(DASHBOARD_PAGES)("%s mounts and paints", async (_name, load) => {
    const { default: Page } = await load();
    const { container } = await renderPage(Page);

    await waitFor(() => expectRendered(container));
  });
});

/**
 * Feature pages: the route shell, breadcrumbs and tier gating.
 *
 * Each page is a thin wrapper around a lazily imported component, and this
 * suite asserts the wrapper only — the Suspense fallback may still be up when
 * the assertion passes. The heavy components those pages load are covered
 * directly in test/unit/games.interaction.test.jsx, where they can be given
 * real content and driven; waiting for them here made four pages hang for ten
 * seconds each without testing them.
 */
const FEATURE_PAGES = [
  ["HangmanPage", () => import("../../src/pages/dashboard/games/HangmanPage")],
  ["CrosswordsPage", () => import("../../src/pages/dashboard/games/CrosswordsPage")],
  ["WordSearchPage", () => import("../../src/pages/dashboard/games/WordSearchPage")],
  ["ScrambledWordPage", () => import("../../src/pages/dashboard/games/ScrambledWordPage")],
  ["WordLinkPage", () => import("../../src/pages/dashboard/games/WordLinkPage")],
  ["WordLadderPage", () => import("../../src/pages/dashboard/games/WordLadderPage")],
  ["WordQuizComingSoonPage", () => import("../../src/pages/dashboard/games/WordQuizComingSoonPage")],
  ["ReadingExercisePage", () => import("../../src/pages/dashboard/exercises/ReadingExercisePage")],
  ["ListeningExercisePage", () => import("../../src/pages/dashboard/exercises/ListeningExercisePage")],
  ["WritingExercisePage", () => import("../../src/pages/dashboard/exercises/WritingExercisePage")],
  ["FullExamExercisePage", () => import("../../src/pages/dashboard/exercises/FullExamExercisePage")],
  ["GrammarStructuresPage", () => import("../../src/pages/dashboard/grammar/GrammarStructuresPage")],
  ["GrammarTipsPage", () => import("../../src/pages/dashboard/grammar/GrammarTipsPage")],
  ["GrammarAskPage", () => import("../../src/pages/dashboard/grammar/GrammarAskPage")],
  [
    "GrammarPracticeComingSoonPage",
    () => import("../../src/pages/dashboard/grammar/GrammarPracticeComingSoonPage"),
  ],
  ["AiTutorPage", () => import("../../src/pages/dashboard/coming-soon/AiTutorPage")],
  ["VoicePracticePage", () => import("../../src/pages/dashboard/coming-soon/VoicePracticePage")],
  ["FoodPage", () => import("../../src/pages/dashboard/coming-soon/FoodPage")],
  ["RadioTvPage", () => import("../../src/pages/dashboard/coming-soon/RadioTvPage")],
  ["PlanTripPage", () => import("../../src/pages/dashboard/coming-soon/PlanTripPage")],
  [
    "ProfessionalToolsPage",
    () => import("../../src/pages/dashboard/coming-soon/ProfessionalToolsPage"),
  ],
];

describe("feature page shells render", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    quietConsole();
  });

  it.each(FEATURE_PAGES)("%s mounts and paints", async (_name, load) => {
    const { default: Page } = await load();
    const { container } = await renderPage(Page);

    await waitFor(() => expectRendered(container), { timeout: 10000 });
  });
});
