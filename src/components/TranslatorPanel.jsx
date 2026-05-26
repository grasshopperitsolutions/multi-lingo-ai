import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowLeftRight, Copy, Volume2, Trash2, Languages, Turtle } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { translateText } from '../services/translatorService';
import { speak } from '../services/ttsService';
import TooltipButton from './TooltipButton';
import ReportButton from './ReportButton';

const MAX_CHARS = 1000;

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------
const Breadcrumb = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  return (
    <nav className="flex items-center gap-1.5 text-sm font-black uppercase tracking-widest mb-8">
      <button
        onClick={onBack}
        className={`flex items-center gap-1 transition-all hover:-translate-x-0.5 ${
          isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <ArrowLeft size={16} />
        {t('dashboard.back')}
      </button>
      <span className={`mx-1 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>/</span>
      <span className={isDarkMode ? 'text-sky-400' : 'text-sky-600'}>
        {t('dashboard.translator')}
      </span>
    </nav>
  );
};

Breadcrumb.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack:     PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// IconButton — small utility button
// ---------------------------------------------------------------------------
const IconButton = ({ onClick, label, disabled, isDarkMode, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`p-2 rounded-xl border-2 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
      isDarkMode
        ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-white hover:border-slate-400'
        : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-500'
    }`}
  >
    {children}
  </button>
);

IconButton.propTypes = {
  onClick:    PropTypes.func.isRequired,
  label:      PropTypes.string.isRequired,
  disabled:   PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  children:   PropTypes.node.isRequired,
};

// ---------------------------------------------------------------------------
// TranslatorPanel
// ---------------------------------------------------------------------------
const TranslatorPanel = ({ isDarkMode, onBack }) => {
  const { t }                        = useTranslation();
  const { user, interfaceLang }      = useAppContext();

  const defaultSource = interfaceLang        ?? 'en-US';
  const defaultTarget = user?.learningDialect ?? 'pt-PT';

  const [sourceLang,   setSourceLang]   = useState(defaultSource);
  const [targetLang,   setTargetLang]   = useState(defaultTarget);
  const [inputText,    setInputText]    = useState('');
  const [outputText,   setOutputText]   = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleSwap = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(outputText);
    setOutputText(inputText);
    setError(null);
  };

  const handleClear = () => {
    setInputText('');
    setOutputText('');
    setError(null);
  };

  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }, [outputText]);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setOutputText('');
    try {
      const { translation } = await translateText({
        token:      user?.token,
        text:       inputText,
        sourceLang,
        targetLang,
      });
      setOutputText(translation);
    } catch (err) {
      setError(err.message ?? t('translator.error_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const panelBase = `rounded-2xl border-4 p-1 flex flex-col ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
      : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
  }`;

  const langBadgeClass = `px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg cursor-default ${
    isDarkMode ? 'bg-slate-700 text-sky-400' : 'bg-slate-100 text-sky-600'
  }`;

  const textareaBase = `w-full flex-1 resize-none bg-transparent p-3 text-base font-bold leading-relaxed focus:outline-none ${
    isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
  }`;

  return (
    <div className="w-full animate-in fade-in zoom-in-95">
      <Breadcrumb isDarkMode={isDarkMode} onBack={onBack} />

      <div className={`flex items-center justify-between gap-3 mb-8 border-b-8 pb-4 ${
        isDarkMode ? 'border-sky-400' : 'border-sky-500'
      }`}>
        <div className="flex items-center gap-3">
          <Languages size={32} className={isDarkMode ? 'text-sky-400' : 'text-sky-600'} />
          <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
            {t('dashboard.translator')}
          </h2>
        </div>
        <ReportButton isDarkMode={isDarkMode} context="TranslatorPanel" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* —— Input panel —— */}
        <div className={panelBase}>
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <TooltipButton tooltip="Interface language — change in Settings" isDarkMode={isDarkMode}>
              <span className={langBadgeClass}>{sourceLang}</span>
            </TooltipButton>
            <span className={`text-xs font-bold ${
              inputText.length > MAX_CHARS * 0.9
                ? 'text-rose-500'
                : isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {inputText.length}/{MAX_CHARS}
            </span>
          </div>

          <textarea
            className={textareaBase}
            style={{ minHeight: '180px' }}
            placeholder={t('translator.input_placeholder')}
            value={inputText}
            maxLength={MAX_CHARS}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTranslate();
            }}
          />

          <div className={`flex items-center gap-2 px-3 py-2 border-t-2 ${
            isDarkMode ? 'border-slate-700' : 'border-slate-100'
          }`}>
            <IconButton onClick={() => speak(inputText, sourceLang)} label={t('translator.listen')} disabled={!inputText} isDarkMode={isDarkMode}>
              <Volume2 size={16} />
            </IconButton>
            <IconButton onClick={() => speak(inputText, sourceLang, { rate: 0.5 })} label={t('translator.listen_slow')} disabled={!inputText} isDarkMode={isDarkMode}>
              <Turtle size={16} />
            </IconButton>
            <IconButton onClick={handleClear} label={t('translator.clear')} disabled={!inputText} isDarkMode={isDarkMode}>
              <Trash2 size={16} />
            </IconButton>
          </div>
        </div>

        {/* —— Output panel —— */}
        <div className={panelBase}>
          <div className="flex items-center px-3 pt-2 pb-1">
            <TooltipButton tooltip="Learning language — change in Settings" isDarkMode={isDarkMode}>
              <span className={langBadgeClass}>{targetLang}</span>
            </TooltipButton>
          </div>

          <div
            className={`flex-1 p-3 text-base font-bold leading-relaxed ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
            style={{ minHeight: '180px' }}
          >
            {isLoading ? (
              <div className="flex items-center gap-3 h-full">
                <div className={`w-6 h-6 rounded-full border-4 border-t-transparent animate-spin ${
                  isDarkMode ? 'border-sky-400' : 'border-sky-600'
                }`} />
                <span className={`text-sm font-black uppercase tracking-widest ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>{t('translator.translating')}</span>
              </div>
            ) : error ? (
              <p className="text-sm font-bold text-rose-500">{error}</p>
            ) : outputText ? (
              <p className="whitespace-pre-wrap">{outputText}</p>
            ) : (
              <p className={`text-sm font-bold ${
                isDarkMode ? 'text-slate-600' : 'text-slate-400'
              }`}>{t('translator.output_placeholder')}</p>
            )}
          </div>

          <div className={`flex items-center gap-2 px-3 py-2 border-t-2 ${
            isDarkMode ? 'border-slate-700' : 'border-slate-100'
          }`}>
            <IconButton onClick={() => speak(outputText, targetLang)} label={t('translator.listen')} disabled={!outputText} isDarkMode={isDarkMode}>
              <Volume2 size={16} />
            </IconButton>
            <IconButton onClick={() => speak(outputText, targetLang, { rate: 0.5 })} label={t('translator.listen_slow')} disabled={!outputText} isDarkMode={isDarkMode}>
              <Turtle size={16} />
            </IconButton>
            <IconButton onClick={handleCopy} label={copyFeedback ? t('translator.copied') : t('translator.copy')} disabled={!outputText} isDarkMode={isDarkMode}>
              <Copy size={16} />
            </IconButton>
            {copyFeedback && (
              <span className={`text-xs font-black uppercase tracking-widest ${
                isDarkMode ? 'text-sky-400' : 'text-sky-600'
              }`}>{t('translator.copied')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 gap-4">
        <button
          onClick={handleSwap}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all hover:-translate-y-0.5 active:scale-95 ${
            isDarkMode
              ? 'bg-slate-800 border-slate-600 text-slate-300 shadow-[4px_4px_0px_0px_#1e293b] hover:text-white'
              : 'bg-white border-slate-900 text-slate-700 shadow-[4px_4px_0px_0px_#0f172a] hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight size={16} />
          {t('translator.swap')}
        </button>

        <button
          onClick={handleTranslate}
          disabled={!inputText.trim() || isLoading}
          className={`flex items-center gap-2 px-6 py-2 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
            isDarkMode
              ? 'bg-sky-500 border-sky-400 text-white shadow-[4px_4px_0px_0px_#0369a1]'
              : 'bg-sky-500 border-sky-600 text-white shadow-[4px_4px_0px_0px_#0369a1]'
          }`}
        >
          <Languages size={16} />
          {isLoading ? t('translator.translating') : t('translator.translate')}
        </button>
      </div>

      <p className={`mt-3 text-xs font-bold text-center ${
        isDarkMode ? 'text-slate-600' : 'text-slate-400'
      }`}>
        {t('translator.keyboard_hint')}
      </p>
    </div>
  );
};

TranslatorPanel.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack:     PropTypes.func.isRequired,
};

export default TranslatorPanel;
