/**
 * flagRegion.js
 *
 * The country a language code should fly the flag of, lower-cased for
 * `flag-icons` (`fi-pt`, `fi-br`), or null when there is no sensible answer.
 *
 * Two steps, in this order.
 *
 * **1 — an explicit region subtag wins.** `en-GB` flies the British flag and
 * `pt-BR` the Brazilian one. This never consults a lookup table, so a code
 * that states its region is answered the same way forever.
 *
 * **2 — otherwise, ask CLDR what region the language implies.**
 * `Intl.Locale#maximize` is the browser's own likely-subtags data: `ja-Hira`
 * and `ja-Latn` maximize to `ja-Hira-JP` and `ja-Latn-JP`, so Japanese written
 * in hiragana or romaji flies Japan's flag despite carrying a *script* subtag
 * where a region would go. Same for `sr-Cyrl` → RS.
 *
 * **Reading the language subtag as a country is what this deliberately does
 * not do**, however tempting it looks. It fails at the case that motivated it
 * — `ja` is not `JP`, so Japanese would still get nothing — and it is
 * confidently wrong elsewhere: `ca` (Catalan) is Canada's code, `ne` (Nepali)
 * is Niger's, `si` (Sinhala) is Slovenia's, `sv` (Swedish) is El Salvador's.
 * A missing flag is a small disappointment; the wrong country on a language is
 * the kind of mistake people screenshot.
 *
 * A language belonging to no one country resolves to the UN's `001` ("World")
 * — Interlingua does — and is rejected here, because there is no flag for it
 * and the globe is the honest answer.
 *
 * Its own module rather than a helper exported from `LanguageFlagIcon`,
 * because two things need it — the icon and the practice-language card's
 * full-bleed flag field — and `react-refresh/only-export-components` forbids
 * exporting a function from a component file.
 *
 * @param {string} [code] - e.g. "pt-PT", "mwl-PT", "ja-Hira", "ia"
 * @returns {string|null} e.g. "pt", or null when no country applies
 */
export function flagRegion(code) {
  if (typeof code !== "string" || !code.trim()) return null;

  const explicit = code
    .split("-")
    .find((part) => /^[A-Za-z]{2}$/.test(part) && part === part.toUpperCase());
  if (explicit) return explicit.toLowerCase();

  if (typeof Intl?.Locale !== "function") return null;
  try {
    const region = new Intl.Locale(code).maximize().region;
    // Two letters only. A numeric UN M49 region (`001`, `419`) names a part of
    // the world rather than a country, and flag-icons has no sprite for one.
    return region && /^[A-Za-z]{2}$/.test(region) ? region.toLowerCase() : null;
  } catch {
    // Not a well-formed tag at all — a user-typed "Other" entry that has not
    // been canonicalised yet. The globe is correct for it.
    return null;
  }
}
