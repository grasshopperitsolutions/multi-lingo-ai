import { useState } from 'react';
import PropTypes from 'prop-types';
import { Flag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReportModal from './ReportModal';

/**
 * ReportButton — a small, composable flag button that opens the ReportModal.
 * Drop it anywhere in the app.
 *
 * Props:
 *   isDarkMode  boolean
 *   context     string | undefined  — forwarded to reportService for context metadata
 *                                    e.g. 'HangmanGame', 'TranslatorPanel', etc.
 *   className   string | undefined  — extra Tailwind classes for positioning
 *   size        'sm' | 'md'         — button size variant (default: 'sm')
 *
 * Basic usage:
 *   <ReportButton isDarkMode={isDarkMode} context="HangmanGame" />
 *
 * Positioned in a card corner:
 *   <div className="relative">
 *     ...
 *     <ReportButton isDarkMode={isDarkMode} context="WordCard" className="absolute top-2 right-2" />
 *   </div>
 */
const ReportButton = ({ isDarkMode, context, className = '', size = 'sm' }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const iconSize  = size === 'sm' ? 14 : 18;
  const btnSize   = size === 'sm'
    ? 'p-1.5 rounded-lg'
    : 'px-3 py-2 rounded-xl gap-2';
  const textLabel = size === 'md'
    ? <span className="text-xs font-bold uppercase tracking-wide">{t('report.buttonLabel', 'Report')}</span>
    : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label={t('report.buttonAriaLabel', 'Report an issue')}
        title={t('report.buttonAriaLabel', 'Report an issue')}
        className={`inline-flex items-center transition-colors ${
          isDarkMode
            ? 'text-slate-500 hover:text-yellow-400'
            : 'text-slate-400 hover:text-yellow-500'
        } ${btnSize} ${className}`}
      >
        <Flag size={iconSize} />
        {textLabel}
      </button>

      {isOpen && (
        <ReportModal
          isDarkMode={isDarkMode}
          context={context}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

ReportButton.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  context:    PropTypes.string,
  className:  PropTypes.string,
  size:       PropTypes.oneOf(['sm', 'md']),
};

export default ReportButton;
