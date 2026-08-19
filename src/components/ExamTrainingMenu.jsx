import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTierAccess } from '../hooks/useTierAccess';
import { FEATURE_STATUS, PURCHASABLE_STATUSES, getStatusBadge } from '../utils/featureAccess';
import { Headphones, BookOpen, PenLine, ClipboardList, Lock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import ReportButton from './ReportButton';
import { Breadcrumb } from './ui';

// ── Exercise Registry ─────────────────────────────────────────────────────────
const EXERCISES = [
  {
    id: 'listening',
    featureKey: 'exam_listening',
    route: '/dashboard/exam-training/listening',
    icon: Headphones,
    color: 'bg-sky-500',
    titleKey: 'exam.listening',
    descKey: 'exam.listening_desc',
  },
  {
    id: 'reading',
    featureKey: 'exam_reading',
    route: '/dashboard/exam-training/reading',
    icon: BookOpen,
    color: 'bg-emerald-500',
    titleKey: 'exam.reading',
    descKey: 'exam.reading_desc',
  },
  {
    id: 'writing',
    featureKey: 'exam_writing',
    route: '/dashboard/exam-training/writing',
    icon: PenLine,
    color: 'bg-teal-500',
    titleKey: 'exam.writing',
    descKey: 'exam.writing_desc',
  },
  {
    id: "full_exam",
    featureKey: "full_exam",
    route: '/dashboard/exam-training/full-exam',
    icon: ClipboardList,
    color: "bg-rose-400",
    titleKey: "exam.full_exam",
    descKey: "exam.full_exam_desc",
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const ExamCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, locked, badgeLabel }) => (
  <button
    onClick={onClick}
    disabled={locked}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      locked
        ? 'opacity-60 cursor-not-allowed'
        : 'hover:-translate-y-1 active:scale-95'
    } ${
      isDarkMode
        ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
        : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
    }`}
  >
    {badgeLabel && <StatusBadge label={badgeLabel} />}
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
  locked:          PropTypes.bool,
  badgeLabel:      PropTypes.string,
};

// ── ExamTrainingMenu ──────────────────────────────────────────────────────────
const ExamTrainingMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { featureStatus, isReady } = useTierAccess();

  // Access comes from appConfig/config/tiersConfig (Admin > Tiers & Features),
  // so locking or releasing an exercise is a config change, not a code change.
  const exerciseCards = isReady
    ? EXERCISES.map((ex) => {
        const status = featureStatus(ex.featureKey);
        const badge = getStatusBadge(status);
        return {
          ...ex,
          status,
          badgeLabel: badge && t(badge.key, badge.fallback),
          locked:
            status !== FEATURE_STATUS.AVAILABLE && !PURCHASABLE_STATUSES.includes(status),
        };
      })
    : [];

  const handleExerciseSelect = (ex) => {
    if (PURCHASABLE_STATUSES.includes(ex.status)) {
      navigate('/pricing');
      return;
    }
    if (ex.locked) return;
    navigate(ex.route);
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="teal"
        items={[{ label: t('common.back', 'Back'), onClick: () => navigate('/dashboard') }]}
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
        {exerciseCards.map((ex) => (
          <ExamCard
            key={ex.id}
            title={t(ex.titleKey)}
            description={t(ex.descKey)}
            icon={ex.status === FEATURE_STATUS.AVAILABLE ? ex.icon : Lock}
            color={ex.color}
            onClick={() => handleExerciseSelect(ex)}
            isDarkMode={isDarkMode}
            locked={ex.locked}
            badgeLabel={ex.badgeLabel}
          />
        ))}
      </div>
    </div>
  );
};

ExamTrainingMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ExamTrainingMenu;
