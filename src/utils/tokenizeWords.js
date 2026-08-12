/**
 * tokenizeWords.js
 *
 * Splits a paragraph into renderable tokens for tap-to-look-up text: each
 * token keeps its original text (so punctuation and spacing render exactly as
 * written) plus a `word` field — the token with leading/trailing punctuation
 * stripped — which is null for pure whitespace/punctuation tokens that
 * shouldn't be clickable.
 *
 * \p{L}/\p{N} (Unicode letter/number classes) are used instead of \w so
 * accented characters (á, ã, ç, õ...) count as word characters — \w only
 * matches ASCII.
 *
 * @param {string} text
 * @returns {Array<{ text: string, word: string|null }>}
 */
export function tokenizeWords(text) {
  if (!text) return [];

  // Split on whitespace, keeping the whitespace itself as its own token so
  // the original spacing is preserved exactly on render.
  const parts = text.split(/(\s+)/);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => {
      if (/^\s+$/.test(part)) return { text: part, word: null };

      const stripped = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      return { text: part, word: stripped || null };
    });
}
