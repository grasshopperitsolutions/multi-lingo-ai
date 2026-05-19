import PropTypes from "prop-types";

/**
 * StatusBadge — small corner badge for feature cards.
 *
 * Usage:
 *   <StatusBadge label="In progress..." />
 *
 * To hide it when a feature is ready, simply stop passing the
 * `statusBadgeLabel` prop to FeatureCard (or set it to undefined/null).
 */
const StatusBadge = ({ label, className = "" }) => {
  return (
    <span
      className={[
        "absolute top-3 right-3 z-10 inline-flex items-center rounded-full border px-2.5 py-1",
        "text-[11px] font-bold uppercase tracking-[0.12em] shadow-sm pointer-events-none",
        "bg-amber-100 text-amber-800 border-amber-300",
        "dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-400/40",
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
  /** Optional extra Tailwind classes */
  className: PropTypes.string,
};

export default StatusBadge;
