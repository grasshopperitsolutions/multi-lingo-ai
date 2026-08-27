import PropTypes from "prop-types";

/**
 * DashboardTabs
 *
 * The dashboard tab bar. Presentational — the caller decides which tabs exist
 * and which one is active.
 *
 * Scrolls horizontally with snap points on small screens, matching the stats
 * row above it rather than wrapping onto a second line.
 *
 * `lockedCount` renders a small counter on the pill. Splitting the old single
 * grid into tabs otherwise hides most of the locked tiles from a free user,
 * and those tiles are the upsell — the counter is what keeps the rest of the
 * catalogue advertised from the tab bar.
 */
const DashboardTabs = ({ tabs, activeId, onSelect, isDarkMode, ariaLabel }) => {
  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-2 sm:gap-3 overflow-x-auto py-2 px-0.5 snap-x snap-mandatory neo-scrollbar ${
        isDarkMode ? "neo-scrollbar-dark" : ""
      }`}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === activeId;

        return (
          <button
            key={tab.id}
            role="tab"
            id={`dashboard-tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`dashboard-panel-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            className={`snap-start shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border-4 text-xs sm:text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${
              isActive
                ? isDarkMode
                  ? "bg-slate-700 border-slate-500 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-slate-900 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:-translate-y-0.5"
                  : "bg-white border-slate-900 text-slate-500 hover:text-slate-900 hover:-translate-y-0.5"
            }`}
          >
            <Icon size={16} className="shrink-0" />
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.lockedCount > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full border-2 text-[10px] leading-none ${
                  isDarkMode
                    ? "bg-amber-500/15 text-amber-300 border-amber-400/50"
                    : "bg-amber-100 text-amber-800 border-amber-400"
                }`}
              >
                {tab.lockedCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

DashboardTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
      /** Tiles in this tab the user cannot use yet. 0 hides the counter. */
      lockedCount: PropTypes.number,
    }),
  ).isRequired,
  activeId: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  /** Accessible name for the tablist. */
  ariaLabel: PropTypes.string,
};

DashboardTabs.defaultProps = {
  ariaLabel: undefined,
};

export default DashboardTabs;
