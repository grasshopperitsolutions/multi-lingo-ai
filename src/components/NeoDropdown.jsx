import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import PropTypes from "prop-types";

const NeoDropdown = ({
  options,
  value,
  onChange,
  icon: Icon,
  isDarkMode,
  className = "",
  label = "",
  showOtherOption = false,
  otherLabel = "Other",
  onOtherSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption =
    options.find((opt) => opt.value === value) ||
    (showOtherOption ? { value: "__other__", label: otherLabel } : options[0]);

  const allOptions = showOtherOption
    ? [...options, { value: "__other__", label: otherLabel }]
    : options;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const baseClasses = isDarkMode
    ? "bg-slate-800 border-slate-700 text-slate-100 shadow-[4px_4px_0px_0px_#1e293b]"
    : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]";

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
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border-4 font-bold transition-all active:scale-95 ${baseClasses}`}
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <Icon
              size={18}
              className={isDarkMode ? "text-yellow-400" : "text-blue-600"}
            />
          )}
          <span className="uppercase text-sm tracking-tight">
            {selectedOption.label}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${
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
          {allOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                if (option.value === "__other__") {
                  onOtherSelect?.();
                } else {
                  onChange(option.value);
                }
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 font-bold uppercase text-sm tracking-tight transition-colors ${
                option.value === value
                  ? isDarkMode
                    ? "bg-yellow-400 text-slate-900"
                    : "bg-blue-600 text-white"
                  : isDarkMode
                  ? "hover:bg-slate-700 text-slate-100"
                  : "hover:bg-slate-100 text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
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
    })
  ).isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  icon: PropTypes.elementType,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
  label: PropTypes.string,
  showOtherOption: PropTypes.bool,
  otherLabel: PropTypes.string,
  onOtherSelect: PropTypes.func,
};

export default NeoDropdown;
