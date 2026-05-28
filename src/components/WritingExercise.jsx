/**
 * WritingExercise.jsx
 *
 * Full writing exercise flow for the Exam Training feature.
 *
 * State machine:
 *   'setup'   -> user selects CEFR level and requests an exercise
 *   'writing' -> user reads the prompt, writes text, and submits for evaluation
 *   'results' -> user sees score breakdown and feedback
 *
 * Props:
 *   isDarkMode {bool}  - theme flag
 *   onBack     {func}  - navigates back to ExamTrainingMenu
 */

import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BarChart2, PenLine, RotateCcw, Wand2, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import NeoDropdown from './NeoDropdown';
import Loader from './Loader';
import ExamTimer from './ExamTimer';
import StatusBadge from './StatusBadge';
import ReportButton from './ReportButton';
import { generateWritingPrompt, evaluateWriting } from '../services/examTrainingService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// TODO: When multi-language support is added, replace this with the user's
//       selected learning language from context.
// const LEARNING_LANGUAGE = 'pt-PT';

const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 — Iniciante' },
  { value: 'A2', label: 'A2 — Elementar' },
  { value: 'B1', label: 'B1 — Intermédio' },
  { value: 'B2', label: 'B2 — Independente' },
  { value: 'C1', label: 'C1 — Avançado' },
  { value: 'C2', label: 'C2 — Proficiente' },
];

/** Score colour coding */
function getScoreColor(score, max, isDarkMode) {
  const pct = score / max;
  if (pct >= 0.8) return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
  if (pct >= 0.5) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
  return isDarkMode ? 'text-rose-400' : 'text-rose-600';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Section heading */
const SectionHeading = ({ children, isDarkMode }) => (
  <h2 className={`text-xs font-black uppercase tracking-widest mb-3 ${
    isDarkMode ? 'text-slate-400' : 'text-slate-500'
  }`}>
    {children}
  </h2>
);
SectionHeading.propTypes = { children: PropTypes.node.isRequired, isDarkMode: PropTypes.bool.isRequired };

/** Card wrapper */
const Card = ({ children, isDarkMode, className = '' }) => (
  <div className={`rounded-2xl border-4 p-4 sm:p-5 ${
    isDarkMode
      ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
      : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
  } ${className}`}>
    {children}
  </div>
);
Card.propTypes = { children: PropTypes.node.isRequired, isDarkMode: PropTypes.bool.isRequired, className: PropTypes.string };
Card.defaultProps = { className: '' };

/** Primary action button */
const PrimaryButton = ({ children, onClick, disabled, isDarkMode, loading = false, className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase
      tracking-widest text-sm transition-all active:scale-95 select-none
      ${ disabled || loading
        ? 'opacity-50 cursor-not-allowed'
        : 'hover:-translate-y-0.5'
      }
      ${ isDarkMode
        ? 'bg-teal-500 border-teal-400 text-slate-900 shadow-[4px_4px_0px_0px_#0f766e] hover:bg-teal-400'
        : 'bg-teal-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-teal-700'
      } ${className}`}
  >
    {children}
  </button>
);
PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick:  PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  loading:  PropTypes.bool,
  className: PropTypes.string,
};
PrimaryButton.defaultProps = { disabled: false, loading: false, className: '' };

/** Ghost / secondary button */
const GhostButton = ({ children, onClick, disabled, isDarkMode, className = '' }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase
      tracking-widest text-sm transition-all active:scale-95 select-none
      ${ disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5' }
      ${ isDarkMode
        ? 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700'
        : 'bg-transparent border-slate-900 text-slate-700 hover:bg-slate-100'
      } ${className}`}
  >
    {children}
  </button>
);
GhostButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick:  PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};
GhostButton.defaultProps = { disabled: false, className: '' };

// ---------------------------------------------------------------------------
// Error banner (declared outside of component to avoid recreation on render)
// ---------------------------------------------------------------------------
const ErrorBanner = ({ error, isDarkMode }) => error ? (
  <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
    isDarkMode
      ? 'bg-rose-900/30 border-rose-700 text-rose-300'
      : 'bg-rose-50 border-rose-300 text-rose-700'
  }`}>
    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
    <p className="text-sm font-semibold">{error}</p>
  </div>
) : null;
ErrorBanner.propTypes = {
  error: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
};
ErrorBanner.defaultProps = { error: null };

// ---------------------------------------------------------------------------
// Parameter row in results
// ---------------------------------------------------------------------------
const ParameterRow = ({ param, isDarkMode }) => {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = getScoreColor(param.score, param.maxScore, isDarkMode);

  return (
    <button
      onClick={() => setExpanded((p) => !p)}
      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
        isDarkMode
          ? 'border-slate-700 hover:bg-slate-700/50'
          : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Parameter label */}
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center
            font-black text-xs ${
              isDarkMode ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-slate-100 text-slate-900'
            }`}
          >
            {param.id}
          </span>
          <span className={`font-bold text-sm truncate ${
            isDarkMode ? 'text-slate-200' : 'text-slate-800'
          }`}>
            {param.name}
          </span>
        </div>

        {/* Score badge + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-black text-sm tabular-nums ${scoreColor}`}>
            {param.score}<span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>/{param.maxScore}</span>
          </span>
          <ChevronRight
            size={14}
            className={`transition-transform ${
              expanded ? 'rotate-90' : ''
            } ${ isDarkMode ? 'text-slate-500' : 'text-slate-400' }`}
          />
        </div>
      </div>

      {/* Expanded feedback */}
      {expanded && (
        <p className={`mt-2 text-sm leading-relaxed ${
          isDarkMode ? 'text-slate-300' : 'text-slate-600'
        }`}>
          {param.feedback}
        </p>
      )}
    </button>
  );
};
ParameterRow.propTypes = {
  param: PropTypes.shape({
    id:       PropTypes.string.isRequired,
    name:     PropTypes.string.isRequired,
    score:    PropTypes.number.isRequired,
    maxScore: PropTypes.number.isRequired,
    feedback: PropTypes.string.isRequired,
  }).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const WritingExercise = ({ isDarkMode }) => {
  const { t }      = useTranslation();
  const { user }   = useAppContext();

  // ── State ───────────────────────────────────────────────────────────────
  const [step, setStep]           = useState('setup'); // 'setup' | 'writing' | 'results'
  const [level, setLevel]         = useState('A1');
  const [exercise, setExercise]   = useState(null);    // { prompt, instructions[], minWords, maxWords }
  const [userText, setUserText]   = useState('');
  const [evaluation, setEval]     = useState(null);    // EvaluateWritingResult
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const timerRef                  = useRef(null);

  // Live word count
  const wordCount = userText.trim() ? userText.trim().split(/\s+/).filter(Boolean).length : 0;
  const minWords  = exercise?.minWords ?? 60;
  const maxWords  = exercise?.maxWords ?? 100;

  const wordCountColor = () => {
    if (wordCount === 0)                           return isDarkMode ? 'text-slate-500' : 'text-slate-400';
    if (wordCount < minWords || wordCount > maxWords) return isDarkMode ? 'text-rose-400' : 'text-rose-600';
    return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleGetExercise = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await generateWritingPrompt({ token: user.token, level });
      setExercise(result);
      setUserText('');
      timerRef.current?.reset();
      setStep('writing');
    } catch (err) {
      setError(err.message ?? t('common.error', 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!userText.trim()) return;
    setError(null);
    setLoading(true);
    timerRef.current?.stop();
    try {
      const result = await evaluateWriting({
        token:          user.token,
        level,
        exercisePrompt: exercise.prompt,
        userText,
      });
      setEval(result);
      setStep('results');
    } catch (err) {
      setError(err.message ?? t('common.error', 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setStep('setup');
    setExercise(null);
    setUserText('');
    setEval(null);
    setError(null);
    timerRef.current?.reset();
  };

  // ---------------------------------------------------------------------------
  // STEP: setup
  // ---------------------------------------------------------------------------
  if (step === 'setup') {
    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-amber-400 flex items-center justify-center shrink-0">
              <PenLine size={18} className="text-slate-900" />
            </div>
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              {t('exam.writing', 'Writing')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="WritingExercise" />
        </div>

        <ErrorBanner error={error} isDarkMode={isDarkMode} />

        {/* Level selector */}
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.select_level', 'Select your level')}
          </SectionHeading>
          <NeoDropdown
            options={CEFR_LEVELS}
            value={level}
            onChange={setLevel}
            isDarkMode={isDarkMode}
            className="w-full sm:w-64"
          />
        </Card>

        {/* Language note */}
        <p className={`text-xs font-semibold ${
          isDarkMode ? 'text-slate-500' : 'text-slate-400'
        }`}>
          {/* TODO: update when multi-language support is added */}
          {t('exam.language_note', 'Exercise is in European Portuguese (pt-PT).')}
        </p>

        {/* Get exercise button */}
        {loading
          ? <Loader isDarkMode={isDarkMode} message={t('exam.generating', 'Generating exercise...')} />
          : (
            <PrimaryButton onClick={handleGetExercise} isDarkMode={isDarkMode}>
              {t('exam.get_exercise', 'Get Exercise')}
              <ChevronRight size={16} />
            </PrimaryButton>
          )
        }
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP: writing
  // ---------------------------------------------------------------------------
  if (step === 'writing') {
    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg border-2 ${
              isDarkMode ? 'border-teal-700 text-teal-400 bg-teal-900/30' : 'border-teal-300 text-teal-700 bg-teal-50'
            }`}>{level}</span>
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              {t('exam.writing', 'Writing')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="WritingExercise" />
        </div>

        <ErrorBanner error={error} isDarkMode={isDarkMode} />

        {/* Exercise prompt card */}
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.task', 'Your Task')}
          </SectionHeading>
          <p className={`text-sm sm:text-base font-semibold leading-relaxed mb-3 ${
            isDarkMode ? 'text-slate-200' : 'text-slate-800'
          }`}>
            {exercise.prompt}
          </p>
          {exercise.instructions?.length > 0 && (
            <ul className="flex flex-col gap-1.5 mt-3">
              {exercise.instructions.map((instr, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}>
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${
                    isDarkMode ? 'border-teal-600 text-teal-400' : 'border-teal-500 text-teal-600'
                  }`}>
                    {i + 1}
                  </span>
                  {instr}
                </li>
              ))}
            </ul>
          )}
          <p className={`mt-3 text-xs font-semibold ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}>
            {t('exam.word_count_target', 'Target: {{min}}–{{max}} words', { min: minWords, max: maxWords })}
          </p>
        </Card>

        {/* Timer */}
        <div>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.timer', 'Timer')}
          </SectionHeading>
          <ExamTimer ref={timerRef} isDarkMode={isDarkMode} />
        </div>

        {/* Textarea + word count */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionHeading isDarkMode={isDarkMode}>
              {t('exam.your_text', 'Your Text')}
            </SectionHeading>
            <span className={`text-xs font-black tabular-nums ${wordCountColor()}`}>
              {wordCount} {t('exam.words', 'words')}
              {wordCount > 0 && (wordCount < minWords || wordCount > maxWords) && (
                <span className="ml-1 opacity-75">
                  ({wordCount < minWords
                    ? t('exam.too_short', 'too short')
                    : t('exam.too_long', 'too long')})
                </span>
              )}
            </span>
          </div>
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            placeholder={t('exam.textarea_placeholder', 'Escreve o teu texto aqui...')}
            rows={10}
            className={`w-full rounded-xl border-4 p-4 font-medium text-sm leading-relaxed resize-y
              focus:outline-none focus:ring-0 transition-colors
              ${ isDarkMode
                ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-teal-500'
                : 'bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-teal-600'
              }`}
            aria-label={t('exam.your_text', 'Your Text')}
          />
        </div>

        {/* Actions */}
        {loading
          ? <Loader isDarkMode={isDarkMode} message={t('exam.evaluating', 'Evaluating your text...')} />
          : (
            <div className="flex flex-col sm:flex-row gap-3">
              <PrimaryButton
                onClick={handleEvaluate}
                isDarkMode={isDarkMode}
                disabled={!userText.trim()}
                className="flex-1"
              >
                <BarChart2 size={16} />
                {t('exam.evaluate', 'Evaluate My Writing')}
              </PrimaryButton>
              <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
                <RotateCcw size={14} />
                {t('exam.try_again', 'Try Again')}
              </GhostButton>
            </div>
          )
        }
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STEP: results
  // ---------------------------------------------------------------------------
  if (step === 'results' && evaluation) {
    const scoreColor  = getScoreColor(evaluation.totalScore, evaluation.maxScore, isDarkMode);
    const scorePct    = Math.round((evaluation.totalScore / evaluation.maxScore) * 100);

    return (
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg border-2 ${
              isDarkMode ? 'border-teal-700 text-teal-400 bg-teal-900/30' : 'border-teal-300 text-teal-700 bg-teal-50'
            }`}>{level}</span>
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}>
              {t('exam.results', 'Results')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="WritingExercise" />
        </div>

        {/* Score card */}
        <Card isDarkMode={isDarkMode}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {t('exam.score', 'Score')}
              </p>
              <p className={`text-5xl font-black tabular-nums leading-none ${scoreColor}`}>
                {evaluation.totalScore}
                <span className={`text-2xl ${ isDarkMode ? 'text-slate-500' : 'text-slate-400' }`}>
                  /{evaluation.maxScore}
                </span>
              </p>
              <p className={`text-xs font-semibold mt-1 ${
                isDarkMode ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {scorePct}%
                {evaluation.wordCountPenalty > 0 && (
                  <span className={`ml-2 ${ isDarkMode ? 'text-rose-400' : 'text-rose-600' }`}>
                    ({t('exam.penalty', '-{{n}} word count penalty', { n: evaluation.wordCountPenalty })})
                  </span>
                )}
              </p>
            </div>
            <CheckCircle2
              size={48}
              className={getScoreColor(evaluation.totalScore, evaluation.maxScore, isDarkMode)}
            />
          </div>

          {/* Word count */}
          <div className={`mt-3 pt-3 border-t-2 ${
            isDarkMode ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <p className={`text-xs font-semibold ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {t('exam.word_count', 'Word count')}: <span className="font-black">{evaluation.wordCount}</span>
              {' '}({t('exam.word_count_target', 'Target: {{min}}–{{max}} words', { min: minWords, max: maxWords })})
            </p>
          </div>
        </Card>

        {/* Parameter breakdown */}
        <div>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.breakdown', 'Score Breakdown')}
          </SectionHeading>
          <div className="flex flex-col gap-2">
            {evaluation.parameters.map((param) => (
              <ParameterRow key={param.id} param={param} isDarkMode={isDarkMode} />
            ))}
          </div>
        </div>

        {/* General feedback */}
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.general_feedback', 'General Feedback')}
          </SectionHeading>
          <p className={`text-sm leading-relaxed ${
            isDarkMode ? 'text-slate-300' : 'text-slate-600'
          }`}>
            {evaluation.generalFeedback}
          </p>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode} className="flex-1">
            <RotateCcw size={14} />
            {t('exam.try_again', 'Try Again')}
          </GhostButton>

          {/* Improve My Text — Coming Soon */}
          <div className="relative flex-1">
            <GhostButton
              onClick={() => {}}
              isDarkMode={isDarkMode}
              disabled
              className="w-full"
            >
              <Wand2 size={14} />
              {t('exam.improve', 'Improve My Text')}
            </GhostButton>
            <div className="absolute -top-2 -right-2">
              <StatusBadge label={t('challenges.coming_soon', 'Coming Soon')} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

WritingExercise.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default WritingExercise;
