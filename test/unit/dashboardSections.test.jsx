import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The dashboard's sections: which feature sits where, in what order, and
 * that every section says its name in pt-PT. The names are resolved from
 * keys held in config, which the i18n canary (literal t() calls only) cannot
 * see, so a missing one would print the raw key as a heading.
 */

const ctx = { current: makeAppContext() };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const SPLIT = {
  have_fun: ["challenges"],
  tune_your_ear: ["voice_practice", "ai_tutor"],
  grow_vocabulary: ["translator", "story_generator"],
  tough_practice: ["dictionary", "exam_training", "grammar"],
  need_help: ["personal_tools", "real_person_tutor", "professional_tools"],
  know_the_country: ["plan_trip", "food", "radio_tv", "history_culture"],
};

describe("the dashboard sections", () => {
  it("put every feature in its section, in order", async () => {
    const { DASHBOARD_GROUPS } = await import("../../src/config/dashboardGroups");
    const { featuresInGroup } = await import("../../src/config/dashboardFeatures");

    const sections = DASHBOARD_GROUPS.filter((group) => group.id !== "today");
    expect(sections.map((group) => group.id)).toEqual(Object.keys(SPLIT));
    for (const [id, features] of Object.entries(SPLIT)) {
      expect(featuresInGroup(id).map((tile) => tile.id)).toEqual(features);
    }
  });

  it("name and describe every section in the pt-PT bundle", async () => {
    const { default: i18n } = await import("../../src/i18n");
    const { DASHBOARD_GROUPS } = await import("../../src/config/dashboardGroups");

    for (const group of DASHBOARD_GROUPS) {
      for (const key of [group.labelKey, group.descriptionKey]) {
        expect(i18n.exists(key, { lng: "pt-PT" }), key).toBe(true);
      }
    }
  });

  it("render under the Today panel in that order", async () => {
    ctx.current = makeAppContext({
      user: { uid: "u1", token: "tok", subscriptionTier: "maestro", learningDialect: "pt-PT", favFeatureIds: [] },
      tiersConfig: {
        maestro: { id: "maestro", label: "Maestro", order: 3, isFree: false, aiCallsPerDay: Infinity, features: [] },
      },
      features: [],
      supportedLanguages: [{ code: "pt-PT", label: "Português (Portugal)", examSupported: true }],
    });
    const { default: i18n } = await import("../../src/i18n");
    const { default: DashboardHomePage } = await import("../../src/pages/dashboard/DashboardHomePage");
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <DashboardHomePage />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const headings = (await screen.findAllByRole("heading", { level: 2 })).map((h) => h.textContent);
    const expected = Object.keys(SPLIT).map((id) => i18n.t(`dashboard.groups.${id}`));
    expect(headings.filter((text) => expected.includes(text))).toEqual(expected);

    const knowTheCountry = screen.getByText(i18n.t("dashboard.groups.know_the_country")).closest("section");
    expect(within(knowTheCountry).getByText(i18n.t("dashboard.history_culture"))).toBeTruthy();
  });
});
