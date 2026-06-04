import { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';

/**
 * CollapsibleCard.jsx
 *
 * A reusable card with a clickable header that toggles the body open/closed.
 * Manages its own open/closed state internally (uncontrolled).
 *
 * Usage:
 *   <CollapsibleCard title="Your Task" isDarkMode={isDarkMode} defaultOpen={false}>
 *     <p>Some content here</p>
 *   </CollapsibleCard>
 */
const CollapsibleCard = ({ title, isDarkMode, defaultOpen = false, children, className = '' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl border-4 overflow-hidden transition-all ${
        isDarkMode
          ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
          : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
      } ${className}`}
    >
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 text-left transition-colors ${
          isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
        }`}
        aria-expanded={isOpen}
      >
        <span
          className={`text-xs font-black uppercase tracking-widest ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''} ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className={`px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t-2 ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

CollapsibleCard.propTypes = {
  title: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
};

CollapsibleCard.defaultProps = {
  defaultOpen: false,
  className: '',
};

export default CollapsibleCard;
