/**
 * Normalize a BCP-47-ish language code for comparison/dedup purposes:
 * lowercase the language subtag, uppercase the region subtag.
 * "en-gb" / "EN-GB" / "en-GB" all normalize to "en-GB".
 */
export function normalizeCode(code) {
  if (typeof code !== "string") return "";
  const [lang, ...rest] = code.trim().split("-");
  if (!lang) return "";
  const region = rest.join("-");
  return region ? `${lang.toLowerCase()}-${region.toUpperCase()}` : lang.toLowerCase();
}
