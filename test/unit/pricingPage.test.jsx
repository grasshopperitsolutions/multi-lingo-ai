import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * PricingPage — who the plan cards think the viewer is.
 *
 * A signed-out visitor is the most common reader of this page (it is linked
 * from the landing page's CTAs), and treating them as an Explorer badged the
 * free tier "current plan" and disabled its button — the one control that
 * visitor is most likely to press.
 */

const ctx = { current: makeAppContext() };

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const navigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

const tier = (id, order, isFree) => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
  order,
  isFree,
  hidden: false,
  aiCallsPerDay: isFree ? 3 : Infinity,
  features: [],
});

const baseContext = (overrides = {}) =>
  makeAppContext({
    tiersConfig: {
      explorer: tier("explorer", 1, true),
      voyager: tier("voyager", 2, false),
    },
    features: [],
    ...overrides,
  });

beforeEach(() => {
  vi.clearAllMocks();
  ctx.current = baseContext();
  for (const level of ["error", "warn", "info", "log"]) {
    vi.spyOn(console, level).mockImplementation(() => {});
  }
});

const mount = async () => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: PricingPage } = await import("../../src/pages/PricingPage");

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe("a signed-out visitor", () => {
  it("is on no plan at all — nothing is badged as current", async () => {
    const { queryByText } = await mount();
    expect(queryByText("Plano Atual")).toBeNull();
  });

  it("can press the free plan's button, which is how they register", async () => {
    const { getAllByText } = await mount();

    const [button] = getAllByText("Começar").map((el) => el.closest("button"));
    expect(button).not.toBeNull();
    expect(button.disabled).toBe(false);
  });
});

describe("a signed-in Explorer", () => {
  beforeEach(() => {
    ctx.current = baseContext({ user: { uid: "u1", subscriptionTier: "explorer" } });
  });

  it("sees their own plan badged and its button spent", async () => {
    const { getAllByText } = await mount();

    expect(getAllByText("Plano Atual").length).toBeGreaterThan(0);
    // The badge and the button share the same string; the button is the one
    // that can be disabled.
    const disabled = getAllByText("Plano Atual")
      .map((el) => el.closest("button"))
      .filter(Boolean);
    expect(disabled.length).toBe(1);
    expect(disabled[0].disabled).toBe(true);
  });
});
