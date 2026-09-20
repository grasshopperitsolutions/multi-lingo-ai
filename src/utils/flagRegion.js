/**
 * flagRegion.js
 *
 * The region subtag of a BCP-47 code, lower-cased, or null when there isn't
 * one — which is what `flag-icons` keys its sprite on (`fi-pt`, `fi-br`).
 *
 * **It is the region, never the language.** `en-GB` flies the British flag and
 * `pt-BR` the Brazilian one; `pt` alone flies nothing, because a language is
 * not a country and guessing one would put the wrong flag on Mirandese,
 * Catalan and every other code that shares a region with a bigger neighbour.
 *
 * Its own module rather than a helper exported from `LanguageFlagIcon`,
 * because two things now need it — the icon and the practice-language card's
 * full-bleed flag field — and `react-refresh/only-export-components` forbids
 * exporting a function from a component file.
 *
 * @param {string} [code] - e.g. "pt-PT", "mwl-PT", "sr-Cyrl", "ia"
 * @returns {string|null} e.g. "pt", or null for a code carrying no region
 */
export function flagRegion(code) {
  if (typeof code !== "string") return null;
  // Only a two-letter region qualifies. Splitting on the first dash and
  // taking whatever follows would hand `sr-Cyrl` a script subtag and ask
  // flag-icons for a flag named "cyrl", which renders as nothing at all.
  const region = code.split("-").find((part) => /^[A-Za-z]{2}$/.test(part) && part === part.toUpperCase());
  return region ? region.toLowerCase() : null;
}
