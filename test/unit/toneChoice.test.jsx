import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { TONES, DEFAULT_TONE } from "../../src/config/professionalTools";
import ptBundle from "../../src/locales/pt/translation.json";

/**
 * The register picker on the professional tools.
 *
 * It was a two-way formal/informal pill, and "formal" was doing the work of
 * both: every prompt reads "in a {{tone}} register", so one setting had to
 * cover a cover letter to a hiring committee and a note to a colleague two
 * desks away, and it pitched everything at the first.
 *
 * The labels are resolved from a lookup keyed by tone rather than written as
 * literal `t("...")` calls, so the i18n canary cannot see them — the same
 * blind spot `instructionsKey` and the personal-widget registry have. That is
 * what the first test here is for.
 */

const mount = async (props = {}) => {
  const { default: i18n } = await import("../../src/i18n");
  const { default: ToneChoice } = await import("../../src/components/ui/ToneChoice");

  return render(
    <I18nextProvider i18n={i18n}>
      <ToneChoice
        value={DEFAULT_TONE}
        onChange={() => {}}
        isDarkMode={false}
        {...props}
      />
    </I18nextProvider>,
  );
};

describe("the three registers", () => {
  it("has a label and a hint for every one, in the base bundle", () => {
    for (const tone of Object.values(TONES)) {
      const slug = tone.replace(/\s+/g, "_");
      expect(ptBundle.professional[`tone_${slug}`], `tone_${slug}`).toBeTruthy();
      expect(ptBundle.professional[`tone_${slug}_hint`], `tone_${slug}_hint`).toBeTruthy();
    }
  });

  it("sends a phrase the prompt can use as written", () => {
    // Every template interpolates this into "in a {{tone}} register" and none
    // of them enumerate the values, so a register that describes itself needs
    // no prompt edit to be understood.
    for (const tone of Object.values(TONES)) {
      expect(tone).toMatch(/^[a-z ]+$/);
    }
  });

  it("defaults to the middle one", async () => {
    // Where most professional writing actually sits, and the setting somebody
    // carrying the old "formal" preference lands on.
    expect(DEFAULT_TONE).toBe(TONES.PROFESSIONAL);
    expect(Object.values(TONES)).not.toContain("formal");
  });
});

describe("ToneChoice", () => {
  it("offers three real radios in one group", async () => {
    const { container } = await mount();
    const radios = [...container.querySelectorAll('input[type="radio"]')];

    // Real radios rather than buttons with aria-checked: arrow keys, one tab
    // stop and "2 of 3" all come free from the browser.
    expect(radios).toHaveLength(3);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios.filter((r) => r.checked)).toHaveLength(1);
  });

  it("reports the register that was picked", async () => {
    const picked = [];
    const { container } = await mount({ onChange: (v) => picked.push(v) });

    const informal = [...container.querySelectorAll('input[type="radio"]')].find(
      (r) => r.value === TONES.INFORMAL,
    );
    fireEvent.click(informal);

    expect(picked).toEqual([TONES.INFORMAL]);
  });

  it("locks every option while a tool is working", async () => {
    const { container } = await mount({ disabled: true });

    // The fieldset carries it, so no option needs to know it is disabled.
    for (const radio of container.querySelectorAll('input[type="radio"]')) {
      expect(radio.disabled).toBe(true);
    }
  });
});

describe("the stored preference", () => {
  it("drops a value the app no longer recognises", async () => {
    // "formal" was the old default and is not one of the three. Rather than a
    // migration, useToneChoice simply keeps only what it recognises — and the
    // fallback is the register those users actually wanted.
    vi.resetModules();
    localStorage.setItem("mla.proTools.tone", "formal");

    const { renderHook } = await import("@testing-library/react");
    const { useToneChoice } = await import("../../src/hooks/useToneChoice");
    const { result } = renderHook(() => useToneChoice());

    expect(result.current.tone).toBe(TONES.PROFESSIONAL);
    localStorage.removeItem("mla.proTools.tone");
  });
});
