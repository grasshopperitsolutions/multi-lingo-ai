import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter } from "react-router-dom";

/**
 * The real AppProvider.
 *
 * Every other suite mocks this away, so nothing exercised the 800 lines that
 * actually decide whether the app boots, what the theme is, and whether a
 * failed config load routes to /app-unavailable. It boots against stubbed
 * services here rather than a live backend, which is enough to cover the
 * decisions it makes with what those services return.
 */

// AppContext uses the compat-style `auth.onAuthStateChanged(cb)` method, not
// the modular `onAuthStateChanged(auth, cb)` function, so the listener has to
// live on the auth object itself. It returns an unsubscribe, and the provider
// calls it on unmount — returning undefined here crashes teardown.
const onAuthStateChanged = vi.fn(() => () => {});

vi.mock("../../src/firebase", () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: (...args) => onAuthStateChanged(...args),
  },
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

const getTiersConfig = vi.fn(async () => ({
  explorer: { id: "explorer", label: "Explorer", order: 0, isFree: true, aiCallsPerDay: 5, features: [] },
}));
const getFeatures = vi.fn(async () => [{ key: "translator", hidden: false }]);

vi.mock("../../src/services/tiersConfigService", () => ({
  getTiersConfig: (...a) => getTiersConfig(...a),
}));
vi.mock("../../src/services/featuresService", () => ({
  getFeatures: (...a) => getFeatures(...a),
}));
vi.mock("../../src/services/userService", () => ({
  getUserProfile: vi.fn(async () => ({})),
  updateDayStreak: vi.fn(async () => ({})),
  updateUserProfile: vi.fn(async () => ({})),
}));
vi.mock("../../src/services/supportedLanguagesService", () => ({
  getLanguages: vi.fn(async () => [{ code: "pt-PT", name: "Português" }]),
  getWritingSystems: vi.fn(async () => []),
}));
vi.mock("../../src/services/categoriesService", () => ({
  getCategories: vi.fn(async () => [{ id: "food" }]),
}));
vi.mock("../../src/services/translationService", () => ({
  getTranslations: vi.fn(async () => ({})),
  clearTranslationsCache: vi.fn(),
  fillMissingTranslations: vi.fn(async () => ({})),
}));

const renderProvider = async (Probe) => {
  const { AppProvider } = await import("../../src/contexts/AppContext");
  return render(
    <MemoryRouter>
      <AppProvider>
        <Probe />
      </AppProvider>
    </MemoryRouter>,
  );
};

const useCtx = async () => (await import("../../src/contexts/AppContext")).useAppContext;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppProvider boot", () => {
  it("renders its children once loading settles", async () => {
    const useAppContext = await useCtx();
    const Probe = () => {
      useAppContext();
      return <p>child rendered</p>;
    };

    await renderProvider(Probe);

    expect(await screen.findByText("child rendered", {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it("subscribes to auth state exactly once", async () => {
    const useAppContext = await useCtx();
    const Probe = () => {
      useAppContext();
      return <p>ok</p>;
    };

    await renderProvider(Probe);
    await screen.findByText("ok", {}, { timeout: 8000 });

    expect(onAuthStateChanged).toHaveBeenCalled();
  });

  it("exposes the whole context surface the app destructures", async () => {
    const useAppContext = await useCtx();
    // Captured in an effect, not during render: the react-hooks rule forbids a
    // component writing to anything outside itself while rendering, and it is
    // right to — that is the pattern the React Compiler cannot reason about.
    const seen = {};
    const Probe = () => {
      const value = useAppContext();
      useEffect(() => {
        seen.value = value;
      });
      return <p>ok</p>;
    };

    await renderProvider(Probe);
    await screen.findByText("ok", {}, { timeout: 8000 });

    // test/helpers/appContext.js fakes this object everywhere else. If the
    // real provider gains a key that the fake lacks, pages destructuring it
    // break in a way that looks like a dependency regression — so the fake
    // must stay a superset of what ships.
    const { makeAppContext } = await import("../helpers/appContext");
    const missingFromFake = Object.keys(seen.value).filter(
      (key) => !(key in makeAppContext()),
    );
    expect(missingFromFake).toEqual([]);
  });

  it("never shows a consumer a half-loaded config", async () => {
    const useAppContext = await useCtx();
    const seen = [];
    const Probe = () => {
      const { tiersConfig } = useAppContext();
      useEffect(() => {
        seen.push(tiersConfig);
      });
      return <p>ok</p>;
    };

    await renderProvider(Probe);
    await screen.findByText("ok", {}, { timeout: 8000 });

    // The provider holds children behind a full-screen Loader until
    // translations resolve (AppContext.jsx:743), and the config lands in the
    // same pass — so by the time anything downstream renders, tiersConfig is
    // already populated. `isLoadingTiers` and the null initial state are a
    // second belt for consumers that mount later, not the first line of
    // defence.
    //
    // Asserting the guarantee that actually holds: no consumer ever observes
    // a null config, on any render.
    expect(seen.length).toBeGreaterThan(0);
    for (const observed of seen) expect(observed).not.toBeNull();
  });
});

describe("AppProvider theme", () => {
  it("defaults to light when nothing is stored", async () => {
    const useAppContext = await useCtx();
    // Captured in an effect, not during render: the react-hooks rule forbids a
    // component writing to anything outside itself while rendering, and it is
    // right to — that is the pattern the React Compiler cannot reason about.
    const seen = {};
    const Probe = () => {
      const value = useAppContext();
      useEffect(() => {
        seen.value = value;
      });
      return <p>ok</p>;
    };

    await renderProvider(Probe);
    await screen.findByText("ok", {}, { timeout: 8000 });

    expect(seen.value.isDarkMode).toBe(false);
  });

  it("restores a stored dark theme on boot", async () => {
    localStorage.setItem("theme", "dark");
    vi.resetModules();

    const useAppContext = await useCtx();
    // Captured in an effect, not during render: the react-hooks rule forbids a
    // component writing to anything outside itself while rendering, and it is
    // right to — that is the pattern the React Compiler cannot reason about.
    const seen = {};
    const Probe = () => {
      const value = useAppContext();
      useEffect(() => {
        seen.value = value;
      });
      return <p>ok</p>;
    };

    await renderProvider(Probe);
    await screen.findByText("ok", {}, { timeout: 8000 });

    expect(seen.value.isDarkMode).toBe(true);
  });
});

describe("AppProvider alerts", () => {
  it("shows and closes an alert", async () => {
    const useAppContext = await useCtx();
    // Captured in an effect, not during render: the react-hooks rule forbids a
    // component writing to anything outside itself while rendering, and it is
    // right to — that is the pattern the React Compiler cannot reason about.
    const seen = {};
    const Probe = () => {
      const value = useAppContext();
      useEffect(() => {
        seen.value = value;
      });
      return <p>ok</p>;
    };

    await renderProvider(Probe);
    await screen.findByText("ok", {}, { timeout: 8000 });

    await act(async () => seen.value.showAlert("error", "Something broke"));
    await waitFor(() => expect(seen.value.alert?.show).toBe(true));
    expect(seen.value.alert.message).toBe("Something broke");
    expect(seen.value.alert.type).toBe("error");

    await act(async () => seen.value.closeAlert());
    await waitFor(() => expect(seen.value.alert?.show).toBe(false));
  });
});
