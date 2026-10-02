import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { makeAppContext } from "../helpers/appContext";

/**
 * The minimum age (Terms §1.1) is confirmed on onboarding's first screen,
 * which every new account passes through once. Nothing moves on until it is
 * ticked.
 */

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () =>
    makeAppContext({
      user: { uid: "new-uid", displayName: "New User", email: "new@example.com" },
    }),
}));

vi.mock("../../src/services/userService", () => ({
  updateUserProfile: vi.fn(async () => ({})),
}));

vi.mock("../../src/services/supportedLanguagesService", () => ({
  seedLanguage: vi.fn(async () => ({})),
}));

const renderOnboarding = async () => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: OnboardingPage } = await import("../../src/pages/OnboardingPage");
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

describe("onboarding age confirmation", () => {
  it("holds the first step until the minimum age is confirmed", async () => {
    await renderOnboarding();

    const next = screen.getByRole("button", { name: /Seguinte/i });
    const checkbox = screen.getByRole("checkbox", { name: /pelo menos 13 anos/i });
    expect(next).toBeDisabled();

    fireEvent.click(checkbox);
    expect(next).toBeEnabled();

    // Unticking takes it back: the confirmation is a choice, not a latch.
    fireEvent.click(checkbox);
    expect(next).toBeDisabled();

    fireEvent.click(checkbox);
    fireEvent.click(next);
    expect(screen.getByText("Qual é o idioma que preferes para a interface?")).toBeInTheDocument();
  });

  it("opens the Terms in a new tab, so the onboarding is not lost", async () => {
    await renderOnboarding();

    const link = screen.getByRole("link", { name: "Ler os Termos de Serviço" });
    expect(link).toHaveAttribute("href", "/terms");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
