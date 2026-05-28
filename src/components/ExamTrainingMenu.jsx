import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Headphones, PenLine, BookOpen, ClipboardList } from "lucide-react";
import StatusBadge from "./StatusBadge";
import ReportButton from "./ReportButton";
import WritingExercise from "./WritingExercise";

// ── Exercise Registry ─────────────────────────────────────────────────────────
const EXERCISES = [
  {
    id: "listening",
    icon: Headphones,
    color: "bg-sky-400",
    titleKey: "exam.listening",
    descKey: "exam.listening_desc",
    comingSoon: true,
  },
  {
    id: "writing",
    icon: PenLine,
    color: "bg-amber-400",
    titleKey: "exam.writing",
    descKey: "exam.writing_desc",
    comingSoon: true,
  },
  {
    id: "reading",
    icon: BookOpen,
    color: "bg-emerald-400",
    titleKey: "exam.reading",
    descKey: "exam.reading_desc",
    comingSoon: true,
  },
  {
    id: "full_exam",
    icon: ClipboardList,
    color: "bg-rose-400",
    titleKey: "exam.full_exam",
    descKey: "exam.full_exam_desc",
    comingSoon: true,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const Breadcrumb = ({ isDarkMode, onBackToDashboard, onBackToMenu, currentViewLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <button
        onClick={onBackToDashboard}
        className={`flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
          isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft size={14} />
        <span className="hidden xs:inline">{t("dashboard.back")}</span>
      </button>
      <span className={isDarkMode ? "text-slate-600" : "text-slate-400"}>/</span>
      {currentViewLabel ? (
        <>
          <button
            onClick={onBackToMenu}
            className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
              isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t("exam.title")}
          </button>
          <span className={isDarkMode ? "text-slate-600" : "text-slate-400"}>/</span>
          <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
            isDarkMode ? "text-teal-400" : "text-teal-600"
          }`}>
            {currentViewLabel}
          </span>
        </>
      ) : (
        <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
          isDarkMode ? "text-teal-400" : "text-teal-600"
        }`}>
          {t("exam.title")}
        </span>
      )}
    </div>
  );
};
Breadcrumb.propTypes = {
  isDarkMode:        PropTypes.bool.isRequired,
  onBackToDashboard: PropTypes.func.isRequired,
  onBackToMenu:      PropTypes.func.isRequired,
  currentViewLabel:  PropTypes.string,
};
Breadcrumb.defaultProps = {
  currentViewLabel: undefined,
};

const ExerciseCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, comingSoon, comingSoonLabel }) => (
  <button
    onClick={onClick}
    disabled={comingSoon}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      comingSoon
        ? "opacity-60 cursor-not-allowed"
        : "hover:-translate-y-1 active:scale-95"
    } ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    {comingSoon && <StatusBadge label={comingSoonLabel} />}
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-slate-900" />
    </div>
    <div>
      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>{title}</h3>
      <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>{description}</p>
    </div>
  </button>
);
ExerciseCard.propTypes = {
  title:           PropTypes.string.isRequired,
  description:     PropTypes.string.isRequired,
  icon:            PropTypes.elementType.isRequired,
  color:           PropTypes.string.isRequired,
  onClick:         PropTypes.func.isRequired,
  isDarkMode:      PropTypes.bool.isRequired,
  comingSoon:      PropTypes.bool,
  comingSoonLabel: PropTypes.string,
};
ExerciseCard.defaultProps = {
  comingSoon:      false,
  comingSoonLabel: "",
};

// ── ExamTrainingMenu ──────────────────────────────────────────────────────────
const ExamTrainingMenu = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const [activeExercise, setActiveExercise] = useState(null);

  const handleBackToMenu = () => setActiveExercise(null);

  const activeExerciseMeta = EXERCISES.find((e) => e.id === activeExercise);

  // ── Render active exercise ─────────────────────────────────────────────────
  const renderExercise = () => {
    switch (activeExercise) {
      case "writing":
        return (
          <>
            <Breadcrumb
              isDarkMode={isDarkMode}
              onBackToDashboard={onBack}
              onBackToMenu={handleBackToMenu}
              currentViewLabel={t(activeExerciseMeta?.titleKey)}
            />
            <WritingExercise
              isDarkMode={isDarkMode}
              onBack={handleBackToMenu}
            />
          </>
        );
      default:
        return null;
    }
  };

  // ── Active exercise view ───────────────────────────────────────────────────
  if (activeExercise) {
    return (
      <div className="flex flex-col gap-4">
        {renderExercise()}
      </div>
    );
  }

  // ── Menu grid ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        onBackToDashboard={onBack}
        onBackToMenu={handleBackToMenu}
        currentViewLabel={undefined}
      />

      {/* Page title + report flag */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          {t("exam.title")}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="ExamTrainingMenu" />
      </div>

      <div className="grid grid-cols-1 gap-3 mt-2">
        {EXERCISES.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            title={t(exercise.titleKey)}
            description={t(exercise.descKey)}
            icon={exercise.icon}
            color={exercise.color}
            onClick={() => setActiveExercise(exercise.id)}
            isDarkMode={isDarkMode}
            comingSoon={exercise.comingSoon}
            comingSoonLabel={t("challenges.coming_soon")}
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
