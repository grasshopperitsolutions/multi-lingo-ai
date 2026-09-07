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
 * past its effects, and puts something on the screen. That is the assertion a
 * dependency bump breaks — React 19 turned the dashboard into one column, and
 * a page that renders nothing at all is the next version of the same failure.
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
/**
 * Matches text shaped like `<namespace>.<something>` where <namespace> is a
 * real top-level group in the pt-PT bundle. Built from the bundle itself, so a
 * new section is covered without anyone editing this file.
 */
const I18N_KEY_RE = new RegExp(
  `\\b(?:${Object.keys(ptBundle).join("|")})(?:\\.[a-z0-9_]+)+\\b`,
);

const expectRendered = (container) => {
  expect(container.querySelectorAll("*").length).toBeGreaterThan(3);

  const text = container.textContent;
  expect(text.trim().length).toBeGreaterThan(0);

  // e.g. "tutors.profile.save_button" leaking through as visible copy.
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
    // Pages that report render errors to Sentry should not fail the run on
    // console noise, but a genuine React error still throws through render().
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
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
    },
    tiersConfig: {
      explorer: { id: "explorer", label: "Explorer", order: 0, isFree: true, hidden: false, aiCallsPerDay: 5, features: [] },
      maestro: {
        id: "maestro",
        label: "Maestro",
        order: 3,
        isFree: false,
        hidden: false,
        aiCallsPerDay: Infinity,
        features: ["translator", "dictionary", "real_person_tutor", "story_generator", "history_culture"],
      },
    },
    features: [],
    supportedLanguages: [{ code: "pt-PT", name: "Portugues" }],
  });

const DASHBOARD_PAGES = [
  ["DashboardHomePage", () => import("../../src/pages/dashboard/DashboardHomePage")],
  ["TranslatorPage", () => import("../../src/pages/dashboard/TranslatorPage")],
  ["DictionaryPage", () => import("../../src/pages/dashboard/DictionaryPage")],
  ["TutorsPage", () => import("../../src/pages/dashboard/TutorsPage")],
  ["StoryGeneratorPage", () => import("../../src/pages/dashboard/StoryGeneratorPage")],
  ["HistoryCulturePage", () => import("../../src/pages/dashboard/HistoryCulturePage")],
  ["SettingsPage", () => import("../../src/pages/SettingsPage")],
];

describe("dashboard pages render for a signed-in user", () => {
  beforeEach(() => {
    ctx.current = signedIn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it.each(DASHBOARD_PAGES)("%s mounts and paints", async (_name, load) => {
    const { default: Page } = await load();
    const { container } = await renderPage(Page);

    await waitFor(() => expectRendered(container));
  });
});
