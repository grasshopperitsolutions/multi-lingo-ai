import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import LanguageFlagIcon from "./LanguageFlagIcon";

/**
 * Past this many options the panel stops growing and scrolls instead. The
 * interface-language picker on the landing page is the reason: one entry per
 * seeded language, so the list runs off the bottom of the viewport and the
 * options underneath are simply unreachable.
 */
const SCROLL_AFTER_OPTIONS = 5;

/**
 * Past this many, scrolling is no longer enough and a filter box appears.
 *
 * Automatic rather than opt-in because the lists that most needed it were the
 * ones nobody thought to ask for it on: the timezone picker is ~418 options
 * and the dial-code picker ~102, both of which were a scroll through a
 * six-row window. `searchable` overrides this in both directions.
 *
 * Eight is chosen so the short pickers — CEFR levels, tone, status — keep
 * their current shape. A search box over six rows is furniture.
 */
const SEARCH_AFTER_OPTIONS = 8;

/** Sentinel for the "not in this list" row. Never a real option value. */
const OTHER_VALUE = "__other__";

/**
 * Case- and accent-insensitive, so "acores" finds "Açores" and "portugues"
 * finds "Português". Combining marks are stripped by range rather than with
 * \p{Diacritic}, which needs the unicode flag and buys nothing here.
 */
function fold(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const NeoDropdown = ({
  options,
  value,
  onChange,
  icon: Icon,
  isDarkMode,
  className = "",
  label = "",
  placeholder = "",
  showOtherOption = false,
  otherLabel = "Other",
  onOtherSelect,
  searchable,
  searchPlaceholder = "",
  multiple = false,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // `value` is a scalar for a single picker and an array for a multiple one.
  // Normalised once here so nothing below has to branch on the shape.
  const selectedValues = useMemo(
    () => (multiple ? (Array.isArray(value) ? value : []) : []),
    [multiple, value]
  );
  const isSelected = (optionValue) =>
    multiple ? selectedValues.includes(optionValue) : optionValue === value;

  const showSearch = searchable ?? options.length > SEARCH_AFTER_OPTIONS;

  const filteredOptions = useMemo(() => {
    if (!showSearch || !query.trim()) return options;
    const needle = fold(query);
    // Matched against the value as well as the label, so a reader who knows
    // the code can type "pt-BR" and a reader who does not can type
    // "brasil" — the language pickers are the caller where both happen.
    return options.filter(
      (option) => fold(option.label).includes(needle) || fold(option.value).includes(needle)
    );
  }, [options, query, showSearch]);

  const selectedOption =
    options.find((opt) => opt.value === value) ||
    (showOtherOption ? { value: OTHER_VALUE, label: otherLabel } : options[0]) ||
    { value: "", label: "" };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // A stale filter is worse than none: reopening a picker that still says
  // "port" looks like the list has lost most of its entries.
  useEffect(() => {
    if (isOpen) {
      if (showSearch) searchRef.current?.focus();
    } else {
      setQuery("");
    }
  }, [isOpen, showSearch]);

  const handlePick = (optionValue) => {
    if (multiple) {
      // Toggling, and the panel stays open. Picking five languages should be
      // five taps, not five open-pick-reopen cycles — which is what the
      // tutor profile's "languages you speak" control used to be.
      onChange(
        selectedValues.includes(optionValue)
          ? selectedValues.filter((v) => v !== optionValue)
          : [...selectedValues, optionValue]
      );
      setQuery("");
      searchRef.current?.focus();
      return;
    }
    onChange(optionValue);
    setIsOpen(false);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Typing a language and pressing Enter should pick it. With nothing
    // matched there is deliberately nothing to commit — "Other" is a
    // different decision and has to be chosen on purpose.
    const [first] = filteredOptions;
    if (first) handlePick(first.value);
  };

  /**
   * What the closed button reads.
   *
   * For a `multiple` picker there are two jobs and one rule: **a placeholder,
   * if given, always wins.** Passing one says the button is an *action* whose
   * selection is displayed elsewhere — the tutor profile shows the languages
   * you speak as removable chips right above it, so a button reading
   * "Portuguese +2" would repeat them and lose the only thing that says what
   * the control does. With no placeholder the button is the only view of the
   * selection, so it summarises instead.
   */
  const triggerLabel = () => {
    if (!multiple) return selectedOption.label;
    if (placeholder) return placeholder;
    if (selectedValues.length === 0) return otherLabel;
    const [firstValue, ...rest] = selectedValues;
    const firstLabel = options.find((o) => o.value === firstValue)?.label ?? firstValue;
    return rest.length > 0 ? `${firstLabel} +${rest.length}` : firstLabel;
  };

  const triggerFlag = multiple
    ? (placeholder ? undefined : options.find((o) => o.value === selectedValues[0])?.flagCode)
    : selectedOption.flagCode;

  const isScrollable =
    filteredOptions.length + (showOtherOption ? 1 : 0) > SCROLL_AFTER_OPTIONS;

  const baseClasses = isDarkMode
    ? "bg-slate-800 border-slate-700 text-slate-100 shadow-[4px_4px_0px_0px_#1e293b]"
    : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]";

  const rowClasses = (active) =>
    `w-full flex items-center gap-2 text-left px-4 py-2.5 font-bold uppercase text-sm tracking-tight transition-colors ${
      active
        ? isDarkMode
          ? "bg-yellow-400 text-slate-900"
          : "bg-blue-600 text-white"
        : isDarkMode
        ? "hover:bg-slate-700 text-slate-100"
        : "hover:bg-slate-100 text-slate-900"
    }`;

  return (
    <div
      className={`relative inline-block w-full sm:w-auto sm:min-w-[200px] ${className}`}
      ref={dropdownRef}
    >
      {label && (
        <label className="block font-black uppercase text-xs tracking-widest ml-1 mb-2">
          {label}
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border-4 font-bold transition-all active:scale-95 ${baseClasses}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <Icon
              size={18}
              className={isDarkMode ? "text-yellow-400" : "text-blue-600"}
            />
          )}
          {triggerFlag && (
            <LanguageFlagIcon code={triggerFlag} className="text-lg leading-none" />
          )}
          <span className="uppercase text-sm tracking-tight truncate">
            {triggerLabel()}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute z-50 mt-2 w-full rounded-xl border-4 overflow-hidden ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
          }`}
        >
          {/* Outside the scrolling region, so it stays put while the list
              moves under it. */}
          {showSearch && (
            <div
              className={`flex items-center gap-2 px-3 py-2 border-b-4 ${
                isDarkMode ? "border-slate-700" : "border-slate-900"
              }`}
            >
              <Search size={14} className="shrink-0 opacity-60" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder || t("common.search")}
                aria-label={searchPlaceholder || t("common.search")}
                className={`w-full bg-transparent outline-none font-bold text-sm ${
                  isDarkMode
                    ? "text-slate-100 placeholder-slate-500"
                    : "text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>
          )}

          <div
            role="listbox"
            aria-multiselectable={multiple || undefined}
            // Scrolling only kicks in on a long list, so a short one keeps the
            // rounded corners clipping its first and last row. overflow-x stays
            // hidden either way — the corners are the whole look of this thing.
            className={
              isScrollable
                ? `max-h-60 overflow-x-hidden overflow-y-auto neo-scrollbar ${isDarkMode ? "neo-scrollbar-dark" : ""}`
                : ""
            }
          >
            {filteredOptions.length === 0 && (
              <p
                className={`px-4 py-2.5 font-bold uppercase text-sm tracking-tight ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {t("common.no_results")}
              </p>
            )}

            {filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected(option.value)}
                onClick={() => handlePick(option.value)}
                className={rowClasses(isSelected(option.value))}
              >
                {multiple && (
                  <span
                    className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${
                      isSelected(option.value)
                        ? "border-current"
                        : isDarkMode
                        ? "border-slate-500"
                        : "border-slate-400"
                    }`}
                  >
                    {isSelected(option.value) && <Check size={10} strokeWidth={4} />}
                  </span>
                )}
                {option.flagCode && (
                  <LanguageFlagIcon code={option.flagCode} className="text-lg leading-none" />
                )}
                {option.label}
              </button>
            ))}

            {/* Deliberately exempt from the filter and always last. It is an
                action rather than an option, and the moment it matters most is
                when a search has just returned nothing — that is exactly when
                somebody needs to add the language they were looking for. */}
            {showOtherOption && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onOtherSelect?.();
                  setIsOpen(false);
                }}
                className={rowClasses(false)}
              >
                {multiple && <span className="w-4 h-4 shrink-0" />}
                {otherLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

NeoDropdown.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      flagCode: PropTypes.string,
    })
  ).isRequired,
  /** A scalar normally; an array of values when `multiple` is set. */
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.array,
  ]),
  onChange: PropTypes.func.isRequired,
  icon: PropTypes.elementType,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
  label: PropTypes.string,
  /**
   * Fixed button text for a `multiple` picker whose selection is shown
   * elsewhere. Given one, the button always reads it instead of summarising.
   */
  placeholder: PropTypes.string,
  showOtherOption: PropTypes.bool,
  otherLabel: PropTypes.string,
  onOtherSelect: PropTypes.func,
  /** Force the filter box on or off. Left unset it appears past 8 options. */
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
  /** Tick several; the panel stays open and `onChange` receives an array. */
  multiple: PropTypes.bool,
};

export default NeoDropdown;
