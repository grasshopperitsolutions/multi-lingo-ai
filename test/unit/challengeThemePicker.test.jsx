import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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
  const SAVED = {
    hasInterests: true,
    interests: [
      { id: "food", label: "Comida" },
      { id: "travel", label: "Viagens" },
    ],
  };

  const openPicker = (container) => {
    const trigger = container.querySelector('button[aria-haspopup="listbox"]');
    expect(trigger).toBeTruthy();
    fireEvent.click(trigger);
    return trigger;
  };

  /** By role, because the selected label also appears on the closed trigger. */
  const option = (container, label) => {
    const found = [...container.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent.trim() === label,
    );
    expect(found).toBeTruthy();
    return found;
  };

  it("offers them instead of the Settings link", async () => {
    const { container } = await mount(SAVED);

    openPicker(container);

    expect(option(container, "Comida")).toBeTruthy();
    expect(option(container, "Viagens")).toBeTruthy();
    // Nothing to fix, so nothing to send them to Settings for.
    expect(container.querySelector('a[href*="/settings"]')).toBeNull();
  });

  it("collapses to one control however many interests there are", async () => {
    // The reason this is a dropdown: the chips it replaced wrapped onto a new
    // line every few interests, and this panel is a sidebar beside the board —
    // so its height was set by how many interests somebody had saved.
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, label: `Interesse ${i}` }));
    const { container } = await mount({ hasInterests: true, interests: many });

    expect(container.querySelectorAll('button[aria-haspopup="listbox"]')).toHaveLength(1);
    // Closed, so none of the twelve is taking up room.
    expect(container.textContent).not.toContain("Interesse 7");
  });

  it("lets a chosen interest be taken back off", async () => {
    // A chip row said "none" by having nothing pressed. A dropdown always reads
    // as something, so the way back out has to be an option you can pick.
    const picked = [];
    const { container } = await mount({
      ...SAVED,
      selectedInterestId: "food",
      onSelectInterest: (id) => picked.push(id),
    });

    openPicker(container);
    fireEvent.click(option(container, "Sem tema"));

    expect(picked).toEqual([null]);
  });

  it("treats re-picking the current interest as no change", async () => {
    // `selectInterest` in the hook is a toggle, written for chips, where
    // pressing the pressed one is how you clear it. Through a dropdown that
    // would silently clear the theme somebody just confirmed.
    const picked = [];
    const { container } = await mount({
      ...SAVED,
      selectedInterestId: "food",
      onSelectInterest: (id) => picked.push(id),
    });

    openPicker(container);
    fireEvent.click(option(container, "Comida"));

    expect(picked).toEqual([]);
  });

  it("locks the picker while a round is loading", async () => {
    const { container } = await mount({ ...SAVED, disabled: true });

    expect(container.querySelector('button[aria-haspopup="listbox"]').disabled).toBe(true);
  });
});
