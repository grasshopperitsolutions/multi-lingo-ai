import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * SearchBar — shared search + filter control for list sections across the
 * app (admin panels and the tutor directory).
 *
 * Purely controlled: callers own searchValue and each filter group's
 * activeValues, and do their own client-side filtering against them.
 * SearchBar never invents its own "clear everything" callback — the clear
 * button (see below) works by calling onSearchChange("") and, for each
 * group, toggling every currently-active value off one at a time through
 * the group's own onToggle. That only works because every caller's toggle
 * uses a functional state update (`setX(prev => ...)`), so N synchronous
 * calls in one tick correctly end up empty rather than racing each other —
 * keep that when you add a new filter group.
 *
 * `filterGroups` is an array so a screen can filter along more than one
 * dimension at once (e.g. tier AND language). Each group renders as a chip
 * row when it has FILTER_DROPDOWN_THRESHOLD options or fewer — the
 * lightweight, one-tap-to-toggle look every filter here used to have — and
 * as a multi-select dropdown once there are more than that. A long chip row
 * wraps into several lines and turns "which are active?" into a hunt; a
 * dropdown keeps the bar one line regardless of how many options a group
 * has (the tutor directory's language filter is the reason this exists —
 * one option per known language, easily past five).
 *
 * A group's own label is only shown once there's more than one group — a
 * single filter dimension (every existing caller, today) reads fine as bare
 * chips or a bare dropdown, and a label would be redundant.
 */

const FILTER_DROPDOWN_THRESHOLD = 5;

const filterGroupShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  /** Shown as a prefix when there's more than one group, and always shown as
   *  the dropdown trigger's own label once a group has more than five
   *  options. */
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  activeValues: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggle: PropTypes.func.isRequired,
});

function FilterChips({ group, isDarkMode, showLabel }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showLabel && (
        <span className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {group.label}
        </span>
      )}
      {group.options.map((option) => {
        const isActive = group.activeValues.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => group.onToggle(option.value)}
            className={`px-3 py-1.5 rounded-full border-2 font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 ${
              isActive
                ? isDarkMode
                  ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[2px_2px_0px_0px_#854d0e]"
                  : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
                : isDarkMode
                  ? "bg-slate-800 border-slate-700 text-slate-300"
                  : "bg-white border-slate-300 text-slate-600"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

FilterChips.propTypes = {
  group: filterGroupShape.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  showLabel: PropTypes.bool.isRequired,
};

function FilterDropdown({ group, isDarkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const count = group.activeValues.length;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 font-black uppercase text-[11px] tracking-widest transition-all active:scale-95 ${
          count > 0
            ? isDarkMode
              ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[2px_2px_0px_0px_#854d0e]"
              : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
            : isDarkMode
              ? "bg-slate-800 border-slate-700 text-slate-300"
              : "bg-white border-slate-300 text-slate-600"
        }`}
      >
        {group.label}
        {count > 0 && <span aria-hidden="true">({count})</span>}
        <ChevronDown size={12} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={group.label}
          className={`absolute z-50 mt-2 min-w-[12rem] max-h-52 overflow-y-auto rounded-xl border-4 neo-scrollbar ${
            isDarkMode ? "neo-scrollbar-dark " : ""
          }${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}
        >
          {group.options.map((option) => {
            const isActive = group.activeValues.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => group.onToggle(option.value)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 font-bold text-sm transition-colors ${
                  isDarkMode ? "hover:bg-slate-700 text-slate-100" : "hover:bg-slate-100 text-slate-900"
                }`}
              >
                <span
                  className={`shrink-0 flex items-center justify-center w-4 h-4 rounded border-2 ${
                    isActive
                      ? isDarkMode
                        ? "bg-yellow-400 border-yellow-400"
                        : "bg-blue-600 border-blue-600"
                      : isDarkMode
                        ? "border-slate-500"
                        : "border-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  {isActive && <Check size={11} strokeWidth={3} className={isDarkMode ? "text-slate-900" : "text-white"} />}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

FilterDropdown.propTypes = {
  group: filterGroupShape.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const SearchBar = ({
  showSearch = true,
  searchValue = "",
  onSearchChange = () => {},
  searchPlaceholder = "Search...",
  filterGroups = [],
  isDarkMode,
  className = "",
}) => {
  const { t } = useTranslation();
  const hasActiveFilters = filterGroups.some((group) => group.activeValues.length > 0);
  const hasAnythingToClear = searchValue.trim() !== "" || hasActiveFilters;

  const handleClear = () => {
    onSearchChange("");
    for (const group of filterGroups) {
      // Toggling each active value off individually, rather than a bulk-set
      // callback SearchBar would have to invent — every toggle here already
      // does exactly this on a second click, so reusing it needs no new prop.
      for (const value of group.activeValues) group.onToggle(value);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {showSearch && (
        <div className="relative">
          <Search
            size={16}
            className={`absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`w-full pl-11 pr-9 py-2.5 rounded-xl border-2 font-semibold text-sm outline-none transition-colors ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-400"
                : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
            }`}
          />
          {hasAnythingToClear && (
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("common.clear")}
              className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
                isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-600" : "text-slate-400 hover:text-slate-900 hover:bg-slate-200"
              }`}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {filterGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {filterGroups.map((group) =>
            group.options.length > FILTER_DROPDOWN_THRESHOLD ? (
              <FilterDropdown key={group.id} group={group} isDarkMode={isDarkMode} />
            ) : (
              group.options.length > 0 && (
                <FilterChips
                  key={group.id}
                  group={group}
                  isDarkMode={isDarkMode}
                  showLabel={filterGroups.length > 1}
                />
              )
            ),
          )}
        </div>
      )}
    </div>
  );
};

SearchBar.propTypes = {
  showSearch: PropTypes.bool,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  /** One entry per independent filter dimension. A group with more than
   *  five options renders as a multi-select dropdown instead of chips. */
  filterGroups: PropTypes.arrayOf(filterGroupShape),
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

export default SearchBar;
