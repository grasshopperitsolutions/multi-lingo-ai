import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Flag, X, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { openWhatsAppReport } from '../services/reportService';
import NeoDropdown from './NeoDropdown';

/**
 * ReportModal — lets the user pick a category, write a description,
 * and send a pre-filled WhatsApp message.
 *
 * Props:
 *   isDarkMode  boolean
 *   context     string | undefined  — optional label passed from the parent (e.g. 'HangmanGame')
 *   onClose     () => void
 */

const CATEGORIES = [
  'Bug / Error',
  'Wrong translation',
  'Inappropriate content',
  'Missing word / language',
  'Other',
];

const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c, label: c }));

const ReportModal = ({ isDarkMode, context, onClose }) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = message.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setIsLoading(true);

    // Small delay so the user sees the loading state before the tab opens
    setTimeout(() => {
      openWhatsAppReport({ category, message, context });
      setIsLoading(false);
      setSubmitted(true);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Panel */}
      <div
        className={`relative z-10 w-full max-w-md p-8 rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#f59e0b] ${
          isDarkMode
            ? 'bg-slate-800 border-yellow-400'
            : 'bg-white border-yellow-400'
        }`}
      >
        {/* Close */}
        <button
          onClick={onClose}
          disabled={isLoading}
          aria-label={t('common.close')}
          className={`absolute top-5 right-5 p-1 rounded-lg transition-colors disabled:opacity-40 ${
            isDarkMode
              ? 'text-slate-400 hover:text-white'
              : 'text-slate-400 hover:text-slate-900'
          }`}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl border-4 border-slate-900 flex items-center justify-center shrink-0 bg-yellow-400">
            <Flag size={22} className="text-slate-900" />
          </div>
          <h2
            id="report-modal-title"
            className={`text-xl font-black uppercase tracking-tight ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            {t('report.title', 'Report an issue')}
          </h2>
        </div>

        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2
              size={48}
              className={isDarkMode ? 'text-yellow-400' : 'text-yellow-500'}
            />
            <p
              className={`font-black text-lg uppercase tracking-tight ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {t('report.successTitle', 'Thank you!')}
            </p>
            <p
              className={`font-semibold text-sm ${
                isDarkMode ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              {t(
                'report.successMessage',
                'WhatsApp opened with your report. Please press Send to submit it.'
              )}
            </p>
            <button
              onClick={onClose}
              className={`mt-2 w-full py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 shadow-[4px_4px_0px_0px_#0f172a] ${
                isDarkMode
                  ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                  : 'bg-white border-slate-900 text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            {/* Category dropdown */}
            <NeoDropdown
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
              isDarkMode={isDarkMode}
              label={t('report.category', 'Category')}
              className="mb-5"
            />

            {/* Message textarea */}
            <label
              htmlFor="report-message"
              className={`block text-xs font-black uppercase tracking-widest mb-2 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {t('report.description', 'Description')}
            </label>
            <div className="relative mb-6">
              <MessageSquare
                size={16}
                className={`absolute top-3 left-3 ${
                  isDarkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
              <textarea
                id="report-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t(
                  'report.placeholder',
                  'Describe the issue in a few words…'
                )}
                className={`w-full pl-9 pr-4 py-3 rounded-xl border-2 font-semibold text-sm resize-none outline-none transition-colors ${
                  isDarkMode
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-yellow-400'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-yellow-400'
                }`}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isLoading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-yellow-400 hover:bg-yellow-300 border-yellow-400 hover:border-yellow-300 shadow-[4px_4px_0px_0px_#854d0e] text-slate-900"
              >
                {isLoading ? (
                  <><Loader2 size={18} className="animate-spin" /> {t('common.loading', 'Loading…')}</>
                ) : (
                  t('report.send', 'Send via WhatsApp')
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 shadow-[4px_4px_0px_0px_#0f172a] disabled:opacity-60 ${
                  isDarkMode
                    ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600'
                    : 'bg-white border-slate-900 text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

ReportModal.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  context:    PropTypes.string,
  onClose:    PropTypes.func.isRequired,
};

export default ReportModal;
