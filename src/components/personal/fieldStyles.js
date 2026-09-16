/**
 * fieldStyles.js
 *
 * The input and label classes every personal surface shares.
 *
 * They were written once in `PersonalListPage` and copied verbatim into
 * `GoalPage`; the dashboard widgets would have made it five copies, at which
 * point one of them drifts and a single field starts focusing a different
 * colour from its neighbours.
 *
 * A `.js` file exporting only functions, deliberately: putting these beside a
 * component in a `.jsx` trips `react-refresh/only-export-components`, the same
 * rule that forced `platformIcons.jsx` and `platformIconMap.js` apart.
 *
 * The one rule encoded here that is easy to lose: **no `text-sm`**. An input
 * under 16px makes iOS Safari zoom the viewport on focus and leave it zoomed,
 * so the size is inherited rather than set.
 */

/** Text input / textarea. Focus colour is the personal area's violet. */
export function personalInputClasses(isDarkMode) {
  return `w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-xl border-4 font-semibold outline-none transition-colors ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-violet-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-violet-500"
  }`;
}

/** The small uppercase label above a field. */
export function personalLabelClasses(isDarkMode) {
  return `block text-xs font-black uppercase tracking-widest mb-1.5 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;
}
