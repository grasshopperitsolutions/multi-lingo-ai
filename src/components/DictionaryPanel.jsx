import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Copy, Volume2, Trash2, Search, Turtle } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { lookupWord } from '../services/dictionaryService';
import { speak } from '../services/getTtsService';
import TooltipButton from './TooltipButton';
import ReportButton from './ReportButton';
import { Breadcrumb } from './ui';

const MAX_CHARS = 1000;

// ---------------------------------------------------------------------------
// IconButton
// ---------------------------------------------------------------------------
const IconButton = ({ onClick, label, disabled, isDarkMode, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 ${
      isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
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
// SynonymChip
// ---------------------------------------------------------------------------
const SynonymChip = ({ word, isDarkMode, onClick }) => (
  <button
    onClick={() => onClick(word)}
    className={`px-3 py-1 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 ${
      isDarkMode
        ? 'bg-slate-700 border-slate-600 text-violet-300 hover:border-violet-400 hover:text-violet-200'
        : 'bg-slate-100 border-slate-300 text-violet-700 hover:border-violet-400 hover:bg-violet-50'
    }`}
  >
    {word}
  </button>
);
SynonymChip.propTypes = {
  word:       PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  onClick:    PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// DictionaryPanel
// ---------------------------------------------------------------------------
const DictionaryPanel = ({ isDarkMode, onBack, initialQuery }) => {
  const { t } = useTranslation();
  const { user, interfaceLang } = useAppContext();

  const learningLang          = user?.learningDialect ?? 'pt-PT';
  const resolvedInterfaceLang = interfaceLang ?? 'en-US';

  const [inputText,    setInputText]    = useState(initialQuery ?? '');
  const [definition,   setDefinition]   = useState('');
  const [synonyms,     setSynonyms]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [lookedUpWord, setLookedUpWord] = useState('');

  const hasResult = !isLoading && !error && definition;

  const handleClear = () => {
    setInputText('');
    setDefinition('');
    setSynonyms([]);
    setError(null);
    setLookedUpWord('');
  };

  const handleCopy = useCallback(async () => {
    if (!definition) return;
    try {
      await navigator.clipboard.writeText(definition);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch { /* clipboard API unavailable */ }
  }, [definition]);

  const handleLookup = useCallback(async (wordOverride) => {
    const word = (wordOverride ?? inputText).trim();
    if (!word) return;
    if (wordOverride) setInputText(wordOverride);
    setIsLoading(true);
    setError(null);
    setDefinition('');
    setSynonyms([]);
    setLookedUpWord(word);
    try {
      const result = await lookupWord({
        token: user?.token,
        word,
        interfaceLang: resolvedInterfaceLang,
        learningLang,
      });
      setDefinition(result.definition);
      setSynonyms(result.synonyms);
    } catch (err) {
      setError(err.message ?? t('dictionary.error_failed'));
    } finally {
      setIsLoading(false);
    }
  }, [inputText, user, resolvedInterfaceLang, learningLang, t]);

  // Auto-trigger lookup when the panel is opened with a pre-filled query
  // (e.g. when navigating here from the TranslatorPanel)
  useEffect(() => {
    const performInitialLookup = async () => {
      if (initialQuery?.trim()) {
        const word = initialQuery.trim();
        setInputText(word);
        setIsLoading(true);
        setError(null);
        setDefinition('');
        setSynonyms([]);
        setLookedUpWord(word);
        try {
          const result = await lookupWord({
            token: user?.token,
            word,
            interfaceLang: resolvedInterfaceLang,
            learningLang,
          });
          setDefinition(result.definition);
          setSynonyms(result.synonyms);
        } catch (err) {
          setError(err.message ?? t('dictionary.error_failed'));
        } finally {
          setIsLoading(false);
        }
      }
    };

    performInitialLookup();
  }, [initialQuery, learningLang, resolvedInterfaceLang, t, user?.token]);

  const panelBase = `rounded-2xl border-4 p-1 flex flex-col ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
      : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
  }`;

  const langBadgeClass = `px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg cursor-default ${
    isDarkMode ? 'bg-slate-700 text-violet-400' : 'bg-slate-100 text-violet-600'
  }`;

  const textareaBase = `w-full flex-1 resize-none bg-transparent p-3 text-base font-bold leading-relaxed focus:outline-none ${
    isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
  }`;

  const sectionLabel = `text-xs font-black uppercase tracking-widest mb-2 ${
    isDarkMode ? 'text-slate-400' : 'text-slate-500'
  }`;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="violet"
        items={[{ label: t('common.back', 'Back'), onClick: onBack }, { label: t('dashboard.dictionary', 'Dictionary') }]}
      />

      {/* Page title + report flag */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          {t('dashboard.dictionary')}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="DictionaryPanel" />
      </div>

      <div className={`h-1 w-full rounded-full ${
        isDarkMode ? 'bg-violet-500' : 'bg-violet-400'
      }`} />

      {/* Input panel */}
      <div className={panelBase}>
        <div className="flex items-center px-3 pt-2 pb-1 justify-between">
          <TooltipButton tooltip="Learning language — change in Settings" isDarkMode={isDarkMode}>
            <span className={langBadgeClass}>{learningLang}</span>
          </TooltipButton>
          <span className={`text-xs font-bold tabular-nums ${
            inputText.length > MAX_CHARS * 0.9 ? 'text-rose-500' : isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {inputText.length}/{MAX_CHARS}
          </span>
        </div>
        <textarea
          className={textareaBase}
          style={{ minHeight: '100px' }}
          placeholder={t('dictionary.input_placeholder')}
          value={inputText}
          maxLength={MAX_CHARS}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleLookup(); }}
        />
        <div className={`flex items-center gap-2 px-3 py-2 border-t-2 ${
          isDarkMode ? 'border-slate-700' : 'border-slate-100'
        }`}>
          <IconButton onClick={() => speak(inputText, learningLang)} label={t('translator.listen')} disabled={!inputText} isDarkMode={isDarkMode}><Volume2 size={16} /></IconButton>
          <IconButton onClick={() => speak(inputText, learningLang, { rate: 0.5 })} label={t('translator.listen_slow')} disabled={!inputText} isDarkMode={isDarkMode}><Turtle size={16} /></IconButton>
          <IconButton onClick={handleClear} label={t('translator.clear')} disabled={!inputText} isDarkMode={isDarkMode}><Trash2 size={16} /></IconButton>
        </div>
      </div>

      {/* Look Up button */}
      <div className="flex justify-end mt-2">
        <button
          onClick={() => handleLookup()}
          disabled={!inputText.trim() || isLoading}
          className={`flex items-center gap-1.5 px-4 sm:px-6 py-2 rounded-xl border-4 font-black uppercase tracking-widest text-xs sm:text-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
            isDarkMode
              ? 'bg-violet-500 border-violet-400 text-white shadow-[4px_4px_0px_0px_#5b21b6]'
              : 'bg-violet-500 border-violet-600 text-white shadow-[4px_4px_0px_0px_#5b21b6]'
          }`}
        >
          <Search size={14} />
          {isLoading ? t('dictionary.looking_up') : t('dictionary.look_up')}
        </button>
      </div>

      <p className={`mt-1 text-xs font-bold text-center ${
        isDarkMode ? 'text-slate-600' : 'text-slate-400'
      }`}>
        {t('dictionary.keyboard_hint')}
      </p>

      {/* Results panel */}
      {(isLoading || error || hasResult) && (
        <div className={`mt-4 rounded-2xl border-4 p-5 flex flex-col gap-5 ${
          isDarkMode
            ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
            : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
        }`}>
          {isLoading && (
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full border-4 border-t-transparent animate-spin ${
                isDarkMode ? 'border-violet-400' : 'border-violet-600'
              }`} />
              <span className={`text-sm font-black uppercase tracking-widest ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>{t('dictionary.looking_up')}</span>
            </div>
          )}
          {error && !isLoading && (
            <p className="text-sm font-bold text-rose-500">{error}</p>
          )}
          {hasResult && (
            <>
              <h3 className={`text-2xl font-black uppercase tracking-tighter ${
                isDarkMode ? 'text-violet-300' : 'text-violet-700'
              }`}>
                {lookedUpWord}
              </h3>
              <div>
                <p className={sectionLabel}>{t('dictionary.definition')}</p>
                <p className={`text-base font-bold leading-relaxed ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  {definition}
                </p>
              </div>
              {synonyms.length > 0 && (
                <div>
                  <p className={sectionLabel}>{t('dictionary.synonyms')}</p>
                  <div className="flex flex-wrap gap-2">
                    {synonyms.map((syn) => (
                      <SynonymChip key={syn} word={syn} isDarkMode={isDarkMode} onClick={handleLookup} />
                    ))}
                  </div>
                </div>
              )}
              <div className={`flex items-center gap-2 pt-2 border-t-2 ${
                isDarkMode ? 'border-slate-700' : 'border-slate-100'
              }`}>
                <IconButton onClick={() => speak(definition, resolvedInterfaceLang)} label={t('translator.listen')} disabled={!definition} isDarkMode={isDarkMode}><Volume2 size={16} /></IconButton>
                <IconButton onClick={() => speak(definition, resolvedInterfaceLang, { rate: 0.5 })} label={t('translator.listen_slow')} disabled={!definition} isDarkMode={isDarkMode}><Turtle size={16} /></IconButton>
                <IconButton onClick={handleCopy} label={copyFeedback ? t('translator.copied') : t('translator.copy')} disabled={!definition} isDarkMode={isDarkMode}><Copy size={16} /></IconButton>
                {copyFeedback && (
                  <span className={`text-xs font-black uppercase tracking-widest ${
                    isDarkMode ? 'text-violet-400' : 'text-violet-600'
                  }`}>{t('translator.copied')}</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

DictionaryPanel.propTypes = {
  isDarkMode:   PropTypes.bool.isRequired,
  onBack:       PropTypes.func.isRequired,
  initialQuery: PropTypes.string,
};

DictionaryPanel.defaultProps = {
  initialQuery: '',
};

export default DictionaryPanel;