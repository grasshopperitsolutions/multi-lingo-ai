import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination.jsx
 *
 * Presentational page controls, generic enough to sit under any list a page
 * has already sliced into pages — it takes `page`/`totalPages` and reports
 * `onChange`, and does no fetching, filtering or slicing of its own. Built
 * for the tutor directory, whose directory is still small enough to paginate
 * in memory, but kept free of anything tutor-specific so the next list this
 * app grows into (and it will — see CLAUDE.md on this page) can reuse it
 * as-is rather than growing a second one.
 *
 * Renders nothing for a single page: a lone "1" with disabled arrows either
 * side answers a question nobody asked.
 *
 * Page numbers collapse with an ellipsis once there are more than 7 — first,
 * last, the current page, and one neighbour on each side stay, matching the
 * pattern most pagination controls converge on because it answers both
 * "where am I" and "how far is the end" without listing every page.
 */
const Pagination = ({ page, totalPages, onChange, isDarkMode }) => {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  const pageButtonClasses = (active) =>
    `min-w-[2.25rem] h-9 px-2 rounded-xl border-2 font-black text-sm transition-all active:scale-95
      ${active
        ? isDarkMode
          ? "bg-yellow-400 border-yellow-400 text-slate-900"
          : "bg-yellow-400 border-slate-900 text-slate-900"
        : isDarkMode
          ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
          : "bg-white border-slate-300 text-slate-600 hover:border-slate-900"}`;

  const arrowClasses = `flex items-center justify-center w-9 h-9 rounded-xl border-2 transition-all active:scale-95
    ${isDarkMode
      ? "bg-slate-800 border-slate-700 text-slate-300 disabled:opacity-30 hover:border-slate-500"
      : "bg-white border-slate-300 text-slate-600 disabled:opacity-30 hover:border-slate-900"}`;

  // First, last, current, and one neighbour each side; null marks a gap.
  const numbers = [];
  for (let n = 1; n <= totalPages; n++) {
    const edge = n === 1 || n === totalPages;
    const near = Math.abs(n - page) <= 1;
    if (edge || near) {
      numbers.push(n);
    } else if (numbers[numbers.length - 1] !== null) {
      numbers.push(null);
    }
  }

  return (
    <nav
      aria-label={t("common.pagination")}
      className="flex items-center justify-center gap-2 flex-wrap mt-8"
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label={t("common.previous")}
        className={arrowClasses}
      >
        <ChevronLeft size={18} />
      </button>

      {numbers.map((n, i) =>
        n === null ? (
          <span
            key={`gap-${i}`}
            className={`px-1 font-black ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={n === page ? "page" : undefined}
            className={pageButtonClasses(n === page)}
          >
            {n}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={t("common.next")}
        className={arrowClasses}
      >
        <ChevronRight size={18} />
      </button>

      <span className="sr-only" role="status">
        {t("common.page_of", { page, total: totalPages })}
      </span>
    </nav>
  );
};

Pagination.propTypes = {
  /** 1-indexed current page. */
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default Pagination;
