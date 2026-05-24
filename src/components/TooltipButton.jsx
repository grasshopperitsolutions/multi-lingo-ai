import PropTypes from 'prop-types';

/**
 * TooltipButton
 *
 * A generic wrapper that shows a tooltip above any children on hover.
 * Used in DashboardPage header actions and TranslatorPanel language badges.
 *
 * @param {string}  tooltip    - Text to show in the tooltip
 * @param {boolean} isDarkMode - Theme flag
 * @param {node}    children   - The trigger element
 */
const TooltipButton = ({ tooltip, isDarkMode, children }) => {
  const tooltipClasses = isDarkMode
    ? 'bg-slate-900 border-yellow-400 text-yellow-400'
    : 'bg-white border-slate-900 text-slate-900';

  return (
    <div className="relative group">
      {children}
      <div
        role="tooltip"
        className={[
          'absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
          'px-3 py-1.5 rounded-lg border-2 text-xs font-black uppercase tracking-widest whitespace-nowrap',
          'pointer-events-none select-none z-50',
          'opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0',
          'transition-all duration-150',
          tooltipClasses,
        ].join(' ')}
      >
        {tooltip}
        {isDarkMode ? (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"
            aria-hidden="true"
          />
        ) : (
          <>
            <span
              className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900"
              aria-hidden="true"
            />
            <span
              className="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white"
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </div>
  );
};

TooltipButton.propTypes = {
  tooltip:    PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  children:   PropTypes.node.isRequired,
};

export default TooltipButton;
