import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { makeAppContext } from "../helpers/appContext";

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
  it("takes you to Settings", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button"));

    // The note raises exactly one question — how do I change this — and this
    // is the answer being in reach rather than only informing.
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("does the same from the card variant", async () => {
    await mount({ variant: "card" });

    expect(screen.getByText("pt-PT")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    expect(navigate).toHaveBeenCalledWith("/settings");
  });
});
