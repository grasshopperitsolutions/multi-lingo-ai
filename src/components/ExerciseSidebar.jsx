/**
 * ExerciseSidebar.jsx
 *
 * Collapsible sidebar for exam exercise pages (Reading, Listening, Writing).
 * Contains: level selector, exercise type selector (when applicable),
 * generate button, timer, and optionally the TTS player (listening).
 *
 * Responsive behavior:
 *   - Mobile: starts collapsed (icon strip), toggle to expand full panel
 *   - Desktop (lg+): always expanded, can still be collapsed by user
 *
 * Props:
 *   exerciseType     "reading" | "listening" | "writing"
 *   level            string        — current CEFR level value
 *   onLevelChange    (level) => void
 *   questionType     string        — selected subtype or 'random'
 *   onQuestionTypeChange (type) => void
 *   onGenerate       () => void    — called when user clicks generate
 *   loading          boolean       — disable generate button
 *   isDarkMode       boolean
 *   // Listening-only props (optional)
 *   transcript       string
 *   tone             string
 *   lang             string
 *   showTranscript   boolean
 *   onToggleTranscript () => void
 *   timerRef         ref
 */

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ChevronRight, PanelLeftClose, PanelLeft } from 'lucide-react';
import NeoDropdown from './NeoDropdown';
import ExamTimer from './ExamTimer';
import TTSPlayer from './TTSPlayer';

// ---------------------------------------------------------------------------
// Exercise type options
// ---------------------------------------------------------------------------

const READING_TYPES = [
  { value: 'random', label: 'Random' },
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True / False' },
  { value: 'best-title', label: 'Best Title' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'cloze', label: 'Cloze' },
  { value: 'fill-blanks', label: 'Fill Blanks' },
  { value: 'matching', label: 'Matching' },
  { value: 'notice-sign', label: 'Notice / Sign' },
];

const LISTENING_TYPES = [
  { value: 'random', label: 'Random' },
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'true-false', label: 'True / False' },
  { value: 'fill-blanks', label: 'Fill Blanks' },
];

const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 - Iniciante' },
  { value: 'A2', label: 'A2 - Elementar' },
  { value: 'B1', label: 'B1 - Intermédio' },
  { value: 'B2', label: 'B2 - Independente' },
  { value: 'C1', label: 'C1 - Avançado' },
  { value: 'C2', label: 'C2 - Proficiente' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExerciseSidebar = ({
  exerciseType,
  level,
  onLevelChange,
  questionType,
  onQuestionTypeChange,
  onGenerate,
  loading,
  isDarkMode,
  transcript,
  tone,
  lang,
  showTranscript,
  onToggleTranscript,
  timerRef,
}) => {
  const { t } = useTranslation();
  // Default-collapsed on mobile, expanded on desktop
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024; // Tailwind lg breakpoint
  });

  // Keep collapsed state sensible on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const typeOptions =
    exerciseType === 'listening'
      ? LISTENING_TYPES
      : exerciseType === 'reading'
        ? READING_TYPES
        : [];

  const panelBase = `rounded-2xl border-4 ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700'
      : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'
  }`;

  const labelClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // ── Collapsed sidebar (icon strip) ───────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="flex flex-col items-center gap-2 w-12 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${isDarkMode ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
          aria-label="Expand sidebar"
        >
          <PanelLeft size={16} />
        </button>
        {/* Mini level badge */}
        <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-xs font-black ${isDarkMode ? 'border-sky-600 text-sky-400 bg-slate-800' : 'border-sky-500 text-sky-600 bg-white'}`}>
          {level}
        </div>
      </aside>
    );
  }

  // ── Expanded sidebar ─────────────────────────────────────────────────────
  return (
    <aside className="flex flex-col gap-4 w-64 shrink-0">
      {/* Header */}
      <div className={`${panelBase} p-4 flex items-center justify-between`}>
        <span className={`font-black uppercase text-xs tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          {t('exam.sidebar.settings', 'Settings')}
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className={`p-1 rounded-lg transition-all ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Controls */}
      <div className={`${panelBase} p-4 flex flex-col gap-4`}>
        {/* Level */}
        <NeoDropdown
          options={CEFR_LEVELS}
          value={level}
          onChange={onLevelChange}
          isDarkMode={isDarkMode}
          label={t('exam.sidebar.level', 'Level')}
        />

        {/* Exercise type (only for reading/listening) */}
        {exerciseType !== 'writing' && typeOptions.length > 0 && (
          <NeoDropdown
            options={typeOptions}
            value={questionType}
            onChange={onQuestionTypeChange}
            isDarkMode={isDarkMode}
            label={t('exam.sidebar.type', 'Type')}
          />
        )}

        {/* Generate button */}
        <button
          onClick={onGenerate}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-4 font-black text-sm uppercase tracking-wide transition-all active:scale-[0.98] ${
            loading
              ? 'opacity-50 cursor-not-allowed'
              : ''
          } ${isDarkMode
            ? 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600 shadow-[4px_4px_0px_0px_#1e293b]'
            : 'bg-emerald-400 border-slate-900 text-slate-900 hover:bg-emerald-300 shadow-[4px_4px_0px_0px_#0f172a]'
          }`}
        >
          {t('exam.sidebar.generate', 'Generate')} <ChevronRight size={16} />
        </button>
      </div>

      {/* Timer */}
      <div className={`${panelBase} p-4`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-3 ${labelClass}`}>{t('exam.timer', 'Timer')}</p>
        <ExamTimer ref={timerRef} isDarkMode={isDarkMode} />
      </div>

      {/* TTS + Transcript (listening only) */}
      {exerciseType === 'listening' && transcript && (
        <div className={`${panelBase} p-4 flex flex-col gap-3`}>
          <p className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>{t('exam.audio', 'Audio')}</p>
          <TTSPlayer text={transcript} lang={lang} isDarkMode={isDarkMode} />
          {tone && (
            <p className={`text-xs font-semibold italic ${labelClass}`}>
              {tone}
            </p>
          )}
          <button
            onClick={onToggleTranscript}
            className={`text-xs font-black uppercase tracking-widest transition-all hover:underline ${labelClass}`}
          >
            {showTranscript ? t('exam.hide_transcript', 'Hide Transcript') : t('exam.show_transcript', 'Show Transcript')}
          </button>
          {showTranscript && (
            <div className={`p-3 rounded-xl border-2 text-sm leading-relaxed font-medium ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'}`}>
              {transcript}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

ExerciseSidebar.propTypes = {
  exerciseType: PropTypes.oneOf(['reading', 'listening', 'writing']).isRequired,
  level: PropTypes.string.isRequired,
  onLevelChange: PropTypes.func.isRequired,
  questionType: PropTypes.string,
  onQuestionTypeChange: PropTypes.func,
  onGenerate: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  transcript: PropTypes.string,
  tone: PropTypes.string,
  lang: PropTypes.string,
  showTranscript: PropTypes.bool,
  onToggleTranscript: PropTypes.func,
  timerRef: PropTypes.shape({ current: PropTypes.object }),
};

ExerciseSidebar.defaultProps = {
  questionType: 'random',
  onQuestionTypeChange: () => {},
  transcript: '',
  tone: '',
  lang: 'pt-PT',
  showTranscript: false,
  onToggleTranscript: () => {},
  timerRef: { current: null },
};

export default ExerciseSidebar;