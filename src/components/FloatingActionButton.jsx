import PropTypes from "prop-types";
import { Loader2 } from "lucide-react";

/**
 * FloatingActionButton — a reusable fixed-position FAB.
 *
 * Props:
 *   onClick      — handler called when the button is clicked
 *   icon         — Lucide icon element to display (e.g. <Save size={20} />)
 *   label        — accessible aria-label AND optional visible label (shown when `showLabel` is true)
 *   showLabel    — when true, renders the label text next to the icon (default: false)
 *   isLoading    — when true, replaces the icon with a spinner and disables the button
 *   disabled     — disables the button
 *   isDarkMode   — toggles the neo-brutalist dark / light colour scheme
 *   position     — tailwind positioning classes (default: "bottom-6 right-6")
 *   className    — extra classes to append to the outer button
 */
const FloatingActionButton = ({
  onClick,
  icon,
  label,
  showLabel = false,
  isLoading = false,
  disabled = false,
  isDarkMode = false,
  position = "bottom-6 right-6",
  className = "",
}) => {
  const isBusy = isLoading || disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBusy}
      aria-label={label}
      className={[
        // Base layout
        "fixed z-40 flex items-center gap-2",
        // Padding — pill when label shown, square when icon-only
        showLabel ? "px-5 py-3 rounded-2xl" : "w-14 h-14 justify-center rounded-2xl",
        // Position
        position,
        // Neo-brutalist colours
        isBusy
          ? "opacity-60 cursor-not-allowed bg-slate-400 border-slate-500 text-white border-4"
          : isDarkMode
            ? "bg-yellow-400 border-slate-900 text-slate-900 border-4 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0f172a] active:scale-95 active:shadow-none transition-all"
            : "bg-yellow-400 border-slate-900 text-slate-900 border-4 shadow-[4px_4px_0px_0px_#0f172a] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0f172a] active:scale-95 active:shadow-none transition-all",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {isLoading ? (
        <Loader2 size={22} className="animate-spin" />
      ) : (
        icon
      )}
      {showLabel && !isLoading && (
        <span className="font-black uppercase tracking-widest text-sm">{label}</span>
      )}
    </button>
  );
};

FloatingActionButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  showLabel: PropTypes.bool,
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool,
  position: PropTypes.string,
  className: PropTypes.string,
};

export default FloatingActionButton;
