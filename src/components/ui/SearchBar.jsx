import PropTypes from "prop-types";
import { Search } from "lucide-react";

/**
 * SearchBar — shared search + filter-chip control for admin list sections.
 * Purely controlled: callers own searchValue/activeFilters and do their own
 * client-side filtering against them. The search input can be hidden via
 * showSearch={false} for filter-only bars; the filter row only renders when
 * `filters` is a non-empty array. Filter chips are independent toggles
 * (multi-select, OR semantics) — pressing one doesn't un-press the others.
 */
const SearchBar = ({
  showSearch,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filters,
  activeFilters,
  onFilterToggle,
  isDarkMode,
  className,
}) => (
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
          className={`w-full pl-11 pr-4 py-2.5 rounded-xl border-2 font-semibold text-sm outline-none transition-colors ${
            isDarkMode
              ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-400"
              : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
          }`}
        />
      </div>
    )}

    {filters.length > 0 && (
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => {
          const isActive = activeFilters.includes(filter.value);
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onFilterToggle(filter.value)}
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
              {filter.label}
            </button>
          );
        })}
      </div>
    )}
  </div>
);

SearchBar.propTypes = {
  showSearch: PropTypes.bool,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  filters: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ),
  activeFilters: PropTypes.arrayOf(PropTypes.string),
  onFilterToggle: PropTypes.func,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

SearchBar.defaultProps = {
  showSearch: true,
  searchValue: "",
  onSearchChange: () => {},
  searchPlaceholder: "Search...",
  filters: [],
  activeFilters: [],
  onFilterToggle: () => {},
  className: "",
};

export default SearchBar;
