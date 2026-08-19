/**
 * exerciseAccents.js
 *
 * Shared accent palette for exercise sub-components.
 *
 * Each exercise component used to hard-code its own colour — multiple-choice
 * selected in sky, true/false numbered in purple, ordering in violet — while
 * the section headers around them were sky (listening), teal (reading) and
 * amber (writing). The result was a purple selection sitting inside a teal
 * reading section. Components now take an `accent` prop and read their classes
 * from here, so selection state always matches the section it belongs to.
 *
 * Class strings are written out in full rather than composed, so Tailwind's
 * scanner can see them and keep them in the build.
 */

export const EXERCISE_ACCENTS = {
  sky: {
    marker:   { dark: 'border-sky-600 text-sky-400',    light: 'border-sky-500 text-sky-600' },
    selected: { dark: 'bg-sky-900/40 border-sky-500 text-sky-300',    light: 'bg-sky-50 border-sky-500 text-sky-800' },
    focus:    { dark: 'focus:border-sky-500',           light: 'focus:border-sky-600' },
  },
  teal: {
    marker:   { dark: 'border-teal-600 text-teal-400',  light: 'border-teal-500 text-teal-600' },
    selected: { dark: 'bg-teal-900/40 border-teal-500 text-teal-300', light: 'bg-teal-50 border-teal-500 text-teal-800' },
    focus:    { dark: 'focus:border-teal-500',          light: 'focus:border-teal-600' },
  },
  amber: {
    marker:   { dark: 'border-amber-600 text-amber-400', light: 'border-amber-500 text-amber-600' },
    selected: { dark: 'bg-amber-900/40 border-amber-500 text-amber-300', light: 'bg-amber-50 border-amber-500 text-amber-800' },
    focus:    { dark: 'focus:border-amber-500',         light: 'focus:border-amber-600' },
  },
};

export const ACCENT_NAMES = Object.keys(EXERCISE_ACCENTS);

/**
 * Resolve one accent slot to a class string.
 *
 * @param {string} accent - 'sky' | 'teal' | 'amber'
 * @param {string} slot   - 'marker' | 'selected' | 'focus'
 * @param {boolean} isDarkMode
 * @returns {string} Tailwind class string
 */
export function accentClass(accent, slot, isDarkMode) {
  const palette = EXERCISE_ACCENTS[accent] ?? EXERCISE_ACCENTS.sky;
  return palette[slot][isDarkMode ? 'dark' : 'light'];
}
