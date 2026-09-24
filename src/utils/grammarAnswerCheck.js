/**
 * grammarAnswerCheck.js
 *
 * Marks typed Grammar Practice answers against an item's accepted answers.
 *
 * Normalisation lives here, in code, not in the prompt: the model is asked for
 * correct forms, and everything cosmetic — case, spacing, final punctuation,
 * apostrophe and dash variants — is forgiven by the checker.
 *
 * Accents are deliberately NOT forgiven. In many languages they are the
 * grammar (pt-PT "falamos"/"falámos", "esta"/"está"), so an answer that is
 * right only once accents are stripped gets its own verdict: wrong, but with a
 * hint the screen can show.
 */

const APOSTROPHES = /[‘’ʼ`´]/g;
const DASHES = /[‐‑‒–—―−]/g;
const DOUBLE_QUOTES = /[“”«»"]/g;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAnswer(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(APOSTROPHES, "'")
    .replace(DASHES, "-")
    .replace(DOUBLE_QUOTES, "")
    .toLocaleLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?¡¿…]+$/u, "")
    .replace(/^[¡¿]+/u, "")
    .trim();
}

/** @param {string} value */
export function stripDiacritics(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC");
}

export const VERDICT = Object.freeze({
  CORRECT: "correct",
  ACCENT: "accent",
  WRONG: "wrong",
});

/**
 * @param {string} userAnswer
 * @param {string[]} accepted
 * @returns {{ verdict: string, matched: string|null }}
 */
export function checkTypedAnswer(userAnswer, accepted = []) {
  const given = normalizeAnswer(userAnswer);
  if (!given) return { verdict: VERDICT.WRONG, matched: null };

  const list = (Array.isArray(accepted) ? accepted : []).filter(Boolean);
  const exact = list.find((answer) => normalizeAnswer(answer) === given);
  if (exact) return { verdict: VERDICT.CORRECT, matched: exact };

  const bare = stripDiacritics(given);
  const nearly = list.find((answer) => stripDiacritics(normalizeAnswer(answer)) === bare);
  if (nearly) return { verdict: VERDICT.ACCENT, matched: nearly };

  return { verdict: VERDICT.WRONG, matched: null };
}

/**
 * A set of choices is right when it is exactly the accepted set.
 *
 * @param {string[]} chosen
 * @param {string[]} accepted
 */
export function checkSelection(chosen = [], accepted = []) {
  const a = new Set(chosen.map(normalizeAnswer));
  const b = new Set(accepted.map(normalizeAnswer));
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/**
 * Every answer a checker should accept for an item: the key plus anything the
 * AI has accepted before.
 *
 * @param {{ answers?: string[], learnedAnswers?: string[] }} item
 */
export function acceptedAnswersFor(item) {
  return [...(item?.answers ?? []), ...(item?.learnedAnswers ?? [])];
}
