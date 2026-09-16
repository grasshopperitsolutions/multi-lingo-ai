import { forwardRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Check, CloudOff, Loader2 } from "lucide-react";
import PersonalWidgetCard from "../PersonalWidgetCard";
import { personalInputClasses } from "../fieldStyles";

/**
 * NoteBoardWidget
 *
 * The note board, live on the dashboard and deliberately short.
 *
 * Corridor use is "add two lines". Desk use is "scroll back through six weeks",
 * and that is what the full page's `min-h-[60vh]` is for — putting that height
 * here would push the journals below it two screens down on a phone. Six rows
 * plus `resize-y` covers the first case and lets anyone who wants more drag for
 * it without leaving the page.
 *
 * The status line comes along and is not optional. It is the whole reason
 * `usePersonalNoteBoard` reports a status: a box that autosaves and says
 * nothing is asking to be trusted with the only copy of something you wrote.
 *
 * Takes a ref so the first-run card can focus it without navigating anywhere.
 */
const STATUS_ICONS = {
  saving: Loader2,
  saved: Check,
  error: CloudOff,
};

const NoteBoardWidget = forwardRef(function NoteBoardWidget(
  { text, onChange, status, maxChars, isDarkMode, isLoading },
  ref,
) {
  const { t } = useTranslation();

  const STATUS_LABELS = {
    unsaved: t("personal.notes_unsaved"),
    saving: t("personal.notes_saving"),
    saved: t("personal.notes_saved"),
    error: t("personal.notes_save_failed"),
  };

  const Icon = STATUS_ICONS[status];
  const label = STATUS_LABELS[status];

  return (
    <PersonalWidgetCard
      widgetId="notes"
      isDarkMode={isDarkMode}
      isLoading={isLoading}
      expandTo="/dashboard/personal/notes"
      expandLabel={t("personal.dash_open_board")}
    >
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="dash-note-board">
          {t("personal.notes_title")}
        </label>
        {/* No text-sm: under 16px iOS Safari zooms the viewport on focus and
            leaves it zoomed. */}
        <textarea
          id="dash-note-board"
          ref={ref}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("personal.notes_placeholder")}
          maxLength={maxChars}
          rows={4}
          className={`${personalInputClasses(isDarkMode)} resize-y font-medium leading-relaxed min-h-[7rem] sm:min-h-[9rem]`}
        />

        <span
          aria-live="polite"
          className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest min-h-[1rem] ${
            status === "error"
              ? "text-red-500"
              : isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {Icon && (
            <Icon size={13} strokeWidth={3} className={status === "saving" ? "animate-spin" : ""} />
          )}
          {label ?? ""}
        </span>
      </div>
    </PersonalWidgetCard>
  );
});

NoteBoardWidget.propTypes = {
  text: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  status: PropTypes.oneOf(["idle", "unsaved", "saving", "saved", "error"]).isRequired,
  maxChars: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool,
};

export default NoteBoardWidget;
