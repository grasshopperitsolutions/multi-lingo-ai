import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { BookOpen, RotateCcw, CheckCircle2, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import NeoDropdown from './NeoDropdown';
import Loader from './Loader';
import ExamTimer from './ExamTimer';
import ReportButton from './ReportButton';
import { Card, SectionHeading, ErrorBanner, PrimaryButton, GhostButton, ResultRow, LevelBadge } from './ui';
import { getExercise } from '../services/examExerciseService';
import { checkReadingAnswers, getScoreColor } from '../services/examUtils';
import { markExerciseSeen } from '../services/userService';

const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 - Iniciante' },
  { value: 'A2', label: 'A2 - Elementar' },
  { value: 'B1', label: 'B1 - Intermédio' },
  { value: 'B2', label: 'B2 - Independente' },
  { value: 'C1', label: 'C1 - Avançado' },
  { value: 'C2', label: 'C2 - Proficiente' },
];

const ReadingExercise = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const { user, setUser } = useAppContext();

  const [step, setStep] = useState('setup');
  const [level, setLevel] = useState('A1');
  const [exercise, setExercise] = useState(null);
  const [exerciseId, setExerciseId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const allAnswered = exercise?.questions?.length > 0 && exercise.questions.every((q) => answers[q.id] != null);

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
      const res = await getExercise({
        token: user.token, level, type: 'reading',
        targetLang: user.learningDialect || 'pt-PT',
        userDialect: user.interfaceLang || 'en-US',
        seenExerciseIds: user.seenExerciseIds ?? [],
      });
      setExercise(res.content);
      setExerciseId(res.exerciseId);
      setAnswers({});
      setStep('reading');
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
    const userAnswers = Object.entries(answers).map(([questionId, selectedAnswer]) => ({ questionId, selectedAnswer }));
    const res = checkReadingAnswers(userAnswers, exercise.questions);
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
    await handleGetExercise();
  };

  const headerIcon = (
    <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-emerald-400 flex items-center justify-center shrink-0">
      <BookOpen size={18} className="text-slate-900" />
    </div>
  );

  // Setup step
  if (step === 'setup') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {headerIcon}
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.reading', 'Reading Comprehension')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
        </div>
        <ErrorBanner error={error} isDarkMode={isDarkMode} />
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.select_level', 'Select your level')}</SectionHeading>
          <NeoDropdown options={CEFR_LEVELS} value={level} onChange={setLevel} isDarkMode={isDarkMode} className="w-full sm:w-64" />
        </Card>
        <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('exam.language_note', 'Exercise is in European Portuguese (pt-PT).')}
        </p>
        {loading ? (
          <Loader isDarkMode={isDarkMode} message={t('exam.generating', 'Generating exercise...')} />
        ) : (
          <PrimaryButton onClick={handleGetExercise} isDarkMode={isDarkMode}>
            {t('exam.get_exercise', 'Get Exercise')} <ChevronRight size={16} />
          </PrimaryButton>
        )}
      </div>
    );
  }

  // Reading / error / loading guards
  if (!exercise) {
    if (loading) {
      return (<div className="flex flex-col gap-5"><Loader isDarkMode={isDarkMode} message={t('exam.generating', 'Generating exercise...')} />{error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}</div>);
    }
    if (error) {
      return (<div className="flex flex-col gap-5"><ErrorBanner error={error} isDarkMode={isDarkMode} /><PrimaryButton onClick={handleTryAgain} isDarkMode={isDarkMode}><RotateCcw size={14} />{t('exam.try_again', 'Try Again')}</PrimaryButton></div>);
    }
    return null;
  }

  // Reading step
  if (step === 'reading') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LevelBadge level={level} isDarkMode={isDarkMode} />
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.reading', 'Reading Comprehension')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
        </div>

        <ErrorBanner error={error} isDarkMode={isDarkMode} />

        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.reading_passage', 'Reading Passage')}</SectionHeading>
          {exercise.instructions?.length > 0 && (
            <ul className="flex flex-col gap-1.5 mb-3">
              {exercise.instructions.map((instr, i) => (
                <li key={i} className={`flex items-start gap-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? 'border-emerald-600 text-emerald-400' : 'border-emerald-500 text-emerald-600'}`}>{i + 1}</span>
                  {instr}
                </li>
              ))}
            </ul>
          )}
          <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{exercise.text}</p>
        </Card>

        {exercise.vocabulary?.length > 0 && (
          <div>
            <SectionHeading isDarkMode={isDarkMode}>{t('exam.vocabulary', 'Vocabulary')}</SectionHeading>
            <div className="flex flex-col gap-1.5">
              {exercise.vocabulary.map((item) => (
                <div key={item.word} className={`flex items-start gap-2 px-3 py-2 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                  <span className={`font-black text-sm shrink-0 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{item.word}</span>
                  <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>— {item.definition}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.timer', 'Timer')}</SectionHeading>
          <ExamTimer isDarkMode={isDarkMode} />
        </div>

        <div>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.comprehension_questions', 'Comprehension Questions')}</SectionHeading>
          <div className="flex flex-col gap-3">
            {exercise.questions.map((q, i) => (
              <div key={q.id} className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? 'bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]' : 'bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]'}`}>
                <p className={`text-sm sm:text-base font-bold mb-3 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                  <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${isDarkMode ? 'border-emerald-600 text-emerald-400' : 'border-emerald-500 text-emerald-600'}`}>{i + 1}</span>
                  {q.text}
                </p>
                <div className="flex flex-col gap-2">
                  {q.options.map((option) => {
                    const isSelected = (answers[q.id] ?? null) === option;
                    return (
                      <button key={option} onClick={() => handleSelectAnswer(q.id, option)} className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${isSelected ? (isDarkMode ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300' : 'bg-emerald-50 border-emerald-500 text-emerald-800') : (isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}`}>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className={`text-xs font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {Object.keys(answers).length} / {exercise.questions.length} {t('exam.questions_answered', 'questions answered')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <PrimaryButton onClick={handleCheckAnswers} isDarkMode={isDarkMode} disabled={!allAnswered} className="flex-1">
            <CheckCircle2 size={16} /> {t('exam.check_answers', 'Check My Answers')}
          </PrimaryButton>
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
            <RotateCcw size={14} /> {t('exam.try_again', 'Try Again')}
          </GhostButton>
        </div>
      </div>
    );
  }

  // Results step
  if (step === 'results') {
    if (!result) return null;
    const scoreColor = getScoreColor(result.score, result.maxScore, isDarkMode);

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LevelBadge level={level} isDarkMode={isDarkMode} />
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.results', 'Results')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
        </div>

        <Card isDarkMode={isDarkMode}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className={`text-xs font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t('exam.score', 'Score')}</p>
              <p className={`text-5xl font-black tabular-nums leading-none ${scoreColor}`}>
                {result.score}<span className={`text-2xl ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>/{result.maxScore}</span>
              </p>
              <p className={`text-xs font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{result.percentage}%</p>
            </div>
            <CheckCircle2 size={48} className={scoreColor} />
          </div>
        </Card>

        <div>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.breakdown', 'Score Breakdown')}</SectionHeading>
          <div className="flex flex-col gap-2">
            {result.breakdown.map((item, i) => (
              <ResultRow key={item.questionId} item={item} index={i} isDarkMode={isDarkMode} />
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <GhostButton onClick={onBack} isDarkMode={isDarkMode} className="flex-1"><ArrowLeft size={14} /> {t('common.back', 'Back')}</GhostButton>
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode} className="flex-1"><RotateCcw size={14} /> {t('exam.try_again', 'Try Again')}</GhostButton>
        </div>
      </div>
    );
  }

  return null;
};

ReadingExercise.propTypes = { isDarkMode: PropTypes.bool.isRequired, onBack: PropTypes.func.isRequired };

export default ReadingExercise;