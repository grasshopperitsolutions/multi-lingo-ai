/**
 * letterKeys.js
 *
 * The alphabet a letter-guessing game offers, and the rule for deciding whether
 * a typed letter matches an answer letter.
 *
 * Extracted from HangmanGame so Crosswords can offer exactly the same keys and
 * the same easy/hard behaviour. Two games disagreeing on whether "E" satisfies
 * "E-acute" would be a worse bug than it sounds: the same word can appear in
 * both.
 *
 * Easy vs hard is purely about accents:
 *   easy - accent-insensitive. "E" matches "E-acute"; the answer still renders
 *          the accented form.
 *   hard - exact match required, and the accented keys are offered on the board.
 */

/** Fallback alphabet when no writing system is configured for the language. */
export const BASE_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Unicode "combining diacritical marks" block, U+0300 to U+036F.
 *
 * Built through the RegExp constructor from an escaped string rather than
 * written as a regex literal: a literal puts raw combining characters into the
 * source file, where they attach themselves to whatever precedes them and are
 * invisible in most editors and diffs. Same range Hangman has always used, so
 * the two games cannot drift apart on what counts as a match.
 */
const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

/** Strip diacritics and upper-case: "e-acute" becomes "E". */
export const normalizeChar = (c) =>
  String(c).normalize("NFD").replace(COMBINING_MARKS, "").toUpperCase();

/**
 * Find the writing system configured for a language.
 *
 * @param {Array<object>} writingSystems - from AppContext
 * @param {string} learningDialect       - BCP-47, e.g. "pt-PT"
 * @returns {object|undefined}
 */
function findSystem(writingSystems, learningDialect) {
  if (!writingSystems?.length) return undefined;
  return writingSystems.find((ws) =>
    Array.isArray(ws?.supportedLanguageCodes)
      ? ws.supportedLanguageCodes.includes(learningDialect)
      : false
  );
}

/**
 * The keys to render for a language.
 *
 * `accented` is empty for languages whose writing system declares no special
 * characters, which is why callers must tolerate an empty array rather than
 * assuming hard mode always has extra keys to show.
 *
 * @param {Array<object>} writingSystems
 * @param {string} learningDialect
 * @returns {{ base: string[], accented: string[] }}
 */
export function resolveLetterKeys(writingSystems, learningDialect) {
  const system = findSystem(writingSystems, learningDialect);

  const defaults = system?.characters?.default ?? [];
  const base =
    Array.isArray(defaults) && defaults.length > 0
      ? defaults.map((c) => String(c).toUpperCase())
      : BASE_KEYS;

  const specials = system?.characters?.special ?? [];
  const accented = Array.isArray(specials)
    ? specials.map((c) => String(c).toUpperCase())
    : [];

  return { base, accented };
}

/**
 * The comparison key for a letter under the current difficulty.
 *
 * Compare `letterKey(a, hard) === letterKey(b, hard)` rather than comparing the
 * letters directly - that is the whole of the easy/hard rule, in one place.
 *
 * @param {string} letter
 * @param {boolean} hardMode
 * @returns {string}
 */
export const letterKey = (letter, hardMode) =>
  hardMode ? String(letter).toUpperCase() : normalizeChar(letter);
