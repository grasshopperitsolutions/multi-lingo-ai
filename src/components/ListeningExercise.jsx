import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Headphones, RotateCcw, CheckCircle2, ChevronRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import NeoDropdown from './NeoDropdown';
import Loader from './Loader';
import ExamTimer from './ExamTimer';
import ReportButton from './ReportButton';
import TTSPlayer from './TTSPlayer';
import { Card, SectionHeading, ErrorBanner, PrimaryButton, GhostButton, ResultRow, LevelBadge } from './ui';
import { getExercise } from '../services/examExerciseService';
import { checkListeningAnswers, getListeningScoreColor } from '../services/examUtils';
import { markExerciseSeen } from '../services/userService';

const CEFR_LEVELS = [
  { value: 'A1', label: 'A1 - Iniciante' },
  { value: 'A2', label: 'A2 - Elementar' },
  { value: 'B1', label: 'B1 - Interm\u00e9dio' },
  { value: 'B2', label: 'B2 - Independente' },
  { value: 'C1', label: 'C1 - Avan\u00e7ado' },
  { value: 'C2', label: 'C2 - Proficiente' },
];

const SUPPORTED_LANGS = ['pt-PT'];

const ListeningExercise = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const { user, setUser } = useAppContext();

  const targetLang = user?.learningDialect ?? 'pt-PT';
  const isLangSupported = SUPPORTED_LANGS.includes(targetLang);

  const [step, setStep] = useState('setup');
  const [level, setLevel] = useState('A1');
  const [exercise, setExercise] = useState(null);
  const [exerciseId, setExerciseId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);

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
        token: user.token, level, type: 'listening',
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
    const userAnswers = Object.entries(answers).map(([questionId, selectedAnswer]) => ({ questionId, selectedAnswer }));
    const res = checkListeningAnswers(userAnswers, exercise.questions);
    setResult(res);
    setStep('results');
    await markCurrentExerciseSeen();
  };

  const handleTryAgain = async () => {
    setExercise(null); setExerciseId(null); setAnswers({}); setResult(null); setError(null); setShowTranscript(false);
    await handleGetExercise();
  };

  const headerIcon = (
    <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-sky-400 flex items-center justify-center shrink-0">
      <Headphones size={18} className="text-slate-900" />
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
              {t('exam.listening', 'Listening Comprehension')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
        </div>
        <ErrorBanner error={error} isDarkMode={isDarkMode} />
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.select_level', 'Select your level')}</SectionHeading>
          <NeoDropdown options={CEFR_LEVELS} value={level} onChange={setLevel} isDarkMode={isDarkMode} className="w-full sm:w-64" />
        </Card>
        {!isLangSupported ? (
          <div className={`flex items-start gap-3 p-4 rounded-xl border-2 ${isDarkMode ? 'bg-amber-900/30 border-amber-700 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
            <p className="text-sm font-semibold">{t('exam.listening_lang_unsupported', 'Listening exercises are currently only available for pt-PT. Your learning language is {{lang}}.', { lang: targetLang })}</p>
          </div>
        ) : loading ? (
          <Loader isDarkMode={isDarkMode} message={t('exam.generating', 'Generating exercise...')} />
        ) : (
          <PrimaryButton onClick={handleGetExercise} isDarkMode={isDarkMode} color="sky">
            {t('exam.get_exercise', 'Get Exercise')} <ChevronRight size={16} />
          </PrimaryButton>
        )}
      </div>
    );
  }

  // Loading/error guards
  if (!exercise) {
    if (loading) return (<div className="flex flex-col gap-5"><Loader isDarkMode={isDarkMode} message={t('exam.generating', 'Generating exercise...')} />{error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}</div>);
    if (error) return (<div className="flex flex-col gap-5"><ErrorBanner error={error} isDarkMode={isDarkMode} /><PrimaryButton onClick={handleTryAgain} isDarkMode={isDarkMode} color="sky"><RotateCcw size={14} />{t('exam.try_again', 'Try Again')}</PrimaryButton></div>);
    return null;
  }

  // Listening step
  if (step === 'listening') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LevelBadge level={level} isDarkMode={isDarkMode} color="sky" />
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.listening', 'Listening Comprehension')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
        </div>
        <ErrorBanner error={error} isDarkMode={isDarkMode} />

        <div>
          <SectionHeading isDarkMode={isDarkMode}>{t('exam.audio', 'Audio')}</SectionHeading>
          <TTSPlayer text={exercise.transcript} lang={targetLang} isDarkMode={isDarkMode} />
        </div>

        <div>
          <button onClick={() => setShowTranscript((p) => !p)} className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`} aria-expanded={showTranscript}>
            {showTranscript ? <EyeOff size={14} /> : <Eye size={14} />}
            {showTranscript ? t('exam.hide_transcript', 'Hide Transcript') : t('exam.show_transcript', 'Show Transcript')}
          </button>
          {showTranscript && (
            <Card isDarkMode={isDarkMode} className="mt-3">
              <SectionHeading isDarkMode={isDarkMode}>{t('exam.transcript', 'Transcript')}</SectionHeading>
              <p className={`text-sm sm:text-base leading-relaxed font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{exercise.transcript}</p>
            </Card>
          )}
        </div>

        {exercise.instructions?.length > 0 && (
          <Card isDarkMode={isDarkMode}>
            <SectionHeading isDarkMode={isDarkMode}>{t('exam.instructions', 'Instructions')}</SectionHeading>
            <ul className="flex flex-col gap-1.5">
              {exercise.instructions.map((instr, i) => (
                <li key={i} className={`flex items-start gap-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? 'border-sky-600 text-sky-400' : 'border-sky-500 text-sky-600'}`}>{i + 1}</span>
                  {instr}
                </li>
              ))}
            </ul>
          </Card>
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
                  <span className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${isDarkMode ? 'border-sky-600 text-sky-400' : 'border-sky-500 text-sky-600'}`}>{i + 1}</span>
                  {q.text}
                </p>
                <div className="flex flex-col gap-2">
                  {q.options.map((option) => {
                    const isSelected = (answers[q.id] ?? null) === option;
                    return (
                      <button key={option} onClick={() => handleSelectAnswer(q.id, option)} className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${isSelected ? (isDarkMode ? 'bg-sky-900/40 border-sky-500 text-sky-300' : 'bg-sky-50 border-sky-500 text-sky-800') : (isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700/50' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}`}>
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
          <PrimaryButton onClick={handleCheckAnswers} isDarkMode={isDarkMode} disabled={!allAnswered} className="flex-1" color="sky">
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
    const scoreColor = getListeningScoreColor(result.score, result.maxScore, isDarkMode);

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LevelBadge level={level} isDarkMode={isDarkMode} color="sky" />
            <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {t('exam.results', 'Results')}
            </h2>
          </div>
          <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
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
              <ResultRow key={item.questionId} item={item} index={i} isDarkMode={isDarkMode} colorScheme="sky" />
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <GhostButton onClick={onBack} isDarkMode={isDarkMode} className="flex-1"><ArrowLeft size={14} />{t('common.back', 'Back')}</GhostButton>
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode} className="flex-1"><RotateCcw size={14} />{t('exam.try_again', 'Try Again')}</GhostButton>
        </div>
      </div>
    );
  }

  return null;
};

ListeningExercise.propTypes = { isDarkMode: PropTypes.bool.isRequired, onBack: PropTypes.func.isRequired };

export default ListeningExercise;