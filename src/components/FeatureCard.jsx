import PropTypes from "prop-types";
import Tooltip from "./Tooltip";
import StatusBadge from "./StatusBadge";

import { Lock } from "lucide-react";

/**
 * FeatureCard
 *
 * Accepts optional `statusBadgeLabel` and `disabled` props.
 * Pass a string (e.g. "In progress...") to show the corner badge.
 * Omit or set to undefined/null to hide it once the feature is ready.
 * Pass `disabled: true` to grey out the card and show a lock overlay.
 */
const FeatureCard = ({ icon: Icon, title, description, delay, color, isDarkMode, onClick, statusBadgeLabel, disabled }) => {
  return (
    <Tooltip text={disabled ? "" : description} isDarkMode={isDarkMode}>
      <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`relative p-6 rounded-2xl border-4 transition-all duration-200 wiggle-hover flex flex-col items-center text-center w-full min-h-[200px] ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer"
        } ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 neo-shadow-dark text-slate-100 hover:-translate-y-1 active:scale-95"
            : "bg-white border-slate-900 neo-shadow-light text-slate-900 hover:-translate-y-1 active:scale-95"
        }`}
        style={{ animationDelay: delay }}
      >
        {(statusBadgeLabel || disabled) && (
          <StatusBadge
            label={disabled ? "" : statusBadgeLabel}
            isDarkMode={isDarkMode}
          />
        )}
        {disabled && (
          <div className="absolute top-3 right-3 z-10">
            <Lock size={16} className={isDarkMode ? "text-slate-500" : "text-slate-400"} />
          </div>
        )}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 border-2 border-current shadow-[4px_4px_0px_0px_currentColor] float-1 ${color}`}
        >
          <Icon className="w-8 h-8" />
        </div>
        <h3 className="font-extrabold text-xl uppercase">{title}</h3>
      </button>
    </Tooltip>
  );
};

FeatureCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  delay: PropTypes.string,
  color: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  onClick: PropTypes.func,
  /** Pass a string to show the corner StatusBadge. Omit to hide it. */
  statusBadgeLabel: PropTypes.string,
  /** When true, greys out the card and shows a lock icon */
  disabled: PropTypes.bool,
};

FeatureCard.defaultProps = {
  description: "",
  onClick: undefined,
  delay: undefined,
  statusBadgeLabel: undefined,
  disabled: false,
};

export default FeatureCard;
