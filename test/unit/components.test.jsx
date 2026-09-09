import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The remaining heavy components, mounted directly.
 *
 * Same reasoning as the games suite: exercises and admin sections hold a large
 * share of this app's code and none of it is reachable from the page-level
 * smoke tests, which stop at the Suspense boundary. Mounting each component
 * with plausible props exercises its real render path.
 *
 * Admin components are included for *rendering* only. The standing preference
 * is not to browser-test admin features, and nothing here asserts on admin
 * behaviour — these only prove the components still mount, which is exactly
 * the dependency-regression question.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: vi.fn(async () => ""),
  registerAiConfirmHandler: vi.fn(),
}));

/** See the note in games.interaction.test.jsx — an empty success envelope. */
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
      email: "test@example.com",
      subscriptionTier: "maestro",
      learningDialect: "pt-PT",
      interfaceLang: "pt-PT",
      level: "B1",
      aiCallsToday: 0,
      seenConceptIds: [],
      notificationPrefs: { announcements: true, reminders: false },
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
        features: ["reading_exercise", "listening_exercise", "writing_exercise", "full_exam"],
      },
    },
    features: [],
    categories: [{ id: "food", name: "Comida", conceptIds: ["c1"] }],
    supportedLanguages: [{ code: "pt-PT", name: "Português", flag: "pt" }],
    writingSystems: [
      { supportedLanguageCodes: ["pt-PT"], characters: { default: [], special: ["á"] } },
    ],
  });

const mount = async (loader, props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: Component } = await loader();

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Component isDarkMode={false} {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const settled = (container) =>
  waitFor(() => expect(container.querySelectorAll("*").length).toBeGreaterThan(3), {
    timeout: 8000,
  });

const setup = () => {
  ctx.current = signedIn();
  globalThis.fetch = emptyEnvelope();
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
};

const EXERCISES = [
  ["ReadingExercise", () => import("../../src/components/ReadingExercise"), {}],
  ["ListeningExercise", () => import("../../src/components/ListeningExercise"), {}],
  ["WritingExercise", () => import("../../src/components/WritingExercise"), {}],
  ["FullExamExercise", () => import("../../src/components/FullExamExercise"), { onBack: vi.fn() }],
];

describe("exercise components mount", () => {
  beforeEach(setup);

  it.each(EXERCISES)("%s renders without crashing", async (_name, loader, props) => {
    const { container } = await mount(loader, props);
    await settled(container);
    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });
});

const PANELS = [
  ["StoryReader", () => import("../../src/components/StoryReader"), {}],
  ["DictionaryPanel", () => import("../../src/components/DictionaryPanel"), { onBack: vi.fn() }],
  [
    "TranslatorPanel",
    () => import("../../src/components/TranslatorPanel"),
    { onBack: vi.fn(), onLookupInDictionary: vi.fn() },
  ],
  [
    "NotificationSettings",
    () => import("../../src/components/NotificationSettings"),
    { user: { uid: "u", token: "t", notificationPrefs: {} }, sectionClasses: "", onSaved: vi.fn() },
  ],
  // TutorProfileSection is deliberately not in this sweep: with the generic
  // fetch stub here, getTutorProfile resolves to null (no tutor document),
  // and the component correctly renders nothing at all for that case — see
  // its own file header. `settled()` below waits for real content and would
  // time out against that correct-but-empty render. tutorProfileSection.test.jsx
  // covers it properly, with a tutorService mock that returns a profile.
  ["Header", () => import("../../src/components/Header"), {}],
  ["Footer", () => import("../../src/components/Footer"), {}],
  ["GrammarMenu", () => import("../../src/components/GrammarMenu"), {}],
  ["ChallengesMenu", () => import("../../src/components/ChallengesMenu"), {}],
  ["ExamTrainingMenu", () => import("../../src/components/ExamTrainingMenu"), {}],
];

describe("panel and chrome components mount", () => {
  beforeEach(setup);

  it.each(PANELS)("%s renders without crashing", async (_name, loader, props) => {
    const { container } = await mount(loader, props);
    await settled(container);
    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });
});

/*
 * No tests for src/components/books/*.
 *
 * BookShelf, Book, BookSpread and config/dashboardBooks.js import each other
 * and nothing else in the app imports them — the 3D shelf was built but never
 * wired into a page, so the tree is dropped from the bundle entirely. Testing
 * it would raise the coverage number against code that does not ship, and any
 * fixture would be inventing a contract no caller has fixed yet. Wire it up or
 * delete it; either way the tests belong with that decision.
 */

/**
 * Admin sections. Props mirror what AdminPage passes; each is rendered in its
 * loaded, empty and error states, because those are three different branches
 * and the empty one is what a fresh install actually shows.
 */
const ADMIN_SECTIONS = [
  [
    "UsersSection",
    () => import("../../src/components/admin/UsersSection"),
    { users: [], currentUid: "u1", onSetTier: vi.fn(), onDeleteUser: vi.fn() },
  ],
  [
    "TiersSection",
    () => import("../../src/components/admin/TiersSection"),
    { tiers: [], featureCount: 0, onEditTier: vi.fn() },
  ],
  [
    "FeaturesSection",
    () => import("../../src/components/admin/FeaturesSection"),
    { features: [], onAddFeature: vi.fn(), onEditFeature: vi.fn(), onToggleHidden: vi.fn() },
  ],
  [
    "CategoriesSection",
    () => import("../../src/components/admin/CategoriesSection"),
    {
      categories: [],
      onAddCategory: vi.fn(),
      onEditCategory: vi.fn(),
      onDeleteCategory: vi.fn(),
    },
  ],
  [
    "LocalesSection",
    () => import("../../src/components/admin/LocalesSection"),
    { docs: [], onForceOverwrite: vi.fn(), onRefreshLocale: vi.fn() },
  ],
  [
    "PromptsSection",
    () => import("../../src/components/admin/PromptsSection"),
    { prompts: [], onEditPrompt: vi.fn() },
  ],
  [
    "GenericDocsSection",
    () => import("../../src/components/admin/GenericDocsSection"),
    { docs: [], onEditDoc: vi.fn() },
  ],
  [
    "LoginProvidersSection",
    () => import("../../src/components/admin/LoginProvidersSection"),
    { providers: [], onToggle: vi.fn() },
  ],
  ["NotificationsSection", () => import("../../src/components/admin/NotificationsSection"), { users: [] }],
  ["EmailTemplatesSection", () => import("../../src/components/admin/EmailTemplatesSection"), {}],
  [
    "ReportsSection",
    () => import("../../src/components/admin/ReportsSection"),
    { reports: [], onToggleRead: vi.fn(), onDelete: vi.fn() },
  ],
  [
    "TutorApplicationsSection",
    () => import("../../src/components/admin/TutorApplicationsSection"),
    { applications: [], onToggleRead: vi.fn(), onDelete: vi.fn() },
  ],
];

describe("admin sections mount", () => {
  beforeEach(setup);

  it.each(ADMIN_SECTIONS)("%s renders in its empty state", async (_name, loader, props) => {
    // No `settled` here: an empty admin table is legitimately a heading and a
    // single "nothing yet" line, which is fewer nodes than a real screen.
    const { container } = await mount(loader, { isLoadingDocs: false, error: null, ...props });
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0));
  });

  it.each(ADMIN_SECTIONS)("%s renders while loading", async (_name, loader, props) => {
    const { container } = await mount(loader, { isLoadingDocs: true, error: null, ...props });
    await waitFor(() => expect(container).toBeTruthy());
  });

  it.each(ADMIN_SECTIONS)("%s renders an error without crashing", async (_name, loader, props) => {
    const { container } = await mount(loader, {
      isLoadingDocs: false,
      error: "Something failed",
      ...props,
    });
    await waitFor(() => expect(container).toBeTruthy());
  });
});
