import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import PersonalWidgetCard from "../PersonalWidgetCard";

/** Quick ways to top up after paying for a block of lessons. */
const TOP_UPS = [1, 4, 8, 10];

/**
 * LessonCounterWidget
 *
 * How many lessons are left with a private tutor. The one-tap action on this
 * whole page: you mark a lesson off walking out of it.
 *
 * Functionally this is all of `LessonCounterPage` — so it carries **no expand
 * control**. A link to a page showing the same number in larger type is noise.
 * The page itself stays routed, because it is a breadcrumb target and a
 * bookmark.
 *
 * The numeral drops from the page's `text-7xl` to `text-5xl`: 7xl is that page
 * saying "this is what I am", and inside a card among eight siblings it would
 * shout over everything. The controls stay 56px, because the tap target is the
 * part that must not shrink.
 *
 * Every write goes through the caller's debounced `save`, so four taps are one
 * Firestore write.
 */
const LessonCounterWidget = ({ remaining, onSave, isDarkMode, isLoading }) => {
  const { t } = useTranslation();

  const stepButton = `flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border-4 transition-all active:scale-95 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700 text-white"
      : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
  }`;

  return (
    <PersonalWidgetCard
      widgetId="lessons"
      isDarkMode={isDarkMode}
      isLoading={isLoading}
    >
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        <span
          className={`text-4xl sm:text-5xl font-black tracking-tighter tabular-nums ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
          aria-live="polite"
        >
          {remaining}
        </span>

        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onSave({ lessonsRemaining: Math.max(0, remaining - 1) })}
            disabled={remaining <= 0}
            aria-label={t("personal.lessons_use_one")}
            className={`${stepButton} ${remaining <= 0 ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <Minus size={24} strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={() => onSave({ lessonsRemaining: remaining + 1 })}
            aria-label={t("personal.lessons_add_one")}
            className={stepButton}
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>

        {/* The label sits above rather than inline: sharing a row with the
            pills pushed "+10" onto a line of its own at 360px, and four pills
            in a row reads as one control where three-plus-one reads as a
            wrapping mistake. */}
        <div className="flex flex-col items-center gap-2 w-full">
          <span className={`text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
            {t("personal.lessons_top_up")}
          </span>
          <div className="flex items-center justify-center gap-2">
          {TOP_UPS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onSave({ lessonsRemaining: remaining + amount })}
              className={`px-3.5 sm:px-4 min-h-[44px] rounded-full border-2 font-black text-xs tabular-nums transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-slate-200"
                  : "bg-slate-50 border-slate-300 text-slate-700"
              }`}
            >
              +{amount}
            </button>
          ))}
          </div>
        </div>
      </div>
    </PersonalWidgetCard>
  );
};

LessonCounterWidget.propTypes = {
  remaining: PropTypes.number.isRequired,
  /** The debounced `save` from usePersonalSettings. */
  onSave: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default LessonCounterWidget;
