import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { PenLine, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import ExerciseSidebar from './ExerciseSidebar';
import Loader from './Loader';
import ReportButton from './ReportButton';
import { Card, SectionHeading, ErrorBanner, PrimaryButton, GhostButton, LevelBadge, CollapsibleCard } from './ui';
import { getExercise } from '../services/examExerciseService';
import { evaluateWriting } from '../services/examWritingExerciseService';
import { getScoreColor } from '../services/examUtils';
import { markExerciseSeen } from '../services/userService';

const PARAM_NAME_KEYS = {
  A: 'exam.param_a_name',
  B: 'exam.param_b_name',
  C: 'exam.param_c_name',
  D: 'exam.param_d_name',
  E: 'exam.param_e_name',
};

const ParameterRow = ({ param, isDarkMode, paramLabel }) => {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = getScoreColor(param.score, param.maxScore, isDarkMode);

  return (
    <button
      onClick={() => setExpanded((p) => !p)}
      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${isDarkMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-200 hover:bg-slate-50'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center font-black text-xs ${isDarkMode ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-slate-100 text-slate-900'}`}>
            {param.id}
          </span>
          <span className={`font-bold text-sm truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
            {paramLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-black text-sm tabular-nums ${scoreColor}`}>
            {param.score}<span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>/{param.maxScore}</span>
          </span>
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''} ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
        </div>
      </div>
      {expanded && (
        <p className={`mt-2 text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
          {param.feedback}
        </p>
      )}
    </button>
  );
};

ParameterRow.propTypes = {
  param: PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, score: PropTypes.number.isRequired, maxScore: PropTypes.number.isRequired, feedback: PropTypes.string.isRequired }).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  paramLabel: PropTypes.string.isRequired,
};

const headerIcon = (
  <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-amber-400 flex items-center justify-center shrink-0">
    <PenLine size={18} className="text-slate-900" />
  </div>
);

const WritingExercise = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, setUser, showAlert } = useAppContext();

  const [level, setLevel] = useState('A1');
  const [exercise, setExercise] = useState(null);
  const [exerciseId, setExerciseId] = useState(null);
  // Bug #5 fix: store minWords/maxWords from exercise explicitly so they remain
  // stable in the results view even if exercise state were ever cleared.
  const [minWords, setMinWords] = useState(60);
  const [maxWords, setMaxWords] = useState(100);
  const [userText, setUserText] = useState('');
  const [evaluation, setEval] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const wordCount = userText.trim() ? userText.trim().split(/\s+/).filter(Boolean).length : 0;

  const wordCountColor = () => {
    if (wordCount === 0) return isDarkMode ? 'text-slate-500' : 'text-slate-400';
    if (wordCount < minWords || wordCount > maxWords) return isDarkMode ? 'text-rose-400' : 'text-rose-600';
    return isDarkMode ? 'text-emerald-400' : 'text-emerald-600';
  };

  const markCurrentExerciseSeen = async () => {
    if (!exerciseId || !user?.token || !user?.uid) return;
    const currentSeen = user.seenExerciseIds ?? [];
    await markExerciseSeen(user.token, user.uid, exerciseId, currentSeen);
    setUser((prev) => ({ ...prev, seenExerciseIds: [...new Set([...currentSeen, exerciseId])] }));
  };

  const handleGetExercise = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await getExercise({
        token: user.token, level, type: 'writing',
        targetLang: user.learningDialect || 'pt-PT',
        userDialect: user.interfaceLang || 'en-US',
        seenExerciseIds: user.seenExerciseIds ?? [],
      });
      setExercise(result.content);
      setExerciseId(result.exerciseId);
      // Bug #5 fix: capture word limits into explicit state
      setMinWords(result.content?.minWords ?? 60);
      setMaxWords(result.content?.maxWords ?? 100);
      setUserText('');
      setEval(null);
      // Bug #1 fix: reset then auto-start the timer when exercise loads
      timerRef.current?.reset();
      timerRef.current?.start();
    } catch (err) {
      const errorMessage = err.message ?? t('common.error', 'Something went wrong. Please try again.');
      setError(errorMessage);
      showAlert("error", errorMessage, {
        label: t('common.try_again', 'Try Again'),
        onClick: handleGetExercise
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!userText.trim() || loading) return;
    setError(null);
    setLoading(true);
    timerRef.current?.stop();
    try {
      const result = await evaluateWriting({
        token: user.token, level,
        targetLang: user.learningDialect || 'pt-PT',
        interfaceLang: user.interfaceLang || 'en-US',
        exercisePrompt: exercise.prompt, userText,
      });
      setEval(result);
      await markCurrentExerciseSeen();
    } catch (err) {
      const errorMessage = err.message ?? t('common.error', 'Something went wrong. Please try again.');
      setError(errorMessage);
      showAlert("error", errorMessage, {
        label: t('common.try_again', 'Try Again'),
        onClick: handleEvaluate
      });
    } finally {
      setLoading(false);
    }
  };

  // Resets writing state so the user can attempt the same exercise again.
  // Does NOT fetch a new exercise — exercise + exerciseId are intentionally kept.
  const handleTryAgain = () => {
    setUserText('');
    setEval(null);
    setError(null);
    timerRef.current?.reset();
    timerRef.current?.start();
  };

  // Loading guard (initial exercise fetch)
  if (!exercise && loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar exerciseType="writing" level={level} onLevelChange={setLevel} onGenerate={handleGetExercise} loading={loading} isDarkMode={isDarkMode} timerRef={timerRef} />
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <Loader isDarkMode={isDarkMode} message={t('exam.generating', 'Generating exercise...')} />
          {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}
        </div>
      </div>
    );
  }

  // Error guard — exercise failed to load; Try Again fetches a new exercise
  if (!exercise && error) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar exerciseType="writing" level={level} onLevelChange={setLevel} onGenerate={handleGetExercise} loading={loading} isDarkMode={isDarkMode} timerRef={timerRef} />
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <ErrorBanner error={error} isDarkMode={isDarkMode} />
          <PrimaryButton onClick={handleGetExercise} isDarkMode={isDarkMode}><RotateCcw size={14} /> {t('common.try_again', 'Try Again')}</PrimaryButton>
        </div>
      </div>
    );
  }

  // Results view
  if (evaluation) {
    const scoreColor = getScoreColor(evaluation.totalScore, evaluation.maxScore, isDarkMode);
    const scorePct = Math.round((evaluation.totalScore / evaluation.maxScore) * 100);

    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar exerciseType="writing" level={level} onLevelChange={setLevel} onGenerate={handleGetExercise} loading={loading} isDarkMode={isDarkMode} timerRef={timerRef} />

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LevelBadge level={level} isDarkMode={isDarkMode} color="teal" />
              <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {t('exam.results', 'Results')}
              </h2>
            </div>
            <ReportButton isDarkMode={isDarkMode} context="WritingExercise" />
          </div>

          {/* Collapsible: original task instructions */}
          <CollapsibleCard
            title={t('exam.task', 'Your Task')}
            isDarkMode={isDarkMode}
            defaultOpen={false}
          >
            <p className={`text-sm sm:text-base font-semibold leading-relaxed mb-3 mt-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
              {exercise.prompt}
            </p>
            {exercise.instructions?.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {exercise.instructions.map((instr, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? 'border-teal-600 text-teal-400' : 'border-teal-500 text-teal-600'}`}>{i + 1}</span>
                    {instr}
                  </li>
                ))}
              </ul>
            )}
            <p className={`mt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {t('exam.word_count_target', 'Target: {{min}}\u2013{{max}} words', { min: minWords, max: maxWords })}
            </p>
          </CollapsibleCard>

          {/* Collapsible: what the user wrote */}
          <CollapsibleCard
            title={t('exam.your_text', 'Your Text')}
            isDarkMode={isDarkMode}
            defaultOpen={false}
          >
            <p className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {userText}
            </p>
          </CollapsibleCard>

          {/* Score card */}
          <Card isDarkMode={isDarkMode}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.score', 'Score')}</p>
                <p className={`text-5xl font-black tabular-nums leading-none ${scoreColor}`}>
                  {evaluation.totalScore}<span className={`text-2xl ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>/{evaluation.maxScore}</span>
                </p>
                <p className={`text-xs font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {scorePct}%
                  {evaluation.wordCountPenalty > 0 && (
                    <span className={`ml-2 ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>
                      ({t('exam.penalty', '-{{n}} word count penalty', { n: evaluation.wordCountPenalty })})
                    </span>
                  )}
                </p>
              </div>
              <CheckCircle2 size={48} className={scoreColor} />
            </div>
            <div className={`mt-3 pt-3 border-t-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {t('exam.word_count', 'Word count')}: <span className="font-black">{evaluation.wordCount}</span>
                {/* Bug #2 fix: use Unicode en-dash \u2013 instead of &ndash; HTML entity */}
                {' '}({t('exam.word_count_target', 'Target: {{min}}\u2013{{max}} words', { min: minWords, max: maxWords })})
              </p>
            </div>
          </Card>

          <div>
            <SectionHeading isDarkMode={isDarkMode}>{t('exam.breakdown', 'Score Breakdown')}</SectionHeading>
            <div className="flex flex-col gap-2">
              {evaluation.parameters.map((param) => (
                <ParameterRow key={param.id} param={param} isDarkMode={isDarkMode} paramLabel={t(PARAM_NAME_KEYS[param.id], param.name)} />
              ))}
            </div>
          </div>

          <Card isDarkMode={isDarkMode}>
            <SectionHeading isDarkMode={isDarkMode}>{t('exam.general_feedback', 'General Feedback')}</SectionHeading>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{evaluation.generalFeedback}</p>
          </Card>

          {/* Try Again — resets state, same exercise */}
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
            <RotateCcw size={14} /> {t('exam.try_again', 'Try Again')}
          </GhostButton>
        </div>
      </div>
    );
  }

  // Initial state: no exercise loaded
  if (!exercise) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar exerciseType="writing" level={level} onLevelChange={setLevel} onGenerate={handleGetExercise} loading={loading} isDarkMode={isDarkMode} timerRef={timerRef} />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3 mb-4">
            {headerIcon}
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.writing', 'Writing')}
            </h2>
          </div>
          {/* Bug #5 fix: derive language note from user.learningDialect instead of hardcoding pt-PT */}
          <p className={`text-sm font-semibold text-center ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {t('exam.language_note_dynamic', 'Exercise is in {{lang}}.', { lang: user?.learningDialect || 'pt-PT' })}
          </p>
        </div>
      </div>
    );
  }

  // Exercise view (loaded, not yet evaluated)
  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <ExerciseSidebar exerciseType="writing" level={level} onLevelChange={setLevel} onGenerate={handleGetExercise} loading={loading} isDarkMode={isDarkMode} timerRef={timerRef} />

      <div className="flex-1 min-w-0 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LevelBadge level={level} isDarkMode={isDarkMode} color="amber" />
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.writing', 'Writing')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="WritingExercise" />
        </div>

        <ErrorBanner error={error} isDarkMode={isDarkMode} />

        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.task', 'Your Task')}</SectionHeading>
          <p className={`text-sm sm:text-base font-semibold leading-relaxed mb-3 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{exercise.prompt}</p>
          {exercise.instructions?.length > 0 && (
            <ul className="flex flex-col gap-1.5 mt-3">
              {exercise.instructions.map((instr, i) => (
                <li key={i} className={`flex items-start gap-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? 'border-teal-600 text-teal-400' : 'border-teal-500 text-teal-600'}`}>{i + 1}</span>
                  {instr}
                </li>
              ))}
            </ul>
          )}
          {/* Bug #2 fix: use Unicode en-dash \u2013 instead of &ndash; HTML entity */}
          <p className={`mt-3 text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('exam.word_count_target', 'Target: {{min}}\u2013{{max}} words', { min: minWords, max: maxWords })}
          </p>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionHeading isDarkMode={isDarkMode}>{t('exam.your_text', 'Your Text')}</SectionHeading>
            <span className={`text-xs font-black tabular-nums ${wordCountColor()}`}>
              {wordCount} {t('exam.words', 'words')}
              {wordCount > 0 && (wordCount < minWords || wordCount > maxWords) && (
                <span className="ml-1 opacity-75">
                  ({wordCount < minWords ? t('exam.too_short', 'too short') : t('exam.too_long', 'too long')})
                </span>
              )}
            </span>
          </div>
          {/* Bug #4 fix: disable textarea while evaluation is loading */}
          <textarea value={userText} onChange={(e) => setUserText(e.target.value)}
            placeholder={t('exam.textarea_placeholder', 'Escreve o teu texto aqui...')} rows={10}
            disabled={loading}
            className={`w-full rounded-xl border-4 p-4 font-medium text-sm leading-relaxed resize-y focus:outline-none focus:ring-0 transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            } ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-teal-500' : 'bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-teal-600'}`}
            aria-label={t('exam.your_text', 'Your Text')} />
        </div>

        {/* Show inline loader while evaluation is in progress, otherwise show the evaluate button */}
        {loading ? (
          <Loader isDarkMode={isDarkMode} message={t('exam.evaluating', 'Evaluating...')} />
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Bug #4 fix: also disable the evaluate button while loading to prevent double-submit */}
            <PrimaryButton onClick={handleEvaluate} isDarkMode={isDarkMode} disabled={!userText.trim() || loading} className="flex-1" color="teal">
              {t('exam.evaluate', 'Evaluate My Writing')}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
};

WritingExercise.propTypes = { isDarkMode: PropTypes.bool.isRequired};

export default WritingExercise;