/**
 * ExerciseSidebar.jsx
 *
 * Collapsible sidebar for exam exercise pages (Reading, Listening, Writing).
 * Contains: level selector, exercise type selector (when applicable),
 * generate button, timer, reset button, and (after submit) score card.
 *
 * Responsive behavior:
 *   - Mobile: full-width bottom strip below content
 *   - Desktop (lg+): fixed sidebar on the left (w-64)
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
 *   // Reset props
 *   seenExerciseCount  number
 *   onReset            () => Promise<void>
 *   isResetting        boolean
 *   // Score props (optional — shown after submit)
 *   score            number        — correct answers / total score
 *   maxScore         number
 *   scoreColor       string        — Tailwind colour class
 *   // Writing-only score extras (optional)
 *   wordCount        number
 *   minWords         number
 *   maxWords         number
 *   wordCountPenalty number
 *   timerRef         ref
 */

import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ChevronRight, RotateCcw } from "lucide-react";
import NeoDropdown from "./NeoDropdown";
import ExamTimer from "./ExamTimer";
import ConfirmModal from "./ConfirmModal";

const READING_TYPES = [
  { value: "random", label: "Random" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "true-false", label: "True / False" },
  { value: "best-title", label: "Best Title" },
  { value: "ordering", label: "Ordering" },
  { value: "cloze", label: "Cloze" },
  { value: "fill-blanks", label: "Fill Blanks" },
  { value: "matching", label: "Matching" },
  { value: "notice-sign", label: "Notice / Sign" },
];

const LISTENING_TYPES = [
  { value: "random", label: "Random" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "true-false", label: "True / False" },
  { value: "fill-blanks", label: "Fill Blanks" },
];

const CEFR_LEVELS = [
  { value: "A1", label: "A1 - Iniciante" },
  { value: "A2", label: "A2 - Elementar" },
  { value: "B1", label: "B1 - Intermédio" },
  { value: "B2", label: "B2 - Independente" },
  { value: "C1", label: "C1 - Avançado" },
  { value: "C2", label: "C2 - Proficiente" },
];

const ExerciseSidebar = ({
  exerciseType,
  level,
  onLevelChange,
  questionType,
  onQuestionTypeChange,
  onGenerate,
  loading,
  isDarkMode,
  seenExerciseCount,
  onReset,
  isResetting,
  score,
  maxScore,
  scoreColor,
  wordCount,
  minWords,
  maxWords,
  wordCountPenalty,
  timerRef,
}) => {
  const { t } = useTranslation();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const typeOptions =
    exerciseType === "listening"
      ? LISTENING_TYPES
      : exerciseType === "reading"
        ? READING_TYPES
        : [];

  const panelBase = `rounded-2xl border-4 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
  }`;

  const labelClass = isDarkMode ? "text-slate-400" : "text-slate-500";

  const handleResetConfirm = async () => {
    if (!onReset) return;
    await onReset();
    setShowResetConfirm(false);
  };

  // ── Controls ───────────────────────────────────────────────────────────────
  const controls = (
    <>
      <NeoDropdown
        options={CEFR_LEVELS}
        value={level}
        onChange={onLevelChange}
        isDarkMode={isDarkMode}
        label={t("exam.sidebar.level", "Level")}
      />

      {exerciseType !== "writing" && typeOptions.length > 0 && (
        <NeoDropdown
          options={typeOptions}
          value={questionType}
          onChange={onQuestionTypeChange}
          isDarkMode={isDarkMode}
          label={t("exam.sidebar.type", "Type")}
        />
      )}

      <button
        onClick={onGenerate}
        disabled={loading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-4 font-black text-sm uppercase tracking-wide transition-all active:scale-[0.98] ${
          loading ? "opacity-50 cursor-not-allowed" : ""
        } ${
          isDarkMode
            ? "bg-slate-700 border-slate-600 text-white hover:bg-slate-600 shadow-[4px_4px_0px_0px_#1e293b]"
            : "bg-emerald-400 border-slate-900 text-slate-900 hover:bg-emerald-300 shadow-[4px_4px_0px_0px_#0f172a]"
        }`}
      >
        {t("exam.sidebar.generate", "Generate")} <ChevronRight size={16} />
      </button>

      <button
        onClick={() => setShowResetConfirm(true)}
        disabled={seenExerciseCount === 0 || isResetting}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-4 font-black text-sm uppercase tracking-wide transition-all active:scale-[0.98] ${
          seenExerciseCount === 0 || isResetting ? "opacity-50 cursor-not-allowed" : ""
        } ${
          isDarkMode
            ? "bg-slate-700 border-slate-600 text-white hover:bg-slate-600 shadow-[4px_4px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 text-slate-700 hover:bg-yellow-50 shadow-[3px_3px_0px_0px_#0f172a]"
        }`}
      >
        <RotateCcw size={14} />
        {t("exam.sidebar.reset_btn", "Reset Exercises")}
      </button>
    </>
  );

  // ── Timer ────────────────────────────────────────────────────────────────
  const timerSection = (
    <div className={`${panelBase} p-4`}>
      <p className={`text-xs font-black uppercase tracking-widest mb-3 ${labelClass}`}>
        {t("exam.timer", "Timer")}
      </p>
      <ExamTimer ref={timerRef} isDarkMode={isDarkMode} />
    </div>
  );

  // ── Score panel ──────────────────────────────────────────────────────────
  const hasScore = score != null && maxScore != null;

  // Word count status for writing
  const wordCountOk =
    wordCount != null &&
    minWords != null &&
    maxWords != null &&
    wordCount >= minWords &&
    wordCount <= maxWords;

  const wordCountColor =
    wordCount == null
      ? labelClass
      : wordCountOk
        ? isDarkMode
          ? "text-emerald-400"
          : "text-emerald-600"
        : isDarkMode
          ? "text-rose-400"
          : "text-rose-600";

  const scoreSection = hasScore && (
    <div className={`${panelBase} p-4 flex flex-col gap-3`}>
      <p className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>
        {t("exam.sidebar.score", "Score")}
      </p>

      {/* Big score number */}
      <p className={`text-4xl font-black tabular-nums leading-none ${
        scoreColor ?? (isDarkMode ? "text-white" : "text-slate-900")
      }`}>
        {score}
        <span className={`text-lg font-bold ${labelClass}`}>/{maxScore}</span>
      </p>

      {/* Percentage */}
      <p className={`text-xs font-bold ${labelClass}`}>
        {Math.round((score / maxScore) * 100)}%
      </p>

      {/* Writing extras */}
      {wordCount != null && (
        <div className={`pt-2 border-t-2 ${
          isDarkMode ? "border-slate-700" : "border-slate-200"
        } flex flex-col gap-1.5`}>
          <p className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>
            {t("exam.sidebar.word_count", "Words")}
          </p>
          <p className={`text-sm font-black tabular-nums ${wordCountColor}`}>
            {wordCount}
            <span className={`text-xs font-bold ${labelClass}`}>
              {" "}/{minWords}–{maxWords}
            </span>
          </p>
          {!wordCountOk && (
            <p className={`text-xs font-semibold ${
              isDarkMode ? "text-rose-400" : "text-rose-600"
            }`}>
              {wordCount < minWords
                ? t("exam.too_short", "too short")
                : t("exam.too_long", "too long")}
            </p>
          )}
          {wordCountPenalty != null && wordCountPenalty > 0 && (
            <p className={`text-xs font-semibold ${
              isDarkMode ? "text-rose-400" : "text-rose-600"
            }`}>
              -{wordCountPenalty} {t("exam.sidebar.penalty", "penalty")}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <>
      {showResetConfirm && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={t("exam.sidebar.reset_title", "Reset Exercises")}
          message={t(
            "exam.sidebar.reset_message",
            "This will clear all completed exercises, allowing you to see previously attempted exercises again.",
          )}
          warning={t("exam.sidebar.reset_warning", "⚠ This cannot be undone.")}
          confirmLabel={t("exam.sidebar.reset_confirm", "Yes, reset exercises")}
          confirmColor="yellow"
          isLoading={isResetting}
          onConfirm={handleResetConfirm}
          onCancel={() => !isResetting && setShowResetConfirm(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
        <div className={`${panelBase} p-4 flex items-center justify-between`}>
          <span className={`font-black uppercase text-xs tracking-widest ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            {t("exam.sidebar.settings", "Settings")}
          </span>
        </div>
        <div className={`${panelBase} p-4 flex flex-col gap-4`}>{controls}</div>
        {timerSection}
        {scoreSection}
      </aside>

      {/* Mobile bottom strip */}
      <div className={`lg:hidden order-last w-full ${panelBase} p-4 flex flex-col gap-4`}>
        {controls}
        {timerSection}
        {scoreSection}
      </div>
    </>
  );
};

ExerciseSidebar.propTypes = {
  exerciseType: PropTypes.oneOf(["reading", "listening", "writing"]).isRequired,
  level: PropTypes.string.isRequired,
  onLevelChange: PropTypes.func.isRequired,
  questionType: PropTypes.string,
  onQuestionTypeChange: PropTypes.func,
  onGenerate: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  seenExerciseCount: PropTypes.number,
  onReset: PropTypes.func,
  isResetting: PropTypes.bool,
  score: PropTypes.number,
  maxScore: PropTypes.number,
  scoreColor: PropTypes.string,
  wordCount: PropTypes.number,
  minWords: PropTypes.number,
  maxWords: PropTypes.number,
  wordCountPenalty: PropTypes.number,
  timerRef: PropTypes.shape({ current: PropTypes.object }),
};

ExerciseSidebar.defaultProps = {
  questionType: "random",
  onQuestionTypeChange: () => {},
  seenExerciseCount: 0,
  onReset: () => Promise.resolve(),
  isResetting: false,
  score: null,
  maxScore: null,
  scoreColor: null,
  wordCount: null,
  minWords: null,
  maxWords: null,
  wordCountPenalty: null,
  timerRef: { current: null },
};

export default ExerciseSidebar;
