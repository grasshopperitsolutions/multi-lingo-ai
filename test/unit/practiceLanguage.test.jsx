import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeAppContext } from "../helpers/appContext";
import { flagRegion } from "../../src/utils/flagRegion";

/**
 * PracticeLanguage — "you are practising pt-PT", wherever that choice changes
 * what the page produces.
 *
 * Three things here are decisions rather than details, and each would be
 * quietly "tidied" by someone who did not know: the visible value is the
 * **code** and not the label, the label lives in the tooltip, and the whole
 * thing disappears rather than rendering a dash when no language is set.
 */

const navigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

const ctx = { current: null };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

const LANGUAGES = [
  { code: "pt-PT", label: "Português (Portugal)" },
  { code: "pt-BR", label: "Português (Brasil)" },
];

async function mount(props = {}, overrides = {}) {
  ctx.current = makeAppContext({
    supportedLanguages: LANGUAGES,
    user: { uid: "u1", learningDialect: "pt-PT" },
    ...overrides,
  });
  const { default: PracticeLanguage } = await import(
    "../../src/components/ui/PracticeLanguage"
  );
  return render(
    <MemoryRouter>
      <PracticeLanguage isDarkMode={false} {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("what it shows", () => {
  it("shows the code, not the label", async () => {
    await mount();

    // pt-PT and pt-BR read almost identically as names; the code is the part
    // that actually distinguishes them at a glance. Asserted on the control
    // itself, because the label *is* in the DOM — in the tooltip, which is
    // hidden by opacity rather than removed.
    const control = screen.getByRole("button");
    expect(control.textContent).toContain("pt-PT");
    expect(control.textContent).not.toContain("Português (Portugal)");
  });

  it("puts the full label in the tooltip", async () => {
    await mount();

    // The long form is one hover away rather than crowding the badge.
    expect(screen.getByRole("tooltip").textContent).toContain("Português (Portugal)");
  });

  it("names the language in the accessible label, since a tooltip is hover-only", async () => {
    await mount();

    expect(screen.getByRole("button").getAttribute("aria-label")).toContain(
      "Português (Portugal)"
    );
  });

  it("falls back to the code when the language is not in the loaded list", async () => {
    await mount({}, { user: { uid: "u1", learningDialect: "xx-XX" } });

    // A dialect seeded after this browser loaded the list must still render,
    // not blank out. Twice over: the tooltip falls back to the code too, so
    // the hover says the same thing rather than nothing.
    expect(screen.getAllByText("xx-XX").length).toBeGreaterThan(0);
    expect(screen.getByRole("button").textContent).toContain("xx-XX");
  });
});

describe("when there is nothing to show", () => {
  it("renders nothing at all if no language is set", async () => {
    const { container } = await mount({}, { user: { uid: "u1" } });

    // A new account mid-onboarding has none. "You are practising —" is worse
    // than silence.
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing for a signed-out visitor", async () => {
    const { container } = await mount({}, { user: null });
    expect(container.innerHTML).toBe("");
  });
});

describe("what it does", () => {
  it("takes you to Settings, and opens the right card", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button"));

    // The note raises exactly one question — how do I change this — and this
    // is the answer being in reach rather than only informing. The hash is
    // half the answer: SettingsPage reads it to expand that one section, so
    // you land on the picker instead of on a page of closed cards.
    expect(navigate).toHaveBeenCalledWith("/settings#practiceLanguage");
  });

  it("does the same from the card variant", async () => {
    await mount({ variant: "card" });

    expect(screen.getByText("pt-PT")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith("/settings#practiceLanguage");
  });
});

describe("the card variant", () => {
  it("makes only the button actionable, not the whole card", async () => {
    const { container } = await mount({ variant: "card" });

    // The card used to be one big button, which made a 90px flag field a
    // click target for a navigation nobody asked for — and put a heading, a
    // code and a name inside a control, read as one run-on label.
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.querySelector("section")).toBeTruthy();
  });

  it("flies the region's flag, not the language's", async () => {
    const { container } = await mount(
      { variant: "card" },
      { user: { uid: "u1", learningDialect: "mwl-PT" } }
    );

    // Mirandese is mwl, spoken in PT. Keying the field on the language subtag
    // would ask flag-icons for a country called "mwl".
    expect(container.querySelector(".fi-pt")).toBeTruthy();
    expect(container.querySelector(".fi-mwl")).toBeNull();
  });

  it("falls back to a colour field when the code carries no region", async () => {
    const { container } = await mount(
      { variant: "card" },
      { user: { uid: "u1", learningDialect: "ia" } }
    );

    // Interlingua belongs to no country. A hole where the field should be
    // would read as a broken image.
    expect(container.querySelector('[class*="fi-"]')).toBeNull();
    expect(container.querySelector('[class*="gradient"]')).toBeTruthy();
  });

  it("shows the name under the code, but never the code twice", async () => {
    const withName = await mount({ variant: "card" });
    expect(withName.container.textContent).toContain("Português (Portugal)");
    withName.unmount();

    // A language seeded after this browser loaded the list has no label, so
    // useLanguageLabel hands the code back. Printing it twice reads as a fault.
    const withoutName = await mount(
      { variant: "card" },
      { user: { uid: "u1", learningDialect: "xx-XX" } }
    );
    expect(withoutName.container.textContent.match(/xx-XX/g)).toHaveLength(1);
  });

  it("still names the language for a screen reader", async () => {
    const { container } = await mount({ variant: "card" });

    // The card has no tooltip — it prints the name — but the region still
    // needs an accessible name, since its heading is not a landmark label.
    expect(container.querySelector("section").getAttribute("aria-label")).toContain(
      "Português (Portugal)"
    );
  });
});

describe("flagRegion", () => {
  it("takes the region, never the language", () => {
    expect(flagRegion("pt-PT")).toBe("pt");
    expect(flagRegion("pt-BR")).toBe("br");
    expect(flagRegion("en-GB")).toBe("gb");
    // The one that makes this worth a shared helper: the flag belongs to the
    // region subtag, so Mirandese flies Portugal's.
    expect(flagRegion("mwl-PT")).toBe("pt");
  });

  it("falls back to CLDR when a script subtag sits where a region would", () => {
    // ja-Hira and ja-Latn are Japanese written in hiragana and romaji. They
    // carry a *script*, so there is no region to read — but the language
    // plainly implies one, and Intl.Locale#maximize knows it.
    expect(flagRegion("ja-Hira")).toBe("jp");
    expect(flagRegion("ja-Latn")).toBe("jp");
    expect(flagRegion("sr-Cyrl")).toBe("rs");
  });

  it("never reads the language subtag as if it were a country", () => {
    // The tempting shortcut, and the reason it is not taken: each of these
    // language codes is also some *other* country's code. Catalan is not
    // Canadian, Nepali is not Nigerien, Swedish is not Salvadoran.
    expect(flagRegion("ca")).toBe("es");
    expect(flagRegion("ne")).toBe("np");
    expect(flagRegion("si")).toBe("lk");
    expect(flagRegion("sv")).toBe("se");
    expect(flagRegion("uk")).toBe("ua");
  });

  it("returns nothing when no single country applies", () => {
    // Interlingua maximizes to `001` — the World. There is no flag for that,
    // and inventing one would be worse than the globe.
    expect(flagRegion("ia")).toBeNull();
    expect(flagRegion("es-419")).toBeNull();
    expect(flagRegion(undefined)).toBeNull();
    expect(flagRegion("")).toBeNull();
    expect(flagRegion("   ")).toBeNull();
  });

  it("survives a tag that is not well formed at all", () => {
    // What a user-typed "Other" entry looks like before seedLanguage has
    // canonicalised it. Intl.Locale throws on these.
    expect(flagRegion("not a language")).toBeNull();
    expect(flagRegion("!!")).toBeNull();
  });
});
