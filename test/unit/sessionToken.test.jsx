import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";

/**
 * The sign-in token stays current, and a session that ends says so calmly.
 *
 * `user.token` is what every service sends. It used to be read at sign-in and
 * never again, so an hour later every request was refused with 401 "Invalid
 * or expired token" and shown as a red error. These drive the real
 * AppProvider against a fake Firebase auth whose tokens and listeners the
 * test controls.
 */

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

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

const logout = vi.fn(async () => {
  fakeAuth.currentUser = null;
});
vi.mock("../../src/services/authService", () => ({
  loginWithGoogle: vi.fn(async () => ({})),
  loginWithApple: vi.fn(async () => ({})),
  loginWithFacebook: vi.fn(async () => ({})),
  loginWithTwitter: vi.fn(async () => ({})),
  logout: (...a) => logout(...a),
}));
vi.mock("../../src/services/tiersConfigService", () => ({
  getTiersConfig: vi.fn(async () => ({
    explorer: { id: "explorer", label: "Explorer", order: 0, isFree: true, aiCallsPerDay: 5, features: [] },
  })),
}));
vi.mock("../../src/services/featuresService", () => ({
  getFeatures: vi.fn(async () => []),
}));
vi.mock("../../src/services/userService", () => ({
  getUserProfile: vi.fn(async () => ({ timezone: "Europe/Lisbon" })),
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

/**
 * A signed-in Firebase user whose token is `tok-N`, where N goes up by one
 * on every forced renewal, and whose expiry is an hour after it was issued.
 */
function makeUser({ refreshError } = {}) {
  let n = 1;
  let issuedAt = Date.now();
  const user = {
    uid: "u1",
    email: "ana@example.com",
    emailVerified: true,
    isAnonymous: false,
    getIdToken: vi.fn(async () => `tok-${n}`),
    getIdTokenResult: vi.fn(async (force) => {
      if (force) {
        if (refreshError) throw refreshError;
        n += 1;
        issuedAt = Date.now();
      }
      return { token: `tok-${n}`, expirationTime: new Date(issuedAt + HOUR).toUTCString() };
    }),
  };
  return user;
}

let ctx;
const Probe = ({ useAppContext }) => {
  const value = useAppContext();
  useEffect(() => {
    ctx = value;
  });
  return <p>token:{value.user?.token ?? "none"}</p>;
};

const boot = async () => {
  const { AppProvider, useAppContext } = await import("../../src/contexts/AppContext");
  render(
    <MemoryRouter>
      <AppProvider>
        <Probe useAppContext={useAppContext} />
      </AppProvider>
    </MemoryRouter>,
  );
  await screen.findByText(/token:/, {}, { timeout: 8000 });
};

/** Firebase signing a user in: both listeners fire. */
const signIn = async (user) => {
  fakeAuth.currentUser = user;
  await act(async () => {
    for (const cb of listeners.auth) await cb(user);
    for (const cb of listeners.token) await cb(user);
  });
};

/** Firebase reporting that nobody is signed in any more. */
const signedOut = async () => {
  await act(async () => {
    for (const cb of listeners.auth) await cb(null);
    for (const cb of listeners.token) await cb(null);
  });
};

/** Let pending promises settle, including ones a timer just started. */
const flush = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
});

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  listeners.auth.length = 0;
  listeners.token.length = 0;
  fakeAuth.currentUser = null;
  fakeAuth.signOut.mockClear();
  logout.mockClear();
  ctx = undefined;
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("keeping the sign-in token current", () => {
  it("renews five minutes before expiry and puts the new token on the user", async () => {
    await boot();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const user = makeUser();
    await signIn(user);
    expect(screen.getByText("token:tok-1")).toBeInTheDocument();

    // 54 minutes in: nothing yet.
    await act(async () => vi.advanceTimersByTime(54 * MINUTE));
    await flush();
    expect(user.getIdTokenResult).not.toHaveBeenCalledWith(true);

    // 55 minutes: renewed, and what the app sends is the new token.
    await act(async () => vi.advanceTimersByTime(1 * MINUTE));
    await flush();
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(screen.getByText("token:tok-2")).toBeInTheDocument();
  });

  it("checks the token as soon as the tab is visible again", async () => {
    // A closed laptop runs no timers; waking it must not leave a stale token.
    await boot();
    const user = makeUser();
    await signIn(user);
    user.getIdTokenResult.mockClear();

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    expect(user.getIdTokenResult).toHaveBeenCalledWith(false);
  });

  it("keeps the session and tries again when renewal fails for a passing reason", async () => {
    await boot();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const offline = Object.assign(new Error("offline"), { code: "auth/network-request-failed" });
    const user = makeUser({ refreshError: offline });
    await signIn(user);

    await act(async () => vi.advanceTimersByTime(55 * MINUTE));
    await flush();
    expect(fakeAuth.signOut).not.toHaveBeenCalled();
    expect(ctx.alert.show).toBe(false);

    // And it does try again.
    user.getIdTokenResult.mockClear();
    await act(async () => vi.advanceTimersByTime(MINUTE));
    await flush();
    expect(user.getIdTokenResult).toHaveBeenCalledWith(true);
  });

  it("signs out when the session cannot be renewed", async () => {
    // A revoked refresh token is the one case Firebase leaves to the app.
    await boot();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const revoked = Object.assign(new Error("revoked"), { code: "auth/invalid-refresh-token" });
    await signIn(makeUser({ refreshError: revoked }));

    await act(async () => vi.advanceTimersByTime(55 * MINUTE));
    await flush();
    expect(fakeAuth.signOut).toHaveBeenCalled();
  });
});

describe("telling the user a session ended", () => {
  it("says so, as information rather than an error, when nobody asked to leave", async () => {
    await boot();
    await signIn(makeUser());
    await signedOut();

    expect(ctx.alert.show).toBe(true);
    expect(ctx.alert.type).toBe("info");
    const i18n = (await import("../../src/i18n")).default;
    expect(ctx.alert.message).toBe(i18n.t("session.expired_message"));
    expect(screen.getByText("token:none")).toBeInTheDocument();
  });

  it("says nothing when the user signed out themselves", async () => {
    await boot();
    await signIn(makeUser());

    await act(async () => {
      await ctx.logoutUser();
    });
    await signedOut();

    expect(logout).toHaveBeenCalled();
    expect(ctx.alert.show).toBe(false);
  });

  it("says nothing to a guest who was never signed in", async () => {
    await boot();
    await signedOut();
    expect(ctx.alert.show).toBe(false);
  });
});
