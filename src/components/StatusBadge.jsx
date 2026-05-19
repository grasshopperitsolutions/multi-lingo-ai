import PropTypes from "prop-types";

/**
 * StatusBadge — small corner badge for feature cards.
 *
 * Mirrors the project's isDarkMode pattern (same as every other component).
 *
 * Usage:
 *   <StatusBadge label="In progress..." isDarkMode={isDarkMode} />
 *
 * To hide it when a feature is ready, simply stop passing the
 * `statusBadgeLabel` prop to FeatureCard (or set it to undefined/null).
 */
const StatusBadge = ({ label, isDarkMode, className = "" }) => {
  return (
    <span
      className={[
        "absolute top-3 right-3 z-10 inline-flex items-center rounded-full border-2 px-2.5 py-1",
        "text-[11px] font-black uppercase tracking-[0.12em] pointer-events-none",
        isDarkMode
          ? "bg-amber-500/15 text-amber-300 border-amber-400/50"
          : "bg-amber-100 text-amber-800 border-amber-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
};

StatusBadge.propTypes = {
  /** Text shown inside the badge */
  label: PropTypes.string.isRequired,
  /** Passed from parent — follows the project-wide isDarkMode pattern */
  isDarkMode: PropTypes.bool.isRequired,
  /** Optional extra Tailwind classes */
  className: PropTypes.string,
};

export default StatusBadge;
