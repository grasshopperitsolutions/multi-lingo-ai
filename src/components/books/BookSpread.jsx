import { useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { bookSkinFor, BOOK_TIMING } from "../../config/dashboardBooks";
import DashboardFeatureGrid from "../DashboardFeatureGrid";

/**
 * BookSpread
 *
 * The opened book. Once the 3D flight and cover swing have finished, the book
 * hands over to this: ordinary DOM laid out as two pages.
 *
 * That handover is the whole design. Rendering interactive feature cards on a
 * rotated 3D plane costs blurry text, unreliable hit-testing and a lot of
 * accessibility, and buys nothing the eye can see once the book has settled
 * facing the reader. So the theatre is 3D and the content is not.
 *
 * Narrow screens show one page at a time with arrows, because a two-page spread
 * below ~1024px leaves each page too narrow to hold a card.
 */
const PAGE = { DESCRIPTION: 0, FEATURES: 1 };

const BookSpread = ({
  groupId,
  title,
  description,
  icon: Icon,
  tiles,
  isDarkMode,
  isNarrow,
  onClose,
  onPageTurn,
}) => {
  const { t } = useTranslation();
  const skin = bookSkinFor(groupId);
  const [page, setPage] = useState(PAGE.DESCRIPTION);

  const paperClasses = isDarkMode
    ? "bg-slate-800 text-slate-100"
    : "bg-[#fdfaf3] text-slate-900";

  const goToPage = (next) => {
    setPage(next);
    onPageTurn?.();
  };

  const descriptionPage = (
    <div className="flex flex-col justify-center h-full gap-5 p-6 sm:p-8">
      <div
        className={`w-16 h-16 rounded-2xl border-4 border-slate-900 flex items-center justify-center ${skin.cover}`}
      >
        <Icon size={30} className={skin.ink} />
      </div>
      <h2
        className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}
      >
        {title}
      </h2>
      <p
        className={`text-sm sm:text-base font-bold leading-relaxed ${
          isDarkMode ? "text-slate-300" : "text-slate-600"
        }`}
      >
        {description}
      </p>
      <p
        className={`text-xs font-black uppercase tracking-widest ${
          isDarkMode ? "text-slate-500" : "text-slate-400"
        }`}
      >
        {t("dashboard.books.feature_count", { count: tiles.length })}
      </p>
    </div>
  );

  // The page scrolls, so anything a card draws outside its own box gets
  // clipped: the 6px offset shadow, the hover wiggle (which scales to 1.05 and
  // rotates), and — worst of all — the description tooltip, which is drawn
  // above the card and was simply unreadable in here. Hence generous padding
  // plus showDescriptions, which moves the text onto the card and drops the
  // tooltip entirely.
  const featuresPage = (
    <div
      // An explicit max-height, not h-full: the page's parent is auto-height,
      // so `height: 100%` resolved to auto and overflow-y never engaged — the
      // pane simply grew and got clipped by the book's rounded frame, with no
      // way to reach the cards below the fold. Set as an inline style rather
      // than an arbitrary Tailwind class so it cannot depend on the JIT having
      // generated that particular utility.
      className={`overflow-y-auto p-7 neo-scrollbar ${isDarkMode ? "neo-scrollbar-dark" : ""}`}
      style={{ maxHeight: isNarrow ? "58vh" : "70vh" }}
    >
      <DashboardFeatureGrid
        tiles={tiles}
        showDescriptions
        gridClassName={
          isNarrow
            ? "grid grid-cols-1 gap-5"
            : // Books only render as a two-page spread at >= 1024px, so the
              // lg: column always applies here and the right page holds two.
              "grid grid-cols-1 lg:grid-cols-2 gap-5"
        }
      />
    </div>
  );

  return (
    <div className="w-full">
      <div
        className={`relative w-full rounded-2xl border-4 border-slate-900 overflow-hidden ${
          isDarkMode ? "shadow-[8px_8px_0px_0px_#1e293b]" : "shadow-[8px_8px_0px_0px_#0f172a]"
        }`}
        style={{ boxShadow: `8px 8px 0px 0px ${skin.edge}` }}
      >
        {isNarrow ? (
          /* ── One page at a time ─────────────────────────────────────────── */
          <div className={`relative ${paperClasses}`} style={{ minHeight: 420 }}>
            {/* A keyed motion.div rather than AnimatePresence.
                <AnimatePresence mode="wait"> deadlocked here exactly as it did
                on the shelf: the outgoing page never reported its exit
                complete, so the incoming one was never mounted. The footer
                label still changed, which made it look like an empty page
                rather than a stuck transition. Re-keying gives the flip its
                entry animation with nothing to wait on. */}
            <motion.div
              key={page}
              initial={{ opacity: 0, rotateY: page === PAGE.FEATURES ? 25 : -25 }}
              animate={{ opacity: 1, rotateY: 0 }}
              transition={{ duration: BOOK_TIMING.PAGE_FLIP, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: page === PAGE.FEATURES ? "left center" : "right center" }}
              className="min-h-[420px]"
            >
              {page === PAGE.DESCRIPTION ? descriptionPage : featuresPage}
            </motion.div>

            {/* Page arrows */}
            <div
              className={`flex items-center justify-between px-4 py-3 border-t-4 border-slate-900 ${
                isDarkMode ? "bg-slate-900/40" : "bg-black/5"
              }`}
            >
              <button
                type="button"
                onClick={() => goToPage(PAGE.DESCRIPTION)}
                disabled={page === PAGE.DESCRIPTION}
                aria-label={t("dashboard.books.previous_page")}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border-4 border-slate-900 font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${skin.cover} ${skin.ink}`}
              >
                <ChevronLeft size={16} />
              </button>

              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {page === PAGE.DESCRIPTION
                  ? t("dashboard.books.page_about")
                  : t("dashboard.books.page_features")}
              </span>

              <button
                type="button"
                onClick={() => goToPage(PAGE.FEATURES)}
                disabled={page === PAGE.FEATURES}
                aria-label={t("dashboard.books.next_page")}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg border-4 border-slate-900 font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${skin.cover} ${skin.ink}`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* ── Two-page spread ────────────────────────────────────────────── */
          <div className={`grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] ${paperClasses}`}>
            <div className="border-r-4 border-slate-900 min-h-[460px]">{descriptionPage}</div>
            <div className="min-h-[460px]">{featuresPage}</div>
          </div>
        )}
      </div>

      {/* Put it back */}
      <div className="flex justify-center mt-6">
        <button
          type="button"
          onClick={onClose}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs sm:text-sm transition-all active:scale-95 hover:-translate-y-0.5 ${
            isDarkMode
              ? "bg-slate-800 border-slate-600 text-slate-200 shadow-[4px_4px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}
        >
          <Undo2 size={16} />
          {t("dashboard.books.put_it_back")}
        </button>
      </div>
    </div>
  );
};

BookSpread.propTypes = {
  groupId: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  icon: PropTypes.elementType.isRequired,
  tiles: PropTypes.arrayOf(PropTypes.object).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isNarrow: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  /** Fired on a page arrow, so the shelf can play the paper rustle. */
  onPageTurn: PropTypes.func,
};

BookSpread.defaultProps = {
  description: "",
  isNarrow: false,
  onPageTurn: undefined,
};

export default BookSpread;
