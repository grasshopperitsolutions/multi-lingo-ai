import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { makeAppContext } from "../helpers/appContext";

/**
 * RequireAuth — the guard that replaced an infinite spinner.
 *
 * DashboardLayout used to render `if (!user) return <Loader fullScreen .../>`
 * with nothing to ever change that: a guest opening any /dashboard/* URL got
 * a spinner that never resolved. These tests exercise the guard directly
 * rather than through the full route tree, since it fixes a real bug and
 * deserves its own coverage instead of relying on the smoke suite noticing.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mount = async (initialPath = "/dashboard") => {
  const { default: RequireAuth } = await import("../../src/components/RequireAuth");

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<p>home page</p>} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <p>dashboard content</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
};

describe("RequireAuth", () => {
  it("renders its children for a signed-in user", async () => {
    ctx.current = makeAppContext({ user: { uid: "u1" }, isLoadingUser: false });

    const { findByText } = await mount();

    expect(await findByText("dashboard content")).toBeInTheDocument();
  });

  it("redirects a signed-out visitor to the homepage instead of hanging", async () => {
    ctx.current = makeAppContext({ user: null, isLoadingUser: false });

    const { findByText, queryByText } = await mount();

    // The bug this replaces: nothing here ever resolved on its own. This
    // must actually land on "/", not just stop showing a spinner.
    expect(await findByText("home page")).toBeInTheDocument();
    expect(queryByText("dashboard content")).toBeNull();
  });

  it("waits for isLoadingUser to settle before deciding", async () => {
    // A user who IS signed in but whose profile is still loading must not be
    // bounced — same shape as RequireOnboarding's own guard.
    ctx.current = makeAppContext({ user: null, isLoadingUser: true });

    const { container, queryByText } = await mount();

    expect(queryByText("home page")).toBeNull();
    expect(queryByText("dashboard content")).toBeNull();
    // Something (a loader) is showing, not a blank page and not a redirect.
    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });

  it("does not redirect a guest away from an unrelated route", async () => {
    ctx.current = makeAppContext({ user: null, isLoadingUser: false });

    const { findByText } = await mount("/");

    // Sanity check on the test harness itself: visiting "/" directly must
    // not trip the guard, which only wraps the /dashboard route.
    await waitFor(async () => expect(await findByText("home page")).toBeInTheDocument());
  });
});
