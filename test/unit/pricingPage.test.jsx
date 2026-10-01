import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, within } from "@testing-library/react";
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

describe("what each plan card lists", () => {
  // Explorer < Voyager < Maestro. Grants are each tier's `features` list.
  const plans = {
    explorer: { ...tier("explorer", 1, true), features: ["translator", "secret"] },
    voyager: { ...tier("voyager", 2, false), features: ["translator", "full_exam", "secret"] },
    maestro: {
      ...tier("maestro", 3, false),
      features: ["translator", "full_exam", "priority_support", "voice_practice", "secret"],
    },
  };
  const registry = [
    { id: "translator", label: "Translator", order: 1 },
    { id: "full_exam", label: "Full exam", order: 2 },
    { id: "priority_support", label: "Priority support", order: 3 },
    { id: "voice_practice", label: "Voice practice", order: 4, beta: true },
    // Granted to nobody: "coming soon".
    { id: "ai_tutor", label: "AI tutor", order: 5 },
    // Granted to everyone, but hidden in Admin.
    { id: "secret", label: "Secret feature", order: 6, hidden: true },
  ];

  const heading = (utils, name) => utils.getByRole("heading", { name });

  const cardOf = (utils, name) => {
    const heading = utils.getByRole("heading", { name });
    // The card body: its heading, price, button and rows.
    return within(heading.closest(".p-8"));
  };

  beforeEach(() => {
    ctx.current = baseContext({ tiersConfig: plans, features: registry });
  });

  it("shows the free plan's own features and nothing it lacks", async () => {
    const utils = await mount();
    const explorer = cardOf(utils, "Explorer");

    expect(explorer.getByText("Translator")).toBeTruthy();
    // Not listed struck through any more: the plan above shows it.
    expect(explorer.queryByText("Full exam")).toBeNull();
    expect(explorer.queryByText(/Tudo o que o/)).toBeNull();
  });

  it("shows each paid plan as the plan below it, plus what it adds", async () => {
    const utils = await mount();

    const voyager = cardOf(utils, "Voyager");
    expect(voyager.getByText("Tudo o que o Explorer inclui, e ainda:")).toBeTruthy();
    expect(voyager.getByText("Full exam")).toBeTruthy();
    expect(voyager.queryByText("Translator")).toBeNull();

    const maestro = cardOf(utils, "Maestro");
    expect(maestro.getByText("Tudo o que o Voyager inclui, e ainda:")).toBeTruthy();
    expect(maestro.getByText("Priority support")).toBeTruthy();
    expect(maestro.queryByText("Full exam")).toBeNull();
  });

  it("never lists a hidden or unreleased feature, even to a VIP", async () => {
    // A VIP sees hidden features everywhere else in the app. This is a sales
    // page, and early access is not on sale.
    ctx.current = baseContext({
      tiersConfig: plans,
      features: registry,
      user: { uid: "u1", subscriptionTier: "vip" },
    });
    const utils = await mount();

    expect(utils.queryByText("Secret feature")).toBeNull();
    expect(utils.queryByText("AI tutor")).toBeNull();
    expect(utils.queryByText("Brevemente")).toBeNull();
  });

  it("leaves off a feature unticked for the pricing page, though plans grant it", async () => {
    ctx.current = baseContext({
      tiersConfig: plans,
      features: registry.map((feature) =>
        feature.id === "priority_support" ? { ...feature, showInPricing: false } : feature,
      ),
    });
    const utils = await mount();
    const maestro = cardOf(utils, "Maestro");

    expect(maestro.queryByText("Priority support")).toBeNull();
    expect(maestro.getByText("Voice practice")).toBeTruthy();
  });

  it("labels a beta feature on its row", async () => {
    const utils = await mount();
    const maestro = cardOf(utils, "Maestro");

    const row = maestro.getByText("Voice practice").parentElement;
    expect(within(row).getByText("Beta")).toBeTruthy();
    expect(within(maestro.getByText("Priority support").parentElement).queryByText("Beta")).toBeNull();
  });

  it("shows five rows, and the rest behind \"show all\"", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ id: `f${i + 1}`, label: `Feature ${i + 1}`, order: i + 1 }));
    ctx.current = baseContext({
      tiersConfig: { explorer: { ...tier("explorer", 1, true), features: many.map((f) => f.id) } },
      features: many,
    });
    const { default: i18n } = await import("../../src/i18n");
    const { PLAN_PERKS } = await import("../../src/config/pricing");
    const utils = await mount();
    const explorer = cardOf(utils, "Explorer");

    // The free plan's perks lead and count toward the five.
    const perks = (PLAN_PERKS.explorer ?? []).length;
    const lastShown = 5 - perks;
    expect(explorer.getByText(`Feature ${lastShown}`)).toBeTruthy();
    expect(explorer.queryByText(`Feature ${lastShown + 1}`)).toBeNull();

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(explorer.getByText(i18n.t("pricing.show_all_features", { count: 7 + perks })));
    expect(explorer.getByText("Feature 7")).toBeTruthy();
  });

  it("leads Maestro's card with its perk, and lists it on no other plan", async () => {
    const { default: i18n } = await import("../../src/i18n");
    const utils = await mount();
    const support = i18n.t("pricing.features.priority_support");

    expect(cardOf(utils, "Maestro").getByText(support)).toBeTruthy();
    // Before the features: the perks are what tells the card apart.
    const text = heading(utils, "Maestro").closest(".p-8").textContent;
    expect(text.indexOf(support)).toBeLessThan(text.indexOf("Priority support"));

    for (const plan of ["Explorer", "Voyager"]) {
      expect(cardOf(utils, plan).queryByText(support)).toBeNull();
    }
  });

  it("leads Voyager with the more advanced models, which Maestro inherits", async () => {
    const { default: i18n } = await import("../../src/i18n");
    const utils = await mount();
    const models = i18n.t("pricing.features.advanced_models");

    expect(cardOf(utils, "Voyager").getByText(models)).toBeTruthy();
    // Not on the free plan, and not repeated on Maestro: its card says
    // "everything in Voyager, plus".
    expect(cardOf(utils, "Explorer").queryByText(models)).toBeNull();
    expect(cardOf(utils, "Maestro").queryByText(models)).toBeNull();
  });

  it("marks Maestro as the most popular plan", async () => {
    const utils = await mount();
    const badge = utils.getByText("Mais Popular");
    expect(within(badge.closest(".rounded-\\[2rem\\]")).getByRole("heading", { name: "Maestro" })).toBeTruthy();
  });
});
