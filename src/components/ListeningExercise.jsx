/**
 * ListeningExercise.jsx
 *
 * Full listening exercise flow for the Exam Training feature.
 *
 * State machine:
 *   'setup'     -> user selects CEFR level and requests an exercise
 *   'listening' -> user listens via TTSPlayer and answers comprehension questions
 *   'results'   -> user sees score breakdown per question
 *
 * Props:
 *   isDarkMode {bool}  - theme flag
 *   onBack     {func}  - navigates back to ExamTrainingMenu
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Headphones,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import NeoDropdown from './NeoDropdown';
import Loader from './Loader';
import ExamTimer from './ExamTimer';
import ReportButton from './ReportButton';
import TTSPlayer from './TTSPlayer';
import { getExercise } from '../services/examExerciseService';
import { checkListeningAnswers } from '../services/examListeningExerciseService';
import { markExerciseSeen } from '../services/userService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 - Iniciante' },
  { value: 'A2', label: 'A2 - Elementar' },
  { value: 'B1', label: 'B1 - Interm\u00e9dio' },
  { value: 'B2', label: 'B2 - Independente' },
  { value: 'C1', label: 'C1 - Avan\u00e7ado' },
  { value: 'C2', label: 'C2 - Proficiente' },
];

const SUPPORTED_LANGS = ['pt-PT'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionHeading = ({ children, isDarkMode }) => (
  <h2
    className={`text-xs font-black uppercase tracking-widest mb-3 ${
      isDarkMode ? 'text-slate-400' : 'text-slate-500'
    }`}
  >
    {children}
  </h2>
);
SectionHeading.propTypes = {
  children: PropTypes.node.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const Card = ({ children, isDarkMode, className }) => (
  <div
    className={`rounded-2xl border-4 p-4 sm:p-5 ${
      isDarkMode
        ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
        : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
    } ${className}`}
  >
    {children}
  </div>
);
Card.propTypes = {
  children: PropTypes.node.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};
Card.defaultProps = { className: '' };

const PrimaryButton = ({ children, onClick, disabled, isDarkMode, loading, className }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase
      tracking-widest text-sm transition-all active:scale-95 select-none
      ${
        disabled || loading
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:-translate-y-0.5'
      }
      ${
        isDarkMode
          ? 'bg-sky-500 border-sky-400 text-slate-900 shadow-[4px_4px_0px_0px_#0c4a6e] hover:bg-sky-400'
          : 'bg-sky-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-sky-600'
      } ${className}`}
  >
    {children}
  </button>
);
PrimaryButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  loading: PropTypes.bool,
  className: PropTypes.string,
};
PrimaryButton.defaultProps = { disabled: false, loading: false, className: '' };

const GhostButton = ({ children, onClick, disabled, isDarkMode, className }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-4 font-black uppercase
      tracking-widest text-sm transition-all active:scale-95 select-none
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}
      ${
        isDarkMode
          ? 'bg-transparent border-slate-600 text-slate-300 hover:bg-slate-700'
          : 'bg-transparent border-slate-900 text-slate-700 hover:bg-slate-100'
      } ${className}`}
  >
    {children}
  </button>
);
GhostButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};
GhostButton.defaultProps = { disabled: false, className: '' };

const BackButton = ({ onBack, isDarkMode, t }) => (
  <button
    onClick={onBack}
    className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest
      transition-all hover:-translate-x-0.5 ${
        isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
      }`}
    aria-label={t('common.back', 'Back')}
  >
    <ArrowLeft size={14} />
    {t('common.back', 'Back')}
  </button>
);
BackButton.propTypes = {
  onBack: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  t: PropTypes.func.isRequired,
};

const ErrorBanner = ({ error, isDarkMode }) =>
  error ? (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
        isDarkMode
          ? 'bg-rose-900/30 border-rose-700 text-rose-300'
          : 'bg-rose-50 border-rose-300 text-rose-700'
      }`}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
      <p className="text-sm font-semibold">{error}</p>
    </div>
  ) : null;
ErrorBanner.propTypes = {
  error: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
};
ErrorBanner.defaultProps = { error: null };

const QuestionCard = ({ question, selectedAnswer, onSelect, isDarkMode, index }) => (
  <div
    className={`rounded-2xl border-4 p-4 sm:p-5 ${
      isDarkMode
        ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]'
        : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'
    }`}
  >
    <p
      className={`text-sm sm:text-base font-bold mb-3 ${
        isDarkMode ? 'text-slate-100' : 'text-slate-900'
      }`}
    >
      <span
        className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${
          isDarkMode
            ? 'border-sky-600 text-sky-400'
            : 'border-sky-500 text-sky-600'
        }`}
      >
        {index + 1}
      </span>
      {question.text}
    </p>
    <div className="flex flex-col gap-2">
      {question.options.map((option) => {
        const isSelected = selectedAnswer === option;
        return (
          <button
            key={option}
            onClick={() => onSelect(question.id, option)}
            className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${
              isSelected
                ? isDarkMode
                  ? 'bg-sky-900/40 border-sky-500 text-sky-300'
                  : 'bg-sky-50 border-sky-500 text-sky-800'
                : isDarkMode
                ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  </div>
);
QuestionCard.propTypes = {
  question: PropTypes.shape({
    id: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    options: PropTypes.arrayOf(PropTypes.string).isRequired,
    correctAnswer: PropTypes.string.isRequired,
  }).isRequired,
  selectedAnswer: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  index: PropTypes.number.isRequired,
};
QuestionCard.defaultProps = { selectedAnswer: null };

const ResultRow = ({ item, index, isDarkMode }) => {
  const [expanded, setExpanded] = useState(false);
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
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black ${
              isDarkMode
                ? 'border-slate-600 bg-slate-700 text-white'
                : 'border-slate-300 bg-slate-100 text-slate-900'
            }`}
          >
            {index + 1}
          </span>
          <span
            className={`font-bold text-sm truncate ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {item.question}
          </span>
        </div>
        {item.isCorrect ? (
          <CheckCircle2
            size={18}
            className={`shrink-0 ${
              isDarkMode ? 'text-sky-400' : 'text-sky-600'
            }`}
          />
        ) : (
          <XCircle
            size={18}
            className={`shrink-0 ${
              isDarkMode ? 'text-rose-400' : 'text-rose-600'
            }`}
          />
        )}
      </div>
      {expanded && (
        <div className="mt-3 flex flex-col gap-1.5">
          {item.userAnswer && (
            <p
              className={`text-xs font-semibold ${
                item.isCorrect
                  ? isDarkMode ? 'text-sky-400' : 'text-sky-700'
                  : isDarkMode ? 'text-rose-400' : 'text-rose-700'
              }`}
            >
              {item.isCorrect ? '\u2713' : '\u2717'} {item.userAnswer}
            </p>
          )}
          {!item.isCorrect && (
            <p
              className={`text-xs font-semibold ${
                isDarkMode ? 'text-sky-400' : 'text-sky-700'
              }`}
            >
              \u2713 {item.correctAnswer}
            </p>
          )}
        </div>
      )}
    </button>
  );
};
ResultRow.propTypes = {
  item: PropTypes.shape({
    questionId: PropTypes.string.isRequired,
    question: PropTypes.string.isRequired,
    userAnswer: PropTypes.string,
    correctAnswer: PropTypes.string.isRequired,
    isCorrect: PropTypes.bool.isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Score colour helper
// ---------------------------------------------------------------------------

function getScoreColor(score, max, isDarkMode) {
  const pct = score / max;
  if (pct >= 0.8) return isDarkMode ? 'text-sky-400' : 'text-sky-600';
  if (pct >= 0.5) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
  return isDarkMode ? 'text-rose-400' : 'text-rose-600';
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const ListeningExercise = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const { user, setUser } = useAppContext();

  const targetLang = user?.learningDialect ?? 'pt-PT';
  const isLangSupported = SUPPORTED_LANGS.includes(targetLang);

  // ── State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState('setup'); // 'setup' | 'listening' | 'results'
  const [level, setLevel] = useState('A1');
  const [exercise, setExercise] = useState(null); // ListeningExerciseContent
  const [exerciseId, setExerciseId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────
  const allAnswered =
    exercise?.questions?.length > 0 &&
    exercise.questions.every((q) => answers[q.id] != null);

  const markCurrentExerciseSeen = async () => {
    if (!exerciseId || !user?.token || !user?.uid) return;
    const currentSeen = user.seenExerciseIds ?? [];
    await markExerciseSeen(user.token, user.uid, exerciseId, currentSeen);
    setUser((prev) => ({
      ...prev,
      seenExerciseIds: [...new Set([...currentSeen, exerciseId])],
    }));
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleGetExercise = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await getExercise({
        token: user.token,
        level,
        type: 'listening',
        targetLang: user.learningDialect || 'pt-PT',
        userDialect: user.interfaceLang || 'en-US',
        seenExerciseIds: user.seenExerciseIds ?? [],
      });
      setExercise(res.content);
      setExerciseId(res.exerciseId);
      setAnswers({});
      setShowTranscript(false);
      setStep('listening');
    } catch (err) {
      setError(err.message ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleCheckAnswers = async () => {
    if (!exercise?.questions) return;
    const userAnswers = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
      questionId,
      selectedAnswer,
    }));
    const res = checkListeningAnswers(userAnswers, exercise.questions);
    setResult(res);
    setStep('results');
    await markCurrentExerciseSeen();
  };

  const handleTryAgain = async () => {
    setExercise(null);
    setExerciseId(null);
    setAnswers({});
    setResult(null);
    setError(null);
    setShowTranscript(false);
    await handleGetExercise();
  };

  // ── Shared inline elements ─────────────────────────────────────────────
  const headerIcon = (
    <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-sky-400 flex items-center justify-center shrink-0">
      <Headphones size={18} className="text-slate-900" />
    </div>
  );

  const levelBadge = (
    <span
      className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg border-2 ${
        isDarkMode
          ? 'border-sky-700 text-sky-400 bg-sky-900/30'
          : 'border-sky-300 text-sky-700 bg-sky-50'
      }`}
    >
      {level}
    </span>
  );

  // ── STEP: setup ──────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="flex flex-col gap-5">
        <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {headerIcon}
            <h2
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {t('exam.listening', 'Listening Comprehension')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
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

        {/* Language support check */}
        {!isLangSupported ? (
          <div
            className={`flex items-start gap-3 p-4 rounded-xl border-2 ${
              isDarkMode
                ? 'bg-amber-900/30 border-amber-700 text-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-700'
            }`}
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm font-semibold">
              {t(
                'exam.listening_lang_unsupported',
                `Listening exercises are currently only available for pt-PT. Your learning language is ${targetLang}.`
              )}
            </p>
          </div>
        ) : loading ? (
          <Loader
            isDarkMode={isDarkMode}
            message={t('exam.generating', 'Generating exercise...')}
          />
        ) : (
          <PrimaryButton onClick={handleGetExercise} isDarkMode={isDarkMode}>
            {t('exam.get_exercise', 'Get Exercise')}
            <ChevronRight size={16} />
          </PrimaryButton>
        )}
      </div>
    );
  }

  // ── STEP: listening ──────────────────────────────────────────────────
  if (step === 'listening') {
    // Null-guard: exercise is null during fetch/generation or after an error
    if (!exercise) {
      if (loading) {
        return (
          <div className="flex flex-col gap-5">
            <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />
            <Loader
              isDarkMode={isDarkMode}
              message={t('exam.generating', 'Generating exercise...')}
            />
            {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}
          </div>
        );
      }
      if (error) {
        return (
          <div className="flex flex-col gap-5">
            <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />
            <ErrorBanner error={error} isDarkMode={isDarkMode} />
            <PrimaryButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
              <RotateCcw size={14} />
              {t('exam.try_again', 'Try Again')}
            </PrimaryButton>
          </div>
        );
      }
      return null;
    }

    return (
      <div className="flex flex-col gap-5">
        <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {levelBadge}
            <h2
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {t('exam.listening', 'Listening Comprehension')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
        </div>

        <ErrorBanner error={error} isDarkMode={isDarkMode} />

        {/* TTS Player */}
        <div>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.audio', 'Audio')}
          </SectionHeading>
          <TTSPlayer
            text={exercise.transcript}
            lang={targetLang}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Transcript toggle */}
        <div>
          <button
            onClick={() => setShowTranscript((prev) => !prev)}
            className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest
              transition-all hover:-translate-y-0.5 ${
                isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            aria-expanded={showTranscript}
          >
            {showTranscript
              ? <EyeOff size={14} />
              : <Eye size={14} />}
            {showTranscript
              ? t('exam.hide_transcript', 'Hide Transcript')
              : t('exam.show_transcript', 'Show Transcript')}
          </button>

          {showTranscript && (
            <Card isDarkMode={isDarkMode} className="mt-3">
              <SectionHeading isDarkMode={isDarkMode}>
                {t('exam.transcript', 'Transcript')}
              </SectionHeading>
              <p
                className={`text-sm sm:text-base leading-relaxed font-medium ${
                  isDarkMode ? 'text-slate-200' : 'text-slate-800'
                }`}
              >
                {exercise.transcript}
              </p>
            </Card>
          )}
        </div>

        {/* Instructions */}
        {exercise.instructions?.length > 0 && (
          <Card isDarkMode={isDarkMode}>
            <SectionHeading isDarkMode={isDarkMode}>
              {t('exam.instructions', 'Instructions')}
            </SectionHeading>
            <ul className="flex flex-col gap-1.5">
              {exercise.instructions.map((instr, i) => (
                <li
                  key={i}
                  className={`flex items-start gap-2 text-xs ${
                    isDarkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${
                      isDarkMode
                        ? 'border-sky-600 text-sky-400'
                        : 'border-sky-500 text-sky-600'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {instr}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Timer */}
        <div>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.timer', 'Timer')}
          </SectionHeading>
          <ExamTimer isDarkMode={isDarkMode} />
        </div>

        {/* Questions */}
        <div>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.comprehension_questions', 'Comprehension Questions')}
          </SectionHeading>
          <div className="flex flex-col gap-3">
            {exercise.questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                question={q}
                selectedAnswer={answers[q.id] ?? null}
                onSelect={handleSelectAnswer}
                isDarkMode={isDarkMode}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Progress hint */}
        <p
          className={`text-xs font-semibold ${
            isDarkMode ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          {Object.keys(answers).length} / {exercise.questions.length}{' '}
          {t('exam.questions_answered', 'questions answered')}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <PrimaryButton
            onClick={handleCheckAnswers}
            isDarkMode={isDarkMode}
            disabled={!allAnswered}
            className="flex-1"
          >
            <CheckCircle2 size={16} />
            {t('exam.check_answers', 'Check My Answers')}
          </PrimaryButton>
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
            <RotateCcw size={14} />
            {t('exam.try_again', 'Try Again')}
          </GhostButton>
        </div>
      </div>
    );
  }

  // ── STEP: results ────────────────────────────────────────────────────
  if (step === 'results') {
    // Null-guard: exercise is null during fetch/generation or after an error
    if (!exercise) {
      if (loading) {
        return (
          <div className="flex flex-col gap-5">
            <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />
            <Loader
              isDarkMode={isDarkMode}
              message={t('exam.generating', 'Generating exercise...')}
            />
            {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}
          </div>
        );
      }
      if (error) {
        return (
          <div className="flex flex-col gap-5">
            <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />
            <ErrorBanner error={error} isDarkMode={isDarkMode} />
            <PrimaryButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
              <RotateCcw size={14} />
              {t('exam.try_again', 'Try Again')}
            </PrimaryButton>
          </div>
        );
      }
      return null;
    }

    if (!result) return null;

    const scoreColor = getScoreColor(result.score, result.maxScore, isDarkMode);

    return (
      <div className="flex flex-col gap-5">
        <BackButton onBack={onBack} isDarkMode={isDarkMode} t={t} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {levelBadge}
            <h2
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {t('exam.results', 'Results')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
        </div>

        {/* Score card */}
        <Card isDarkMode={isDarkMode}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                className={`text-xs font-black uppercase tracking-widest mb-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {t('exam.score', 'Score')}
              </p>
              <p className={`text-5xl font-black tabular-nums leading-none ${scoreColor}`}>
                {result.score}
                <span
                  className={`text-2xl ${
                    isDarkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  /{result.maxScore}
                </span>
              </p>
              <p
                className={`text-xs font-semibold mt-1 ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {result.percentage}%
              </p>
            </div>
            <CheckCircle2 size={48} className={scoreColor} />
          </div>
        </Card>

        {/* Per-question breakdown */}
        <div>
          <SectionHeading isDarkMode={isDarkMode}>
            {t('exam.breakdown', 'Score Breakdown')}
          </SectionHeading>
          <div className="flex flex-col gap-2">
            {result.breakdown.map((item, i) => (
              <ResultRow
                key={item.questionId}
                item={item}
                index={i}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <GhostButton onClick={onBack} isDarkMode={isDarkMode} className="flex-1">
            <ArrowLeft size={14} />
            {t('common.back', 'Back')}
          </GhostButton>
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode} className="flex-1">
            <RotateCcw size={14} />
            {t('exam.try_again', 'Try Again')}
          </GhostButton>
        </div>
      </div>
    );
  }

  return null;
};

ListeningExercise.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default ListeningExercise;
