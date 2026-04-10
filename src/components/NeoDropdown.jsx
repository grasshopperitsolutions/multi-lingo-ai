import React, { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

const NeoDropdown = ({
  options,
  value,
  onChange,
  icon: Icon,
  isDarkMode,
  className = "",
  label = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption =
    options.find((opt) => opt.value === value) || options[0];

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
      className={`relative inline-block w-full sm:w-auto ${className}`}
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
          size={18}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 mt-2 z-[60] p-2 rounded-xl border-4 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${baseClasses} shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-lg font-bold text-sm uppercase transition-colors
                ${
                  value === option.value
                    ? isDarkMode
                      ? "bg-yellow-400 text-slate-900"
                      : "bg-blue-600 text-white"
                    : isDarkMode
                      ? "hover:bg-slate-700"
                      : "hover:bg-slate-100"
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

export default NeoDropdown;