import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Maximize2 } from "lucide-react";
import { personalWidgetById } from "../../config/personalWidgets";
import { Card } from "../ui";

/**
 * PersonalWidgetCard
 *
 * The frame every widget on the personal dashboard sits in: an icon chip, a
 * title, an optional count, an optional control that opens the full page, and
 * the widget's own contents under a divider.
 *
 * ## The expand control is an icon, not a button with a label
 *
 * The dashboard is meant to replace the menu it grew out of, so a row of
 * "Ver todas" buttons would put the menu straight back on the page — six links
 * competing with the six things they link to. An icon in the corner is one tap
 * away for anyone who wants the long view and invisible to everyone who
 * doesn't. It still carries a translated `aria-label`, so it is a real control
 * to a screen reader rather than a mystery glyph.
 *
 * ## Skeletons, not spinners
 *
 * The frame paints immediately and the body shows three pulsing bars while its
 * data loads. A widget that renders `<Loader>` instead would put a bordered
 * card with bouncing blocks inside a bordered card — and with several widgets
 * loading at once the page reads as a crash. The title and the expand control
 * are useful before the data arrives, so they are never behind the skeleton.
 */
const Skeleton = ({ isDarkMode }) => (
  <div className="flex flex-col gap-2 py-1" aria-hidden="true">
    {[3, 4, 2].map((width, index) => (
      <div
        key={index}
        className={`h-3 rounded-full animate-pulse ${
          isDarkMode ? "bg-slate-700" : "bg-slate-200"
        }`}
        style={{ width: `${width * 20}%` }}
      />
    ))}
  </div>
);

Skeleton.propTypes = { isDarkMode: PropTypes.bool.isRequired };

const PersonalWidgetCard = ({
  widgetId,
  isDarkMode,
  count,
  expandTo,
  expandLabel,
  isLoading = false,
  children,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const widget = personalWidgetById(widgetId);
  // A typo'd id would otherwise fail as "cannot read icon of undefined" inside
  // the error boundary, which takes the whole dashboard down and says nothing
  // about why. There is no sensible fallback — the card has no name, no icon
  // and no description without a registry entry.
  if (!widget) {
    throw new Error(`[PersonalWidgetCard] "${widgetId}" is not in PERSONAL_WIDGETS`);
  }
  const Icon = widget.icon;

  return (
    <Card isDarkMode={isDarkMode} className="!p-3.5 sm:!p-5">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${widget.color}`}
        >
          <Icon size={15} className="text-slate-900" />
        </div>

        {/* Title wraps rather than truncating: it comes from a translation,
            and a language that runs longer than English would otherwise lose
            the end of its own word. `items-start` above keeps the icon and the
            controls put when the block takes two lines.

            The description is the same line Settings shows when you choose
            whether to keep the widget, so what you agreed to and what you see
            are the same sentence. */}
        <div className="flex-1 min-w-0">
          <h2
            className={`text-sm font-black uppercase tracking-widest break-words ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {t(widget.titleKey)}
          </h2>
          <p
            className={`text-xs font-semibold break-words mt-0.5 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {t(widget.descKey)}
          </p>
        </div>

        {count != null && (
          <span
            className={`text-xs font-black tabular-nums shrink-0 self-center ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}
          >
            {count}
          </span>
        )}

        {expandTo && (
          <button
            type="button"
            onClick={() => navigate(expandTo)}
            aria-label={expandLabel ?? t("personal.dash_expand")}
            // 44px explicitly: padding around a 15px icon lands at 39, and this
            // area's rule is a thumb-sized target.
            className={`shrink-0 -mr-2 rounded-xl transition-colors flex items-center justify-center min-w-[44px] min-h-[44px] ${
              isDarkMode
                ? "text-slate-500 hover:text-white hover:bg-slate-700"
                : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Maximize2 size={15} strokeWidth={3} />
          </button>
        )}
      </div>

      <div className={`mt-3 pt-3 sm:mt-4 sm:pt-4 border-t-2 ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
        {isLoading ? <Skeleton isDarkMode={isDarkMode} /> : children}
      </div>
    </Card>
  );
};

PersonalWidgetCard.propTypes = {
  /** An id from PERSONAL_WIDGETS — name, description, icon and colour come from there. */
  widgetId: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  /** Rendered beside the title when present. Pass a string so "200+" works. */
  count: PropTypes.string,
  /** Route for the expand control. Omit to render no control at all. */
  expandTo: PropTypes.string,
  expandLabel: PropTypes.string,
  isLoading: PropTypes.bool,
  children: PropTypes.node,
};

export default PersonalWidgetCard;
