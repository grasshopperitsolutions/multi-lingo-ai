import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ArrowLeftRight, Copy, Trash2, Languages, BookMarked, Volume2, Turtle, Pause, Square } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { translateText } from '../services/translatorService';
import { useTts } from '../hooks/useTts';
import TooltipButton from './TooltipButton';
import ReportButton from './ReportButton';
import { Breadcrumb } from './ui';

const MAX_CHARS = 1000;

// ---------------------------------------------------------------------------
// IconButton — small utility button wrapped in styled TooltipButton
// ---------------------------------------------------------------------------
const IconButton = ({ onClick, label, disabled, isDarkMode, children }) => (
  <TooltipButton tooltip={label} isDarkMode={isDarkMode}>
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  </TooltipButton>
);
IconButton.propTypes = {
  onClick:    PropTypes.func.isRequired,
  label:      PropTypes.string.isRequired,
  disabled:   PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  children:   PropTypes.node.isRequired,
};

// ---------------------------------------------------------------------------
// TtsControls — Play / Pause / Stop row for a single text source
// ---------------------------------------------------------------------------
const TtsControls = ({ ttsKey, text, lang, token, rate = 1, ttsState, playTts, pauseTts, stopTts, isDarkMode }) => {
  const { t } = useTranslation();
  const isActive  = ttsState.activeKey === ttsKey;
  const isPlaying = isActive && !ttsState.isPaused;
  const isPaused  = isActive && ttsState.isPaused;
  const hasText   = !!text?.trim();
  const isSlowKey = ttsState.activeKey === `${ttsKey}-slow`;

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseTts();
    } else {
      playTts({ key: ttsKey, text, lang, token, rate });
    }
  };

  const activeColor = isDarkMode
    ? 'text-sky-400 hover:text-sky-300'
    : 'text-sky-600 hover:text-sky-800';

  const idleColor = isDarkMode
    ? 'text-slate-400 hover:text-white'
    : 'text-slate-500 hover:text-slate-900';

  return (
    <div className="flex items-center gap-1">
      {/* Play (Volume2) / Pause toggle */}
      <TooltipButton
        tooltip={isPlaying ? t('translator.pause', 'Pause') : isPaused ? t('translator.resume', 'Resume') : t('translator.listen')}
        isDarkMode={isDarkMode}
      >
        <button
          onClick={handlePlayPause}
          disabled={!hasText}
          aria-label={isPlaying ? t('translator.pause', 'Pause') : t('translator.listen')}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isActive ? activeColor : idleColor
          }`}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Volume2 size={16} />}
        </button>
      </TooltipButton>

      {/* Slow play (Turtle) */}
      <TooltipButton tooltip={t('translator.listen_slow')} isDarkMode={isDarkMode}>
        <button
          onClick={() => playTts({ key: `${ttsKey}-slow`, text, lang, token, rate: 0.5 })}
          disabled={!hasText}
          aria-label={t('translator.listen_slow')}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            isSlowKey ? activeColor : idleColor
          }`}
        >
          <Turtle size={16} />
        </button>
      </TooltipButton>

      {/* Stop — only enabled while this key or its slow variant is active */}
      <TooltipButton tooltip={t('translator.stop', 'Stop')} isDarkMode={isDarkMode}>
        <button
          onClick={stopTts}
          disabled={!isActive && !isSlowKey}
          aria-label={t('translator.stop', 'Stop')}
          className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            (isActive || isSlowKey) ? 'text-rose-500 hover:text-rose-400' : idleColor
          }`}
        >
          <Square size={16} fill="currentColor" />
        </button>
      </TooltipButton>
    </div>
  );
};
TtsControls.propTypes = {
  ttsKey:     PropTypes.string.isRequired,
  text:       PropTypes.string,
  lang:       PropTypes.string.isRequired,
  token:      PropTypes.string,
  rate:       PropTypes.number,
  ttsState:   PropTypes.object.isRequired,
  playTts:    PropTypes.func.isRequired,
  pauseTts:   PropTypes.func.isRequired,
  stopTts:    PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// TranslatorPanel
// ---------------------------------------------------------------------------
const TranslatorPanel = ({ isDarkMode, onBack, onLookupInDictionary }) => {
  const { t } = useTranslation();
  const { user, interfaceLang } = useAppContext();
  const { ttsState, playTts, pauseTts, stopTts } = useTts();

  const defaultSource = interfaceLang ?? 'en-US';
  const defaultTarget = user?.learningDialect ?? 'pt-PT';

  const [sourceLang,   setSourceLang]   = useState(defaultSource);
  const [targetLang,   setTargetLang]   = useState(defaultTarget);
  const [inputText,    setInputText]    = useState('');
  const [outputText,   setOutputText]   = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleSwap = () => {
    stopTts();
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(outputText);
    setOutputText(inputText);
    setError(null);
  };

  const handleClear = () => {
    stopTts();
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
    } catch { /* clipboard API unavailable */ }
  }, [outputText]);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    stopTts();
    setIsLoading(true);
    setError(null);
    setOutputText('');
    try {
      const { translation } = await translateText({
        token: user?.token,
        text: inputText,
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

  const ttsProps = { ttsState, playTts, pauseTts, stopTts, isDarkMode, token: user?.token };

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
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="sky"
        items={[{ label: t('common.back', 'Back'), onClick: onBack }, { label: t('dashboard.translator', 'Translator') }]}
      />

      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          {t('dashboard.translator')}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="TranslatorPanel" />
      </div>

      <div className={`h-1 w-full rounded-full ${
        isDarkMode ? 'bg-sky-500' : 'bg-sky-400'
      }`} />

      {/* —— Input panel —— */}
      <div className={panelBase}>
        <div className="flex items-center px-3 pt-2 pb-1 justify-between">
          <TooltipButton tooltip="Interface language — change in Settings" isDarkMode={isDarkMode}>
            <span className={langBadgeClass}>{sourceLang}</span>
          </TooltipButton>
          <span className={`text-xs font-bold tabular-nums ${
            inputText.length > MAX_CHARS * 0.9 ? 'text-rose-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'
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
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleTranslate(); }}
        />
        <div className={`flex items-center gap-2 px-3 py-2 border-t-2 ${
          isDarkMode ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <TtsControls {...ttsProps} ttsKey="translator-input" text={inputText} lang={sourceLang} />
          <IconButton onClick={handleClear} label={t('translator.clear')} disabled={!inputText} isDarkMode={isDarkMode}><Trash2 size={16} /></IconButton>
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
          <TtsControls {...ttsProps} ttsKey="translator-output" text={outputText} lang={targetLang} />
          <IconButton onClick={handleCopy} label={copyFeedback ? t('translator.copied') : t('translator.copy')} disabled={!outputText} isDarkMode={isDarkMode}><Copy size={16} /></IconButton>
          {copyFeedback && (
            <span className={`text-xs font-black uppercase tracking-widest ${
              isDarkMode ? 'text-sky-400' : 'text-sky-600'
            }`}>{t('translator.copied')}</span>
          )}
          {outputText && (
            <TooltipButton tooltip={t('translator.lookup_in_dictionary')} isDarkMode={isDarkMode}>
              <button
                onClick={() => onLookupInDictionary(outputText)}
                aria-label={t('translator.lookup_in_dictionary')}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'text-violet-400 hover:text-violet-300'
                    : 'text-violet-600 hover:text-violet-800'
                }`}
              >
                <BookMarked size={16} />
              </button>
            </TooltipButton>
          )}
        </div>
      </div>

      {/* —— Action row —— */}
      <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
        <button
          onClick={handleSwap}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl border-4 font-black uppercase tracking-widest text-xs sm:text-sm transition-all hover:-translate-y-0.5 active:scale-95 ${
            isDarkMode
              ? 'bg-slate-800 border-slate-600 text-slate-300 shadow-[4px_4px_0px_0px_#1e293b] hover:text-white'
              : 'bg-white border-slate-900 text-slate-700 shadow-[4px_4px_0px_0px_#0f172a] hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight size={14} />
          {t('translator.swap')}
        </button>
        <button
          onClick={handleTranslate}
          disabled={!inputText.trim() || isLoading}
          className={`flex items-center gap-1.5 px-4 sm:px-6 py-2 rounded-xl border-4 font-black uppercase tracking-widest text-xs sm:text-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
            isDarkMode
              ? 'bg-sky-500 border-sky-400 text-white shadow-[4px_4px_0px_0px_#0369a1]'
              : 'bg-sky-500 border-sky-600 text-white shadow-[4px_4px_0px_0px_#0369a1]'
          }`}
        >
          <Languages size={14} />
          {isLoading ? t('translator.translating') : t('translator.translate')}
        </button>
      </div>

      <p className={`mt-1 text-xs font-bold text-center ${
        isDarkMode ? 'text-slate-600' : 'text-slate-400'
      }`}>
        {t('translator.keyboard_hint')}
      </p>
    </div>
  );
};

TranslatorPanel.propTypes = {
  isDarkMode:            PropTypes.bool.isRequired,
  onBack:                PropTypes.func.isRequired,
  onLookupInDictionary:  PropTypes.func.isRequired,
};

export default TranslatorPanel;
