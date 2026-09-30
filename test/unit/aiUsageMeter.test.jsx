import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";
import { todayUTC } from "../../src/utils/aiUsage";

/**
 * The daily AI allowance in the dashboard header. Out of calls, the count
 * itself leads to the plans; with calls left it stays plain text.
 */

const ctx = { current: makeAppContext() };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/services/pulseReportService", () => ({
  reportFeatureOpen: vi.fn(),
}));

const tiersConfig = {
  explorer: { id: "explorer", label: "Explorer", order: 1, isFree: true, aiCallsPerDay: 3, features: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function mountHeader(aiCallsToday) {
  ctx.current = makeAppContext({
    user: {
      uid: "u1",
      token: "tok",
      displayName: "Ana",
      subscriptionTier: "explorer",
      aiCallsToday,
      aiCallsDate: todayUTC(),
    },
    tiersConfig,
    features: [],
  });
  const { default: i18n } = await import("../../src/i18n");
  const { default: DashboardLayout } = await import("../../src/pages/dashboard/DashboardLayout");
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    </I18nextProvider>,
  );
  return i18n;
}

describe("the dashboard header's AI allowance", () => {
  it("links to the plans once the day's calls are used up", async () => {
    const i18n = await mountHeader(3);
    const link = screen.getByRole("link", { name: i18n.t("ai_usage.depleted") });
    expect(link.getAttribute("href")).toBe("/pricing");
    // The tooltip says why the link is there.
    expect(link.getAttribute("title")).toBe(i18n.t("ai_usage.limit_reached"));
  });

  it("stays plain text while calls are left", async () => {
    const i18n = await mountHeader(1);
    const remaining = screen.getByText(i18n.t("ai_usage.remaining", { count: 2, total: 3 }));
    expect(remaining.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: i18n.t("ai_usage.depleted") })).toBeNull();
  });
});
