import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

/**
 * ChallengeThemePicker's empty state.
 *
 * With no interests saved there is nothing to pick, so the card points at
 * Settings instead of rendering an empty row. That link used to go to bare
 * `/settings`, which dropped you at the top of a nine-card page to go hunting
 * for a control three cards down — the hash is what makes the sentence's
 * promise true.
 *
 * Interests are not a card of their own: they live inside the practice-language
 * section, which is why this points at `#practiceLanguage` rather than at some
 * `#interests` anchor that does not exist.
 */

const mount = async (props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: ChallengeThemePicker } = await import(
    "../../src/components/ChallengeThemePicker"
  );

  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <ChallengeThemePicker
          interests={[]}
          hasInterests={false}
          selectedInterestId={null}
          onSelectInterest={() => {}}
          freeText=""
          onFreeTextChange={() => {}}
          canUseFreeText={false}
          freeTextBlockedByInterest={false}
          onApply={() => {}}
          isDarkMode={false}
          {...props}
        />
      </I18nextProvider>
    </MemoryRouter>
  );
};

describe("with no interests saved", () => {
  it("sends you to the card that actually holds interests", async () => {
    const { container } = await mount();

    const link = container.querySelector("a[href]");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/settings#practiceLanguage");
  });

  it("keeps the link inside the sentence rather than standing alone", async () => {
    const { container } = await mount();

    // The three-key prefix/link/suffix shape is how this app puts a link in a
    // sentence; a bare link on its own line would read as a button.
    const text = container.textContent;
    expect(text.indexOf("definições")).toBeGreaterThan(0);
    expect(text.trim().startsWith("definições")).toBe(false);
  });
});

describe("with interests saved", () => {
  it("offers them instead of the Settings link", async () => {
    const { container, getByText } = await mount({
      hasInterests: true,
      interests: [
        { id: "food", label: "Comida" },
        { id: "travel", label: "Viagens" },
      ],
    });

    expect(getByText("Comida")).toBeTruthy();
    // Nothing to fix, so nothing to send them to Settings for.
    expect(container.querySelector('a[href*="/settings"]')).toBeNull();
  });
});
