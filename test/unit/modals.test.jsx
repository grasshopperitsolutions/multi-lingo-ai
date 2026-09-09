import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * Modals, the error boundary, and the remaining leaf components.
 *
 * Every one of these sat at 0% because nothing opens them: a modal only
 * renders once a section is interacted with, and the error boundary only
 * renders when something else has already failed. They are exactly the
 * components you least want to discover are broken.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/aiService", () => ({
  askAI: vi.fn(async () => ({ text: "" })),
  registerAiConfirmHandler: vi.fn(),
}));

// ErrorBoundary imports the re-exported `Sentry` namespace, not a helper —
// `import { Sentry } from "../sentry"` — so the mock has to provide that.
const captureException = vi.fn();
vi.mock("../../src/sentry", () => ({
  Sentry: { captureException: (...a) => captureException(...a), withScope: (fn) => fn({ setTag: vi.fn(), setContext: vi.fn(), setExtra: vi.fn() }) },
  initSentry: vi.fn(),
  setSentryUser: vi.fn(),
}));

const emptyEnvelope = () =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: { documents: [], hasMore: false } }),
  }));

beforeEach(() => {
  ctx.current = makeAppContext({
    user: { uid: "u1", token: "tok", displayName: "U", subscriptionTier: "maestro" },
    token: "tok",
  });
  globalThis.fetch = emptyEnvelope();
  vi.clearAllMocks();
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
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

/**
 * [name, loader, props when creating (null when the modal is edit-only), props when editing]
 *
 * Both states matter where they exist: "create" passes a null entity and
 * "edit" an existing one, and they take different branches for defaults and
 * titles. Three of these are edit-only — they read straight through the
 * entity and throw on null, which is correct because nothing ever opens them
 * without one.
 */
const MODALS = [
  [
    "FeatureEditModal",
    () => import("../../src/components/admin/FeatureEditModal"),
    { feature: null },
    { feature: { id: "f1", key: "translator", label: "Translator", hidden: false } },
  ],
  [
    "TierEditModal",
    () => import("../../src/components/admin/TierEditModal"),
    null,
    {
      tier: { id: "maestro", label: "Maestro", order: 3, aiCallsPerDay: 0, features: [] },
      allFeatures: [{ id: "f1", key: "translator", label: "Translator" }],
    },
  ],
  [
    "PromptEditModal",
    () => import("../../src/components/admin/PromptEditModal"),
    null,
    {
      prompt: { id: "p1", name: "Story", template: "Write {{x}}", version: 1, category: "story" },
      categoriesInUse: ["story"],
    },
  ],
  [
    "CategoryEditModal",
    () => import("../../src/components/admin/CategoryEditModal"),
    { category: null },
    { category: { id: "food", label: "Comida" } },
  ],
  [
    "GenericDocEditModal",
    () => import("../../src/components/admin/GenericDocEditModal"),
    null,
    { doc: { id: "d1", data: { a: 1 } } },
  ],
];

describe("admin modals", () => {
  it.each(MODALS.filter(([, , createProps]) => createProps))(
    "%s renders in create mode",
    async (_n, loader, createProps) => {
      const { container } = await mount(loader, {
        isSaving: false,
        onSave: vi.fn(),
        onClose: vi.fn(),
        ...createProps,
      });
      await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0));
    },
  );

  it.each(MODALS)("%s renders in edit mode", async (_n, loader, _c, editProps) => {
    const { container } = await mount(loader, {
      isSaving: false,
      onSave: vi.fn(),
      onClose: vi.fn(),
      ...editProps,
    });
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0));
  });

  it.each(MODALS)("%s renders while saving without crashing", async (_n, loader, _c, editProps) => {
    const { container } = await mount(loader, {
      isSaving: true,
      onSave: vi.fn(),
      onClose: vi.fn(),
      ...editProps,
    });
    await waitFor(() => expect(container).toBeTruthy());
  });
});

describe("ErrorBoundary", () => {
  const Boom = () => {
    throw new Error("component exploded");
  };

  const renderBoundary = async (props, children) => {
    const { default: ErrorBoundary } = await import("../../src/components/ErrorBoundary");
    return render(<ErrorBoundary {...props}>{children}</ErrorBoundary>);
  };

  it("renders its children when nothing throws", async () => {
    await renderBoundary({}, <p>all fine</p>);
    expect(screen.getByText("all fine")).toBeInTheDocument();
  });

  it("shows a fallback instead of a blank page when a child throws", async () => {
    const { container } = await renderBoundary({}, <Boom />);

    // The whole point: a render crash must not leave the user staring at
    // white. The boundary depends on no context, no router and no
    // useTranslation, because those are what may have broken.
    expect(container.textContent.trim().length).toBeGreaterThan(0);
    expect(screen.queryByText("all fine")).toBeNull();
  });

  it("reports the error to Sentry", async () => {
    await renderBoundary({}, <Boom />);

    // React swallows an error once a boundary handles it, so componentDidCatch
    // is the only place this can be reported from.
    await waitFor(() => expect(captureException).toHaveBeenCalled());
  });

  it("clears the error when resetKey changes", async () => {
    const { default: ErrorBoundary } = await import("../../src/components/ErrorBoundary");

    const { rerender } = render(
      <ErrorBoundary resetKey="/broken">
        <Boom />
      </ErrorBoundary>,
    );

    // Navigating away from a broken route must recover without a reload —
    // that is what the route-level boundary keys on.
    rerender(
      <ErrorBoundary resetKey="/healthy">
        <p>recovered</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("recovered")).toBeInTheDocument();
  });

  it("stays in the fallback while resetKey is unchanged", async () => {
    const { default: ErrorBoundary } = await import("../../src/components/ErrorBoundary");

    const { rerender } = render(
      <ErrorBoundary resetKey="/same">
        <Boom />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary resetKey="/same">
        <p>should not appear</p>
      </ErrorBoundary>,
    );

    expect(screen.queryByText("should not appear")).toBeNull();
  });
});

describe("remaining leaf components", () => {
  it("TutorApplicationForm renders its fields once opened", async () => {
    const { container } = await mount(
      () => import("../../src/components/TutorApplicationForm"),
      { defaultOpen: true },
    );

    await waitFor(() => expect(container.querySelectorAll("input, textarea").length).toBeGreaterThan(0));
  });

  it("TutorApplicationForm renders no inputs while collapsed", async () => {
    const { container } = await mount(
      () => import("../../src/components/TutorApplicationForm"),
      { defaultOpen: false },
    );

    // SettingsSection unmounts its body rather than hiding it, so a collapsed
    // card leaves no focusable fields stranded in the tab order.
    await waitFor(() => expect(container.textContent.trim().length).toBeGreaterThan(0));
    expect(container.querySelectorAll("input, textarea")).toHaveLength(0);
  });

  it("GlobalCompassCursor renders at a position", async () => {
    const { container } = await mount(
      () => import("../../src/components/GlobalCompassCursor"),
      { x: 10, y: 20 },
    );

    await waitFor(() => expect(container).toBeTruthy());
  });

  it("AiGenerationConfirm renders when a confirmation is pending", async () => {
    ctx.current = makeAppContext({
      user: { uid: "u1", token: "tok", subscriptionTier: "explorer", aiCallsToday: 4 },
      aiConfirm: { open: true },
    });

    const { container } = await mount(() => import("../../src/components/AiGenerationConfirm"));
    await waitFor(() => expect(container).toBeTruthy());
  });

  it("AiGenerationConfirm renders nothing when nothing is pending", async () => {
    ctx.current = makeAppContext({ aiConfirm: null });

    const { container } = await mount(() => import("../../src/components/AiGenerationConfirm"));
    expect(container.textContent.trim()).toBe("");
  });
});
