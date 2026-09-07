import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pt from "../../src/locales/pt/translation.json";

/**
 * Every literal t() key used in src/ must exist in the pt-PT bundle.
 *
 * pt-PT is the only locale that ships with the code and the source every other
 * locale is translated from, so a key missing here is missing everywhere: the
 * UI renders the key name itself, and `saveMissing` fires an AI translation
 * round-trip for a key that will never resolve.
 *
 * Only literal keys are checked. Keys built at runtime (`t(\`tiers.${id}\`)`)
 * cannot be resolved statically and are skipped rather than guessed at.
 *
 * A key may resolve to an array or an object, not just a string: HomePage
 * reads its FAQ and marquee lists with `{ returnObjects: true }`. What matters
 * is that the path exists, so anything defined counts.
 */

const KEY_RE = /\bt\(\s*["']([A-Za-z0-9_.]+)["']/g;

const collectKeys = (dir, found = new Map()) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "locales") continue;
      collectKeys(full, found);
      continue;
    }
    if (!/\.jsx?$/.test(entry.name)) continue;
    const src = fs.readFileSync(full, "utf8");
    let m;
    while ((m = KEY_RE.exec(src))) {
      // Dotted keys only: t("Some literal") is a fallback string, not a key.
      if (!m[1].includes(".")) continue;
      if (!found.has(m[1])) found.set(m[1], path.relative(".", full));
    }
  }
  return found;
};

const lookup = (obj, key) =>
  key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), obj);

describe("i18n key coverage", () => {
  const keys = collectKeys(path.resolve("src"));

  it("finds keys to check at all", () => {
    // Guards the scanner itself: a regex that stops matching would otherwise
    // make this suite pass by testing nothing.
    expect(keys.size).toBeGreaterThan(100);
  });

  it("resolves every literal key in the pt-PT bundle", () => {
    const missing = [...keys.entries()]
      .filter(([key]) => lookup(pt, key) === undefined)
      .map(([key, file]) => `${key}  (${file})`);

    expect(missing).toEqual([]);
  });
});
