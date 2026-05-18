import PropTypes from "prop-types";

/**
 * NeoTooltip — neobrutalist tooltip, top-center, CSS-only hover.
 * Wrap any element with <Tooltip text="..." isDarkMode={isDarkMode}>
 *   <YourElement />
 * </Tooltip>
 */
const Tooltip = ({ text, isDarkMode, children }) => {
  if (!text) return children;

  return (
    <div className="relative group w-full">
      {children}

      {/* Tooltip bubble */}
      <div
        role="tooltip"
        className={`
          pointer-events-none
          absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2
          w-56 px-4 py-3
          rounded-xl border-4
          text-xs font-black uppercase tracking-widest text-center
          leading-snug
          z-50
          transition-all duration-150
          opacity-0 -translate-y-1
          group-hover:opacity-100 group-hover:translate-y-0
          ${
            isDarkMode
              ? "bg-slate-900 border-slate-600 text-slate-100 shadow-[4px_4px_0px_0px_#475569]"
              : "bg-slate-900 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
          }
        `}
      >
        {text}

        {/* Arrow */}
        <span
          className={`
            absolute left-1/2 -translate-x-1/2 top-full
            w-0 h-0
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[7px]
            ${
              isDarkMode ? "border-t-slate-600" : "border-t-slate-900"
            }
          `}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

Tooltip.propTypes = {
  text: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
};

Tooltip.defaultProps = {
  text: "",
};

export default Tooltip;
