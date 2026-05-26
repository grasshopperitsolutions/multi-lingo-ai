import { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

/**
 * TooltipButton
 *
 * A generic wrapper that shows a tooltip above any children on hover.
 * Automatically repositions the tooltip horizontally to stay within the
 * viewport — no manual prop needed.
 *
 * @param {string}  tooltip    - Text to show in the tooltip
 * @param {boolean} isDarkMode - Theme flag
 * @param {node}    children   - The trigger element
 */
const TooltipButton = ({ tooltip, isDarkMode, children }) => {
  const tooltipRef = useRef(null);
  const wrapperRef = useRef(null);
  const [offset, setOffset] = useState(0);
  const [arrowOffset, setArrowOffset] = useState(0);

  // Recalculate position whenever the tooltip might become visible
  const recalculate = () => {
    const tip = tooltipRef.current;
    const wrapper = wrapperRef.current;
    if (!tip || !wrapper) return;

    // Temporarily make it measurable (still invisible via opacity)
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';

    const tipRect = tip.getBoundingClientRect();
    const wrapRect = wrapper.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const PADDING = 8; // min gap from screen edge

    // Default: centered on trigger
    let shift = 0;

    const tipLeft = wrapRect.left + wrapRect.width / 2 - tipRect.width / 2;
    const tipRight = tipLeft + tipRect.width;

    if (tipLeft < PADDING) {
      // Overflows left — shift right
      shift = PADDING - tipLeft;
    } else if (tipRight > viewportWidth - PADDING) {
      // Overflows right — shift left
      shift = (viewportWidth - PADDING) - tipRight;
    }

    tip.style.visibility = '';
    tip.style.display = '';

    setOffset(shift);
    // Counter-shift the arrow so it always points at the trigger center
    setArrowOffset(-shift);
  };

  useEffect(() => {
    recalculate();
    window.addEventListener('resize', recalculate);
    return () => window.removeEventListener('resize', recalculate);
  }, [tooltip]); // re-run if tooltip text changes (different length)

  const tooltipClasses = isDarkMode
    ? 'bg-slate-900 border-yellow-400 text-yellow-400'
    : 'bg-white border-slate-900 text-slate-900';

  return (
    <div ref={wrapperRef} className="relative group">
      {children}
      <div
        ref={tooltipRef}
        role="tooltip"
        style={{ transform: `translateX(calc(-50% + ${offset}px))` }}
        className={[
          'absolute bottom-[calc(100%+8px)] left-1/2',
          'px-3 py-1.5 rounded-lg border-2 text-xs font-black uppercase tracking-widest whitespace-nowrap',
          'pointer-events-none select-none z-50',
          'opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0',
          'transition-[opacity,translate] duration-150',
          tooltipClasses,
        ].join(' ')}
      >
        {tooltip}
        {isDarkMode ? (
          <span
            style={{ transform: `translateX(calc(-50% + ${arrowOffset}px))` }}
            className="absolute top-full left-1/2 border-4 border-transparent border-t-slate-900"
            aria-hidden="true"
          />
        ) : (
          <>
            <span
              style={{ transform: `translateX(calc(-50% + ${arrowOffset}px))` }}
              className="absolute top-full left-1/2 border-[5px] border-transparent border-t-slate-900"
              aria-hidden="true"
            />
            <span
              style={{ transform: `translateX(calc(-50% + ${arrowOffset}px))` }}
              className="absolute top-[calc(100%-1px)] left-1/2 border-4 border-transparent border-t-white"
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
