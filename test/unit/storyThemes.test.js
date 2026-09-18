import { describe, it, expect } from "vitest";
import {
  STORY_THEMES,
  STORY_THEME_IDS,
  DEFAULT_STORY_THEME,
  CUSTOM_STORY_THEME,
  describeStoryTheme,
} from "../../src/config/storyThemes";

/**
 * The tale themes.
 *
 * Two of these assertions guard against a silent failure rather than a crash:
 * a theme whose label is missing from the base locale renders as a raw key in
 * the picker, and a theme with no instruction falls back to "(any)" — the
 * reader picks Underwater and gets whatever the model felt like. Neither shows
 * up as an error anywhere.
 */

describe("the list itself", () => {
  it("has no duplicate ids", () => {
    // Ids are written onto every story document and used as a Firestore
    // equality filter; two entries sharing one would merge two pools.
    expect(new Set(STORY_THEME_IDS).size).toBe(STORY_THEME_IDS.length);
  });

  it("includes the two ids the code refers to by name", () => {
    expect(STORY_THEME_IDS).toContain(DEFAULT_STORY_THEME);
    expect(STORY_THEME_IDS).toContain(CUSTOM_STORY_THEME);
  });

  it("every label resolves in the base locale", async () => {
    // t(theme.labelKey) is resolved from a variable, so the i18n canary — which
    // scans for literal t("...") calls — cannot see any of these.
    const pt = (await import("../../src/locales/pt/translation.json")).default;
    const resolve = (key) => key.split(".").reduce((node, part) => node?.[part], pt);

    for (const theme of STORY_THEMES) {
      expect(typeof resolve(theme.labelKey), `${theme.id} labelKey`).toBe("string");
    }
  });

  it("offers no theme that puts history back in the tale creator", () => {
    // Both features were renamed because readers could not tell them apart —
    // in Portuguese they literally shared the word "história". A "historical"
    // theme here would walk that straight back.
    for (const id of STORY_THEME_IDS) {
      expect(id).not.toMatch(/hist/i);
    }
  });
});

describe("what the model is told", () => {
  it("gives every preset a real instruction, not just its id back", () => {
    for (const { id } of STORY_THEMES) {
      if (id === DEFAULT_STORY_THEME || id === CUSTOM_STORY_THEME) continue;

      const instruction = describeStoryTheme(id);
      expect(instruction, `${id} instruction`).not.toBe("(any)");
      // Long enough to be a sentence rather than the id echoed back — the
      // failure mode is a theme added to the list and forgotten in the map.
      expect(instruction.length, `${id} instruction`).toBeGreaterThan(id.length + 8);
    }
  });

  it("passes the reader's own words through for the custom theme", () => {
    expect(describeStoryTheme(CUSTOM_STORY_THEME, "  piratas  ")).toBe("piratas");
  });

  it("falls back to (any) rather than sending an empty instruction", () => {
    // Three ways to end up with nothing: the default, a blank custom box, and
    // an id from a browser tab open since before the list changed. The template
    // reads this line unconditionally, so it can never be empty.
    expect(describeStoryTheme(DEFAULT_STORY_THEME)).toBe("(any)");
    expect(describeStoryTheme(CUSTOM_STORY_THEME, "   ")).toBe("(any)");
    expect(describeStoryTheme("retired-theme-id")).toBe("(any)");
  });
});
