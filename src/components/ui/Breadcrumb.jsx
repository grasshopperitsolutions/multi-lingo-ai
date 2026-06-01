import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

/**
 * Breadcrumb.jsx
 *
 * Reusable breadcrumb nav used across feature panels.
 *
 * Items API:
 *   - The FIRST item renders with an ArrowLeft icon and the "Back" label.
 *   - The LAST item is treated as the current page (rendered in accent color, no onClick).
 *   - All MIDDLE items render as clickable links.
 *
 * Usage:
 *   <Breadcrumb
 *     isDarkMode={isDarkMode}
 *     accentColor="rose"   // 'rose' | 'violet' | 'sky' | 'teal' | 'emerald'
 *     items={[
 *       { label: t('dashboard.back'), onClick: onBackToDashboard },
 *       { label: t('challenges.title'), onClick: onBackToMenu },
 *       { label: t('challenges.hangman') }
 *     ]}
 *   />
 */
const ACCENT = {
  rose: { d: "text-rose-400", l: "text-rose-600" },
  violet: { d: "text-violet-400", l: "text-violet-600" },
  sky: { d: "text-sky-400", l: "text-sky-600" },
  teal: { d: "text-teal-400", l: "text-teal-600" },
  emerald: { d: "text-emerald-400", l: "text-emerald-600" },
  amber: { d: "text-amber-400", l: "text-amber-600" },
  yellow: { d: "text-yellow-400", l: "text-yellow-600" },
};

const Breadcrumb = ({ isDarkMode, items = [], accentColor = "rose" }) => {
  const { t } = useTranslation();
  const accent = ACCENT[accentColor] ?? ACCENT.rose;
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {/* First item — Back */}
      <button
        onClick={items[0].onClick}
        className={`flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
          isDarkMode
            ? "text-slate-400 hover:text-white"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft size={14} />
        <span className="hidden xs:inline">{t("dashboard.back", "Back")}</span>
      </button>

      {/* Middle items + last item */}
      {items.slice(1).map((item, i) => {
        const isLast = i === items.slice(1).length - 1;
        const key = `crumb-${i}`;
        return (
          <span key={key} className="flex items-center gap-2">
            <span className={isDarkMode ? "text-slate-600" : "text-slate-400"}>
              /
            </span>
            {isLast || !item.onClick ? (
              <span
                className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? accent.d : accent.l}`}
              >
                {item.label}
              </span>
            ) : (
              <button
                onClick={item.onClick}
                className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
                  isDarkMode
                    ? "text-slate-400 hover:text-white"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
};

Breadcrumb.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
    }),
  ),
  accentColor: PropTypes.oneOf([
    "rose",
    "violet",
    "sky",
    "teal",
    "emerald",
    "amber",
    "yellow",
  ]),
};

Breadcrumb.defaultProps = {
  items: [],
  accentColor: "rose",
};

export default Breadcrumb;
