import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";

/**
 * TutorCard — the shapes this component renders (see its own header): a
 * real listing, the viewer's own listing, and the trailing generic
 * placeholder. The "become a tutor" / "apply" CTA used to be a third shape
 * here; it's now a small button on TutorsPage itself, covered by
 * tutorsPage.test.jsx instead.
 */

const mount = async (props) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: TutorCard } = await import("../../src/components/TutorCard");

  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <TutorCard isDarkMode={false} {...props} />
      </MemoryRouter>
    </I18nextProvider>,
  );
};

const tutor = {
  uid: "t1",
  displayName: "Ana",
  description: "Portuguese practice, conversational focus.",
  photoURL: null,
  email: "ana@example.com",
  phone: "+351912345678",
  whatsapp: true,
  languages: ["pt-PT"],
  links: [
    { url: "https://instagram.com/ana", label: "My Instagram", platform: "Instagram" },
    { url: "https://example-studio.com/ana", label: "My site", platform: null },
  ],
  published: true,
};

describe("comingSoon placeholder", () => {
  it("carries no per-language text — a single generic card", async () => {
    const { getByText } = await mount({ comingSoon: true });
    expect(getByText("Mais tutores a caminho")).toBeInTheDocument();
  });
});

describe("a real listing", () => {
  it("shows the WhatsApp icon before the phone number when whatsapp is set", async () => {
    const { container } = await mount({ tutor });

    const links = [...container.querySelectorAll("a")];
    const wa = links.find((a) => a.href.includes("wa.me"));
    const tel = links.find((a) => a.href.startsWith("tel:"));

    expect(wa).toBeDefined();
    expect(tel).toBeDefined();
    // "In front of the number": earlier in document order.
    expect(links.indexOf(wa)).toBeLessThan(links.indexOf(tel));
  });

  it("carries no separate WhatsApp text button", async () => {
    const { container } = await mount({ tutor });

    // Only the phone number and the platform link labels should read as
    // text on the contact row — no "Available on WhatsApp" sentence.
    expect(container.textContent).not.toMatch(/dispon[ií]vel no whatsapp/i);
  });

  it("omits the WhatsApp icon when the flag isn't set", async () => {
    const { container } = await mount({ tutor: { ...tutor, whatsapp: false } });
    expect(container.querySelector('a[href^="https://wa.me/"]')).toBeNull();
  });

  it("uses a brand icon for a recognised platform, dropping the text badge", async () => {
    const { container, queryByText } = await mount({ tutor });

    // Instagram has a hand-drawn icon (config/platformIconMap.js); the old
    // text pill next to it is redundant once the icon is there.
    expect(queryByText("Instagram")).toBeNull();
    const links = [...container.querySelectorAll("a")];
    const igLink = links.find((a) => a.href.includes("instagram.com"));
    expect(igLink.querySelector("svg")).not.toBeNull();
  });

  it("falls back to the generic icon and text badge for an unknown platform", async () => {
    const { getByText } = await mount({ tutor });
    // The second link has platform: null — nothing recognised it, so the
    // existing generic-link treatment still applies.
    expect(getByText("My site")).toBeInTheDocument();
  });

  it("shows the own-profile badge and update button only when isOwn", async () => {
    const withoutOwn = await mount({ tutor });
    expect(withoutOwn.queryByText("Atualizar o meu perfil")).toBeNull();

    const withOwn = await mount({ tutor: { ...tutor, published: false }, isOwn: true });
    expect(withOwn.getByText("Atualizar o meu perfil")).toBeInTheDocument();
    expect(withOwn.getByText("Oculto")).toBeInTheDocument();
  });

  it("does not show the hidden badge on the viewer's own published profile", async () => {
    const { queryByText } = await mount({ tutor, isOwn: true });
    expect(queryByText("Oculto")).toBeNull();
  });

  it("resolves a language code to its label via languageOptions", async () => {
    const { getByText, queryByText } = await mount({
      tutor,
      languageOptions: [{ code: "pt-PT", label: "Português" }],
    });
    expect(getByText("Português")).toBeInTheDocument();
    expect(queryByText("pt-PT")).toBeNull();
  });

  it("falls back to the raw code when the language isn't in languageOptions", async () => {
    const { getByText } = await mount({ tutor, languageOptions: [] });
    expect(getByText("pt-PT")).toBeInTheDocument();
  });
});
