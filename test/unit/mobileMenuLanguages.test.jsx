import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

/**
 * The drawer's language grid — the only language picker on a phone.
 *
 * It used to render a flag and nothing else below 640px, which was fine while
 * every seeded language had its own flag and stopped being fine the moment two
 * did not: `ja-Hira` and `ja-Latn` both fly Japan's, so this was a picker that
 * could not tell you what you were picking.
 *
 * The header's picker is *not* the one to fix for this — it sits inside
 * `hidden md:flex`, so it never renders on a phone at all.
 */

const LANGUAGES = [
  { code: "pt-PT", label: "Português (Portugal)" },
  { code: "ja-Hira", label: "Japonês (Hiragana)" },
  { code: "ja-Latn", label: "Japonês (Romaji)" },
];

// Built from the shared helper rather than hand-rolled: appContext.test.jsx
// keeps that a superset of the real provider, so a component reading a key
// this file forgot fails there rather than mysteriously here.
const ctx = { current: null };
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ctx.current,
  AppProvider: ({ children }) => children,
}));

vi.mock("../../src/hooks/useTierAccess", () => ({
  useTierAccess: () => ({ isAdmin: false, isReady: true, canAccess: () => true }),
}));

const mount = async () => {
  const { makeAppContext } = await import("../helpers/appContext");
  ctx.current = makeAppContext({
    interfaceLang: "pt-PT",
    interfaceLanguageOptions: LANGUAGES,
    supportedLanguages: LANGUAGES,
    isLoadingLanguages: false,
  });
  const { default: i18n } = await import("../../src/i18n");
  const { default: MobileMenuDrawer } = await import(
    "../../src/components/MobileMenuDrawer"
  );

  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <MobileMenuDrawer onClose={() => {}} onThemeToggle={() => {}} />
      </I18nextProvider>
    </MemoryRouter>
  );
};

describe("telling two dialects apart on a phone", () => {
  it("renders the code beside the flag, not the flag alone", async () => {
    const { container } = await mount();

    // Both Japanese entries fly Japan's flag, so the code is the only thing
    // that distinguishes them at this width.
    expect(container.textContent).toContain("ja-Hira");
    expect(container.textContent).toContain("ja-Latn");
  });

  it("keeps BCP-47 casing against the button's own uppercase", async () => {
    const { container } = await mount();

    // The button carries `uppercase`, so the code needs `normal-case` to
    // survive it — JA-HIRA is not the code. Selected by the class rather than
    // by text: the flag renders no text of its own, so its wrapper reads as
    // the code too and would match first.
    const codes = [...container.querySelectorAll("span.normal-case")].map(
      (el) => el.textContent
    );
    expect(codes).toContain("ja-Hira");
    expect(codes).toContain("ja-Latn");
  });

  it("still shows the full label from sm upwards", async () => {
    const { container } = await mount();

    // The wide branch is unchanged: there the name fits and reads better.
    expect(container.textContent).toContain("Japonês (Hiragana)");
  });
});
