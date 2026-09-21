import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

/**
 * FeatureHeader's subtitle and instruction lines.
 *
 * Both are resolved **from the route**, the same way the heart finds its
 * feature — so a page gets them without declaring anything, and the subtitle
 * is the same string its dashboard tile already shows rather than a second
 * copy free to drift.
 *
 * The instruction line is deliberately rare. It exists only where a one-line
 * description cannot carry the rules, which today is three games; a feature
 * that explains itself gets nothing, and that absence is the design rather
 * than an omission.
 */

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({ isDarkMode: false, user: null, supportedLanguages: [] }),
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/hooks/useFeatureFavourites", () => ({
  useFeatureFavourites: () => ({ isFavourite: () => false, toggle: () => {} }),
}));

const mount = async (route, props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: FeatureHeader } = await import("../../src/components/ui/FeatureHeader");

  return render(
    <MemoryRouter initialEntries={[route]}>
      <I18nextProvider i18n={i18n}>
        <FeatureHeader title="Title" isDarkMode={false} accentColor="violet" {...props} />
      </I18nextProvider>
    </MemoryRouter>
  );
};

describe("the subtitle", () => {
  it("comes from the route, with no prop passed", async () => {
    const { container } = await mount("/dashboard/challenges/word-search");

    expect(container.textContent).toContain("Encontra as palavras escondidas na grelha.");
  });

  it("works for a grammar section too, not just games", async () => {
    const { container } = await mount("/dashboard/grammar/text");

    expect(container.textContent).toContain("Um texto curto escrito à volta");
  });

  it("says nothing on a route the registry does not know", async () => {
    const { container } = await mount("/dashboard/professional-tools/cv");

    // A hub or a sub-tool has no registry entry. Rendering an empty line, or
    // falling back to the title, would be worse than saying nothing.
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("can be overridden, and suppressed with an empty string", async () => {
    const overridden = await mount("/dashboard/challenges/word-search", {
      description: "Something else entirely",
    });
    expect(overridden.container.textContent).toContain("Something else entirely");
    expect(overridden.container.textContent).not.toContain("Encontra as palavras");

    const suppressed = await mount("/dashboard/challenges/word-search", { description: "" });
    expect(suppressed.container.textContent).not.toContain("Encontra as palavras");
  });
});

describe("the instruction line", () => {
  it("appears for a game whose rules the description cannot carry", async () => {
    const { container } = await mount("/dashboard/challenges/word-search");

    // Verified against handleCellTap: taps, not drags, and the run must stay
    // in one straight line.
    expect(container.textContent).toContain("sempre em linha reta");
  });

  it("is italic and ruled in the page's accent", async () => {
    const { container } = await mount("/dashboard/challenges/word-search", {
      accentColor: "violet",
    });

    const line = [...container.querySelectorAll("p")].find((p) => /linha reta/.test(p.textContent));
    expect(line.className).toContain("italic");
    // Tailwind cannot see a class name built by concatenation, which is why
    // FeatureHeader spells out a border map beside the bar map.
    expect(line.className).toContain("border-violet-400");
  });

  it("stays away from a feature that explains itself", async () => {
    const hangman = await mount("/dashboard/challenges/hangman");
    expect(hangman.container.textContent).toContain("Adivinha o calão");
    expect(hangman.container.querySelectorAll("p.italic")).toHaveLength(0);

    // Word Ladder's rule *is* its description ("change one letter at a time"),
    // so a second line would only repeat it.
    const ladder = await mount("/dashboard/challenges/word-ladder");
    expect(ladder.container.querySelectorAll("p.italic")).toHaveLength(0);
  });

  it("every instructionsKey in the registry resolves in the base locale", async () => {
    const { allFavouritableIds, favouritableById } = await import(
      "../../src/config/favouritableFeatures"
    );
    const pt = (await import("../../src/locales/pt/translation.json")).default;
    const resolve = (key) => key.split(".").reduce((node, part) => node?.[part], pt);

    // Resolved from a variable, so the i18n canary cannot see these. A missing
    // one renders the raw key as an instruction, which is worse than none.
    const withInstructions = allFavouritableIds()
      .map(favouritableById)
      .filter((entry) => entry?.instructionsKey);

    expect(withInstructions.length).toBeGreaterThan(0);
    for (const entry of withInstructions) {
      expect(typeof resolve(entry.instructionsKey), `${entry.id} instructionsKey`).toBe("string");
    }
  });
});
