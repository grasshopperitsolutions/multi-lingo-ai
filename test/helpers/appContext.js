import { vi } from "vitest";

/**
 * A complete, inert AppContext value.
 *
 * Every key the real provider exposes is present, because a page that
 * destructures a key this object forgets fails with "cannot read property of
 * undefined" — a helper bug that reads exactly like the dependency regression
 * these tests exist to find. Functions are spies so a test can assert on them;
 * collections are empty so pages render their empty state rather than needing
 * fixtures.
 */
export function makeAppContext(overrides = {}) {
  return {
    // ── session ──
    user: null,
    setUser: vi.fn(),
    token: "test-token",
    validateToken: vi.fn(async () => true),
    tokenExpired: false,
    handleTokenExpired: vi.fn(),
    dismissTokenExpired: vi.fn(),
    isLoadingUser: false,
    refreshUser: vi.fn(async () => {}),

    // ── auth actions ──
    loginGoogle: vi.fn(),
    loginApple: vi.fn(),
    loginFacebook: vi.fn(),
    loginTwitter: vi.fn(),
    logoutUser: vi.fn(),

    // ── presentation ──
    isDarkMode: false,
    alert: null,
    showAlert: vi.fn(),
    closeAlert: vi.fn(),

    // ── reference data ──
    categories: [],
    isLoadingCategories: false,
    refreshCategories: vi.fn(),
    supportedLanguages: [],
    isLoadingLanguages: false,
    refreshSupportedLanguages: vi.fn(),
    writingSystems: [],
    isLoadingWritingSystems: false,
    tiersConfig: {},
    isLoadingTiers: false,
    refreshTiersConfig: vi.fn(),
    features: [],

    // ── i18n ──
    interfaceLang: "pt-PT",
    interfaceLanguageOptions: [],
    changeLanguage: vi.fn(),
    isLoadingTranslations: false,

    // ── progress ──
    dayStreak: 0,
    highestDayStreak: 0,
    seenExerciseIds: [],
    seenStoryIds: [],
    seenHistoryFactsIds: [],
    wordsFound: [],

    // ── exams ──
    examSession: null,
    setExamSession: vi.fn(),
    updateExamSection: vi.fn(),

    // ── AI confirmation ──
    aiConfirm: null,
    resolveAiConfirm: vi.fn(),

    ...overrides,
  };
}
