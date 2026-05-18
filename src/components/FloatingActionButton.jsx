import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";

/**
 * FloatingActionButton — a reusable fixed-position circular FAB.
 *
 * Shows only the icon. The `label` becomes a tooltip that appears
 * on hover (above the button by default).
 *
 * Props:
 *   onClick      — handler called when the button is clicked
 *   icon         — Lucide icon element to display (e.g. <Save size={22} />)
 *   label        — accessible aria-label AND tooltip text
 *   isLoading    — when true, replaces the icon with a spinner and disables the button
 *   disabled     — disables the button
 *   isDarkMode   — toggles the neo-brutalist dark / light colour scheme
 *   position     — tailwind positioning classes (default: "bottom-6 right-6")
 *   className    — extra classes to append to the outer wrapper
 */
const FloatingActionButton = ({
  onClick,
  icon,
  label,
  isLoading = false,
  disabled = false,
  isDarkMode = false,
  position = "bottom-6 right-6",
  className = "",
}) => {
  const isBusy = isLoading || disabled;

  return (
    <div
      className={["fixed z-40 group", position, className].filter(Boolean).join(" ")}
    >
      {/* Tooltip */}
      <div
        role="tooltip"
        className={[
          "absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2",
          "px-3 py-1.5 rounded-lg border-2 text-xs font-black uppercase tracking-widest whitespace-nowrap",
          "pointer-events-none select-none",
          "opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0",
          "transition-all duration-150",
          isDarkMode
            ? "bg-slate-900 border-yellow-400 text-yellow-400"
            : "bg-slate-900 border-yellow-400 text-yellow-400",
        ].join(" ")}
      >
        {label}
        {/* Arrow */}
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"
          aria-hidden="true"
        />
      </div>

      {/* Button */}
      <button
        type="button"
        onClick={onClick}
        disabled={isBusy}
        aria-label={label}
        className={[
          "w-14 h-14 rounded-full flex items-center justify-center border-4 transition-all",
          isBusy
            ? "opacity-60 cursor-not-allowed bg-slate-400 border-slate-500 text-white"
            : [
                "bg-yellow-400 border-slate-900 text-slate-900",
                "shadow-[4px_4px_0px_0px_#0f172a]",
                "hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0f172a]",
                "active:scale-95 active:shadow-none",
              ].join(" "),
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isLoading ? <Loader2 size={22} className="animate-spin" /> : icon}
      </button>
    </div>
  );
};

FloatingActionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool,
  position: PropTypes.string,
  className: PropTypes.string,
};

export default FloatingActionButton;
