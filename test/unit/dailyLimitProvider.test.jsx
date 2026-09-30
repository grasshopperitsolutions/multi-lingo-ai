import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

/**
 * Running out of AI calls, as the real AppProvider handles it.
 *
 * With nothing left, a call fails as the limit before anything is sent, so
 * every screen can offer the plans; the warning at one or two calls left has
 * its own way to them; and the limit alert's button leads there. The harness
 * is a trimmed copy of sessionToken.test.jsx's.
 */

const listeners = { auth: [], token: [] };
const fakeAuth = {
  currentUser: null,
  onAuthStateChanged: (cb) => {
    listeners.auth.push(cb);
    return () => {};
  },
  onIdTokenChanged: (cb) => {
    listeners.token.push(cb);
    return () => {};
  },
  signOut: vi.fn(async () => {
    fakeAuth.currentUser = null;
  }),
};

vi.mock("../../src/firebase", () => ({
  auth: fakeAuth,
  default: {},
  getMessagingIfSupported: vi.fn(async () => null),
}));
vi.mock("../../src/services/authService", () => ({
  loginWithGoogle: vi.fn(async () => ({})),
  loginWithApple: vi.fn(async () => ({})),
  loginWithFacebook: vi.fn(async () => ({})),
  loginWithTwitter: vi.fn(async () => ({})),
  logout: vi.fn(async () => {}),
}));
vi.mock("../../src/services/tiersConfigService", () => ({
  getTiersConfig: vi.fn(async () => ({
    explorer: { id: "explorer", label: "Explorer", order: 0, isFree: true, aiCallsPerDay: 5, features: [] },
  })),
}));
vi.mock("../../src/services/featuresService", () => ({
  getFeatures: vi.fn(async () => []),
}));
const profile = { current: {} };
vi.mock("../../src/services/userService", () => ({
  getUserProfile: vi.fn(async () => profile.current),
  updateDayStreak: vi.fn(async () => ({ dayStreak: 1, highestDayStreak: 1 })),
  updateUserProfile: vi.fn(async () => ({})),
}));
vi.mock("../../src/services/supportedLanguagesService", () => ({
  getLanguages: vi.fn(async () => []),
  getWritingSystems: vi.fn(async () => []),
}));
vi.mock("../../src/services/categoriesService", () => ({
  getCategories: vi.fn(async () => []),
}));
vi.mock("../../src/services/translationService", () => ({
  getTranslations: vi.fn(async () => ({})),
  clearTranslationsCache: vi.fn(),
  fillMissingTranslations: vi.fn(async () => 0),
}));
vi.mock("../../src/services/promptService", () => ({
  getPrompt: vi.fn(async (id) => ({ id, template: "Read aloud in {{language}}.", model: "" })),
  renderTemplate: (template) => template,
}));

let ctx;
const Probe = ({ useAppContext }) => {
  const value = useAppContext();
  const { pathname } = useLocation();
  useEffect(() => {
    ctx = value;
  });
  return <p>at:{pathname}|user:{value.user?.uid ?? "none"}</p>;
};

const boot = async () => {
  const { AppProvider, useAppContext } = await import("../../src/contexts/AppContext");
  render(
    <MemoryRouter>
      <AppProvider>
        <Routes>
          <Route path="*" element={<Probe useAppContext={useAppContext} />} />
        </Routes>
      </AppProvider>
    </MemoryRouter>,
  );
  await screen.findByText(/at:/, {}, { timeout: 8000 });
};

/** An Explorer (five calls a day) who has used `used` of them today. */
const signInHavingUsed = async (used) => {
  const { todayUTC } = await import("../../src/utils/aiUsage");
  profile.current = { aiCallsToday: used, aiCallsDate: todayUTC() };
  const user = {
    uid: "u1",
    email: "ana@example.com",
    emailVerified: true,
    isAnonymous: false,
    getIdToken: vi.fn(async () => "tok"),
    getIdTokenResult: vi.fn(async () => ({
      token: "tok",
      expirationTime: new Date(Date.now() + 60 * 60 * 1000).toUTCString(),
    })),
  };
  fakeAuth.currentUser = user;
  await act(async () => {
    for (const cb of listeners.auth) await cb(user);
    for (const cb of listeners.token) await cb(user);
  });
  await screen.findByText(/user:u1/, {}, { timeout: 8000 });
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  listeners.auth.length = 0;
  listeners.token.length = 0;
  fakeAuth.currentUser = null;
  ctx = undefined;
  globalThis.fetch = vi.fn(async () => {
    throw new Error("nothing should be sent");
  });
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("out of AI calls", () => {
  it("fails a call as the limit without sending it, and never opens the warning", async () => {
    await boot();
    await signInHavingUsed(5);
    const { askAI, isDailyLimit } = await import("../../src/services/aiService");

    const err = await askAI("tok", "a prompt", {}).catch((e) => e);

    expect(isDailyLimit(err)).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(ctx.aiConfirm).toBeNull();
  });

  it("gives the limit alert an Upgrade button that leads to the plans", async () => {
    await boot();
    await signInHavingUsed(5);
    const { default: i18n } = await import("../../src/i18n");

    act(() => ctx.showDailyLimitAlert());
    expect(ctx.alert).toMatchObject({ show: true, type: "warning", message: i18n.t("ai_usage.limit_reached") });
    expect(ctx.alert.action.label).toBe(i18n.t("pricing.upgrade"));

    act(() => ctx.alert.action.onClick());
    expect(screen.getByText(/at:\/pricing/)).toBeInTheDocument();
  });

  it("keeps the button when a screen says what the limit cost it", async () => {
    await boot();
    await signInHavingUsed(5);

    act(() => ctx.showDailyLimitAlert("Two exercises were left out."));
    expect(ctx.alert.message).toBe("Two exercises were left out.");
    expect(ctx.alert.action).toBeTruthy();
  });

  it("explains a read-aloud clip the allowance refused", async () => {
    await boot();
    await signInHavingUsed(5);
    const { default: i18n } = await import("../../src/i18n");
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ success: false, code: "DAILY_LIMIT", error: "Daily AI limit reached." }),
    }));
    const { speak } = await import("../../src/services/getTtsService");

    // No browser-voice fallback here: jsdom has no SpeechSynthesisUtterance.
    // The notice comes before the fallback either way.
    await act(async () => {
      await speak("Olá", "pt-PT", { token: "tok", preferFallback: false });
    });

    expect(ctx.alert).toMatchObject({ show: true, message: i18n.t("ai_usage.limit_reached") });
    expect(ctx.alert.action).toBeTruthy();
  });
});

describe("the warning with calls left", () => {
  it("offers the plans: declines this call and goes there", async () => {
    await boot();
    await signInHavingUsed(4);
    const { askAI, isAiDeclined } = await import("../../src/services/aiService");

    let outcome;
    await act(async () => {
      outcome = askAI("tok", "a prompt", {}).catch((e) => e);
      await Promise.resolve();
    });
    expect(ctx.aiConfirm).toMatchObject({ open: true, remaining: 1 });

    act(() => ctx.resolveAiConfirm(false, { toPlans: true }));

    expect(isAiDeclined(await outcome)).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByText(/at:\/pricing/)).toBeInTheDocument();
  });
});
