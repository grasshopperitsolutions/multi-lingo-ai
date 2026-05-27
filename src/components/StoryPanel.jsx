import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, Plus, X, RefreshCw, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../contexts/AppContext';
import { fetchOrGenerateStory } from '../services/storyService';
import TTSPlayer from './TTSPlayer';
import ReportButton from './ReportButton';

const MAX_WORDS = 10;
const LEVELS    = ['beginner', 'intermediate', 'advanced'];

// ---------------------------------------------------------------------------
// Breadcrumb
// ---------------------------------------------------------------------------
const Breadcrumb = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <button
        onClick={onBack}
        className={`flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
          isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <ArrowLeft size={14} />
        <span className="hidden xs:inline">{t('dashboard.back')}</span>
      </button>
      <span className={isDarkMode ? 'text-slate-600' : 'text-slate-400'}>/</span>
      <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
        isDarkMode ? 'text-violet-400' : 'text-violet-600'
      }`}>
        Story Generator
      </span>
    </div>
  );
};
Breadcrumb.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack:     PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// WordChip
// ---------------------------------------------------------------------------
const WordChip = ({ word, onRemove, isDarkMode }) => (
  <span className={`flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full border-2 text-xs font-black uppercase tracking-widest ${
    isDarkMode
      ? 'bg-slate-700 border-slate-600 text-violet-300'
      : 'bg-slate-100 border-slate-300 text-violet-700'
  }`}>
    {word}
    <button
      onClick={() => onRemove(word)}
      aria-label={`Remove ${word}`}
      className={`rounded-full p-0.5 transition-colors ${
        isDarkMode ? 'hover:text-white hover:bg-slate-600' : 'hover:text-slate-900 hover:bg-slate-200'
      }`}
    >
      <X size={11} />
    </button>
  </span>
);
WordChip.propTypes = {
  word:       PropTypes.string.isRequired,
  onRemove:   PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// ResultWordChip (read-only, used in story result)
// ---------------------------------------------------------------------------
const ResultWordChip = ({ word, isDarkMode }) => (
  <span className={`px-3 py-1 rounded-full border-2 text-xs font-black uppercase tracking-widest ${
    isDarkMode
      ? 'bg-violet-900/40 border-violet-500 text-violet-300'
      : 'bg-violet-50 border-violet-400 text-violet-700'
  }`}>
    {word}
  </span>
);
ResultWordChip.propTypes = {
  word:       PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// LevelPicker
// ---------------------------------------------------------------------------
const LevelPicker = ({ level, onChange, isDarkMode }) => (
  <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Difficulty level">
    {LEVELS.map((l) => (
      <button
        key={l}
        onClick={() => onChange(l)}
        aria-pressed={level === l}
        className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 ${
          level === l
            ? isDarkMode
              ? 'bg-violet-500 border-violet-400 text-white shadow-[3px_3px_0px_0px_#5b21b6]'
              : 'bg-violet-500 border-violet-600 text-white shadow-[3px_3px_0px_0px_#5b21b6]'
            : isDarkMode
              ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-violet-400'
              : 'bg-white border-slate-300 text-slate-600 hover:border-violet-400'
        }`}
      >
        {l}
      </button>
    ))}
  </div>
);
LevelPicker.propTypes = {
  level:      PropTypes.string.isRequired,
  onChange:   PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// CacheIndicator — subtle badge showing if story came from pool or was AI-fresh
// ---------------------------------------------------------------------------
const CacheIndicator = ({ fromCache, isDarkMode }) => (
  <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
    fromCache
      ? isDarkMode
        ? 'border-slate-600 text-slate-500'
        : 'border-slate-300 text-slate-400'
      : isDarkMode
        ? 'border-violet-500/40 text-violet-400'
        : 'border-violet-300 text-violet-500'
  }`}>
    {fromCache ? 'From library' : 'AI generated'}
  </span>
);
CacheIndicator.propTypes = {
  fromCache:  PropTypes.bool.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// StoryPanel
// ---------------------------------------------------------------------------
const StoryPanel = ({ isDarkMode, onBack }) => {
  const { user, addSeenStoryId } = useAppContext();

  const learningLang = user?.learningDialect ?? 'pt-PT';

  const [inputWord,    setInputWord]    = useState('');
  const [wordList,     setWordList]     = useState([]);
  const [level,        setLevel]        = useState('intermediate');
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);
  const [story,        setStory]        = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // ── Word management ──
  const addWord = useCallback(() => {
    const trimmed = inputWord.trim();
    if (!trimmed) return;
    if (wordList.length >= MAX_WORDS) return;
    if (wordList.map((w) => w.toLowerCase()).includes(trimmed.toLowerCase())) {
      setInputWord('');
      return;
    }
    setWordList((prev) => [...prev, trimmed]);
    setInputWord('');
  }, [inputWord, wordList]);

  const removeWord = useCallback((word) => {
    setWordList((prev) => prev.filter((w) => w !== word));
  }, []);

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addWord(); }
  };

  // ── Generate / Fetch ──
  const handleGenerate = useCallback(async () => {
    if (!wordList.length || isLoading) return;
    setIsLoading(true);
    setError(null);
    setStory(null);
    try {
      const result = await fetchOrGenerateStory({
        token:        user?.token,
        uid:          user?.uid,
        words:        wordList,
        learningLang,
        level,
        seenStoryIds: user?.seenStoryIds ?? [],
        onSeenUpdate: addSeenStoryId,
      });
      setStory(result);
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [wordList, isLoading, user, learningLang, level, addSeenStoryId]);

  // ── Copy story text ──
  const handleCopy = useCallback(async () => {
    if (!story?.storyText) return;
    try {
      await navigator.clipboard.writeText(story.storyText);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, [story]);

  // ── Shared class helpers ──
  const panelClass = `rounded-2xl border-4 p-4 sm:p-5 ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
      : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
  }`;

  const labelClass = `text-xs font-black uppercase tracking-widest mb-2 ${
    isDarkMode ? 'text-slate-400' : 'text-slate-500'
  }`;

  const inputClass = `flex-1 min-w-0 bg-transparent text-sm font-bold focus:outline-none ${
    isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
  }`;

  const dividerClass = `h-px w-full my-1 ${
    isDarkMode ? 'bg-slate-700' : 'bg-slate-100'
  }`;

  const atLimit = wordList.length >= MAX_WORDS;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb isDarkMode={isDarkMode} onBack={onBack} />

      {/* Page title */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          Story Generator
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="StoryPanel" />
      </div>

      <div className={`h-1 w-full rounded-full ${
        isDarkMode ? 'bg-violet-500' : 'bg-violet-400'
      }`} />

      {/* ── Input panel ── */}
      <div className={panelClass}>

        {/* Word input row */}
        <p className={labelClass}>Vocabulary words ({wordList.length}/{MAX_WORDS})</p>
        <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
          isDarkMode ? 'border-slate-600 bg-slate-700/50' : 'border-slate-300 bg-slate-50'
        }`}>
          <input
            type="text"
            value={inputWord}
            onChange={(e) => setInputWord(e.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={atLimit}
            placeholder={atLimit ? 'Max words reached' : 'Type a word…'}
            aria-label="Add vocabulary word"
            className={inputClass}
          />
          <button
            onClick={addWord}
            disabled={!inputWord.trim() || atLimit}
            aria-label="Add word"
            title={atLimit ? `Maximum ${MAX_WORDS} words` : 'Add word'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border-2 text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
              isDarkMode
                ? 'bg-violet-500 border-violet-400 text-white'
                : 'bg-violet-500 border-violet-600 text-white'
            }`}
          >
            <Plus size={12} />
            Add
          </button>
        </div>

        {/* Word chips */}
        {wordList.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {wordList.map((w) => (
              <WordChip key={w} word={w} onRemove={removeWord} isDarkMode={isDarkMode} />
            ))}
          </div>
        )}

        <div className={`${dividerClass} mt-4`} />

        {/* Level picker */}
        <p className={`${labelClass} mt-3`}>Difficulty</p>
        <LevelPicker level={level} onChange={setLevel} isDarkMode={isDarkMode} />
      </div>

      {/* ── Generate button ── */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={!wordList.length || isLoading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-4 font-black uppercase tracking-widest text-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
            isDarkMode
              ? 'bg-violet-500 border-violet-400 text-white shadow-[4px_4px_0px_0px_#5b21b6]'
              : 'bg-violet-500 border-violet-600 text-white shadow-[4px_4px_0px_0px_#5b21b6]'
          }`}
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              {story ? 'Next Story' : 'Generate Story'}
            </>
          )}
        </button>
      </div>

      {/* ── Inline error ── */}
      {error && !isLoading && (
        <p className="text-sm font-bold text-rose-500">{error}</p>
      )}

      {/* ── Story result card ── */}
      {story && !isLoading && (
        <div className={`rounded-2xl border-4 p-4 sm:p-6 flex flex-col gap-5 ${
          isDarkMode
            ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
            : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
        }`}>

          {/* Header row: words used + cache indicator */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            {story.wordsUsed.length > 0 && (
              <div className="flex-1">
                <p className={labelClass}>Words used</p>
                <div className="flex flex-wrap gap-2">
                  {story.wordsUsed.map((w) => (
                    <ResultWordChip key={w} word={w} isDarkMode={isDarkMode} />
                  ))}
                </div>
              </div>
            )}
            <CacheIndicator fromCache={story.fromCache} isDarkMode={isDarkMode} />
          </div>

          <div className={dividerClass} />

          {/* Story text */}
          <p className={`text-base sm:text-lg font-bold leading-relaxed ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            {story.storyText}
          </p>

          {/* TTS player */}
          <TTSPlayer text={story.storyText} lang={learningLang} isDarkMode={isDarkMode} />

          <div className={dividerClass} />

          {/* Action row: copy */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCopy}
              aria-label={copyFeedback ? 'Copied' : 'Copy story'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 ${
                isDarkMode
                  ? 'bg-slate-700 border-slate-600 text-slate-300 shadow-[3px_3px_0px_0px_#0f172a]'
                  : 'bg-slate-100 border-slate-300 text-slate-700 shadow-[3px_3px_0px_0px_#cbd5e1]'
              }`}
            >
              {copyFeedback ? <Check size={12} /> : <Copy size={12} />}
              {copyFeedback ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

StoryPanel.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack:     PropTypes.func.isRequired,
};

export default StoryPanel;
