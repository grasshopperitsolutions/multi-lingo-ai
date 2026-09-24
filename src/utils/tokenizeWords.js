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
 * `start` is the token's character index in `text`, so a tapped word can be
 * placed back in its sentence (see utils/sentenceAt).
 *
 * @param {string} text
 * @returns {Array<{ text: string, word: string|null, start: number }>}
 */
export function tokenizeWords(text) {
  if (!text) return [];

  // Split on whitespace, keeping the whitespace itself as its own token so
  // the original spacing is preserved exactly on render — which is also what
  // makes each token's start the running total of the ones before it.
  const parts = text.split(/(\s+)/).filter((part) => part.length > 0);

  let start = 0;
  return parts.map((part) => {
    const token = /^\s+$/.test(part)
      ? { text: part, word: null, start }
      : {
          text: part,
          word: part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || null,
          start,
        };
    start += part.length;
    return token;
  });
}
