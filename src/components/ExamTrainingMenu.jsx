import { lazy, Suspense, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Headphones, BookOpen, PenLine, Mic, ClipboardList } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ReportButton from './ReportButton';
import { Breadcrumb } from './ui';

// ── Lazy-loaded exercise components ───────────────────────────────────────────
const ListeningExercise = lazy(() => import('./ListeningExercise'));
const ReadingExercise    = lazy(() => import('./ReadingExercise'));
const WritingExercise    = lazy(() => import('./WritingExercise'));

// ── Exercise Registry ─────────────────────────────────────────────────────────
const EXERCISES = [
  {
    id: 'listening',
    icon: Headphones,
    color: 'bg-sky-500',
    titleKey: 'exam.listening',
    descKey: 'exam.listening_desc',
    component: ListeningExercise,
    comingSoon: true,
  },
  {
    id: 'reading',
    icon: BookOpen,
    color: 'bg-emerald-500',
    titleKey: 'exam.reading',
    descKey: 'exam.reading_desc',
    component: ReadingExercise,
    comingSoon: false,
  },
  {
    id: 'writing',
    icon: PenLine,
    color: 'bg-teal-500',
    titleKey: 'exam.writing',
    descKey: 'exam.writing_desc',
    component: WritingExercise,
    comingSoon: false,
  },
  {
    id: 'speaking',
    icon: Mic,
    color: 'bg-purple-500',
    titleKey: 'exam.speaking',
    descKey: 'exam.speaking_desc',
    component: null,
    comingSoon: true,
  },
  {    
    id: "full_exam",
    icon: ClipboardList,
    color: "bg-rose-400",
    titleKey: "exam.full_exam",
    descKey: "exam.full_exam_desc",
    component: null,
    comingSoon: true,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const ExamCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, comingSoon, comingSoonLabel }) => (
  <button
    onClick={onClick}
    disabled={comingSoon}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      comingSoon
        ? 'opacity-60 cursor-not-allowed'
        : 'hover:-translate-y-1 active:scale-95'
    } ${
      isDarkMode
        ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
        : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
    }`}
  >
    {comingSoon && <StatusBadge label={comingSoonLabel} />}
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-slate-900" />
    </div>
    <div>
      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
        isDarkMode ? 'text-white' : 'text-slate-900'
      }`}>{title}</h3>
      <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
        isDarkMode ? 'text-slate-400' : 'text-slate-500'
      }`}>{description}</p>
    </div>
  </button>
);
ExamCard.propTypes = {
  title:           PropTypes.string.isRequired,
  description:     PropTypes.string.isRequired,
  icon:            PropTypes.elementType.isRequired,
  color:           PropTypes.string.isRequired,
  onClick:         PropTypes.func.isRequired,
  isDarkMode:      PropTypes.bool.isRequired,
  comingSoon:      PropTypes.bool,
  comingSoonLabel: PropTypes.string,
};

const ExerciseLoader = ({ isDarkMode }) => (
  <div className={`flex items-center justify-center py-16 ${
    isDarkMode ? 'text-slate-400' : 'text-slate-500'
  }`}>
    <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin border-current" />
  </div>
);
ExerciseLoader.propTypes = { isDarkMode: PropTypes.bool.isRequired };

// ── ExamTrainingMenu ──────────────────────────────────────────────────────────
const ExamTrainingMenu = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const [activeExercise, setActiveExercise] = useState(null);

  const handleExerciseSelect = (id) => setActiveExercise(id);
  const handleBackToMenu = () => setActiveExercise(null);

  const activeExerciseDef = activeExercise
    ? EXERCISES.find((e) => e.id === activeExercise)
    : null;

  // ── Active exercise view ──────────────────────────────────────────────────
  if (activeExerciseDef && !activeExerciseDef.comingSoon) {
    const ExerciseComponent = activeExerciseDef.component;
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumb
          isDarkMode={isDarkMode}
          accentColor="teal"
          items={[
            { label: t('common.back', 'Back'), onClick: onBack },
            { label: t('exam.training', 'Exam Training'), onClick: handleBackToMenu },
            { label: t(activeExerciseDef.titleKey) },
          ]}
        />
        <Suspense fallback={<ExerciseLoader isDarkMode={isDarkMode} />}>
          <ExerciseComponent isDarkMode={isDarkMode} onBack={handleBackToMenu} />
        </Suspense>
      </div>
    );
  }

  // ── Menu grid ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="teal"
        items={[{ label: t('common.back', 'Back'), onClick: onBack }]}
      />

      {/* Page title + report flag */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          {t('exam.training', 'Exam Training')}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="ExamTrainingMenu" />
      </div>

      <div className="grid grid-cols-1 gap-3 mt-2">
        {EXERCISES.map((ex) => (
          <ExamCard
            key={ex.id}
            title={t(ex.titleKey)}
            description={t(ex.descKey)}
            icon={ex.icon}
            color={ex.color}
            onClick={() => !ex.comingSoon && handleExerciseSelect(ex.id)}
            isDarkMode={isDarkMode}
            comingSoon={ex.comingSoon}
            comingSoonLabel={t('challenges.coming_soon', 'Coming Soon')}
          />
        ))}
      </div>
    </div>
  );
};

ExamTrainingMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack:     PropTypes.func.isRequired,
};

export default ExamTrainingMenu;