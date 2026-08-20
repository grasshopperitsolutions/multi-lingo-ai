/**
 * exerciseAccents.js
 *
 * Colour vocabulary for exercise sub-components.
 *
 * Three semantic states, each with exactly one meaning across every exercise
 * type. They used to be muddled: reading marked correct answers in teal and
 * listening in sky, while selection borrowed whichever colour the section
 * header used — so blue meant both "you picked this" and "this was right" in
 * listening, and teal meant both in reading.
 *
 *   SELECTED  — blue. "You picked this." Before submission only.
 *   CORRECT   — emerald. "This was right." After submission only.
 *   INCORRECT — rose. "This was wrong." After submission only.
 *
 * Blue is the app's base accent (bg-blue-600 on the marketing pages), so
 * selection reads as a neutral UI state rather than a verdict.
 *
 * `accentClass(accent, 'marker' | 'focus')` remains for decorative per-section
 * tinting — the numbered bullets and input focus rings that carry no
 * answer-state meaning. There is deliberately no accent-tinted "selected".
 *
 * Class strings are written out in full rather than composed, so Tailwind's
 * scanner can see them and keep them in the build.
 */

// ── Semantic answer states ────────────────────────────────────────────────

/** "You picked this" — the only selection colour, identical everywhere. */
export const SELECTED_CLASSES = {
  dark: 'bg-blue-900/40 border-blue-500 text-blue-200',
  light: 'bg-blue-50 border-blue-600 text-blue-900',
};

/** "This was right" — results views only, never before submission. */
export const CORRECT_CLASSES = {
  dark: 'bg-emerald-900/30 border-emerald-600 text-emerald-300',
  light: 'bg-emerald-50 border-emerald-500 text-emerald-800',
};

/** "This was wrong" — results views only. */
export const INCORRECT_CLASSES = {
  dark: 'bg-rose-900/30 border-rose-600 text-rose-300',
  light: 'bg-rose-50 border-rose-500 text-rose-800',
};

/** Text-only variants, for results rows that colour the answer text itself. */
export const CORRECT_TEXT = { dark: 'text-emerald-400', light: 'text-emerald-700' };
export const INCORRECT_TEXT = { dark: 'text-rose-400', light: 'text-rose-600' };

export const selectedClass = (isDarkMode) => (isDarkMode ? SELECTED_CLASSES.dark : SELECTED_CLASSES.light);
export const correctClass = (isDarkMode) => (isDarkMode ? CORRECT_CLASSES.dark : CORRECT_CLASSES.light);
export const incorrectClass = (isDarkMode) => (isDarkMode ? INCORRECT_CLASSES.dark : INCORRECT_CLASSES.light);
export const correctTextClass = (isDarkMode) => (isDarkMode ? CORRECT_TEXT.dark : CORRECT_TEXT.light);
export const incorrectTextClass = (isDarkMode) => (isDarkMode ? INCORRECT_TEXT.dark : INCORRECT_TEXT.light);

/** The unselected/neutral option state, shared so it can't drift either. */
export const UNSELECTED_CLASSES = {
  dark: 'border-slate-600 text-slate-300 hover:bg-slate-700/50',
  light: 'border-slate-200 text-slate-700 hover:bg-slate-50',
};
export const unselectedClass = (isDarkMode) => (isDarkMode ? UNSELECTED_CLASSES.dark : UNSELECTED_CLASSES.light);

// ── Decorative section accents ────────────────────────────────────────────

export const EXERCISE_ACCENTS = {
  sky: {
    marker: { dark: 'border-sky-600 text-sky-400', light: 'border-sky-500 text-sky-600' },
    focus: { dark: 'focus:border-sky-500', light: 'focus:border-sky-600' },
  },
  teal: {
    marker: { dark: 'border-teal-600 text-teal-400', light: 'border-teal-500 text-teal-600' },
    focus: { dark: 'focus:border-teal-500', light: 'focus:border-teal-600' },
  },
  amber: {
    marker: { dark: 'border-amber-600 text-amber-400', light: 'border-amber-500 text-amber-600' },
    focus: { dark: 'focus:border-amber-500', light: 'focus:border-amber-600' },
  },
};

export const ACCENT_NAMES = Object.keys(EXERCISE_ACCENTS);

/**
 * Resolve one decorative accent slot to a class string.
 *
 * @param {string} accent - 'sky' | 'teal' | 'amber'
 * @param {string} slot   - 'marker' | 'focus'
 * @param {boolean} isDarkMode
 * @returns {string} Tailwind class string
 */
export function accentClass(accent, slot, isDarkMode) {
  const palette = EXERCISE_ACCENTS[accent] ?? EXERCISE_ACCENTS.sky;
  return palette[slot][isDarkMode ? 'dark' : 'light'];
}
