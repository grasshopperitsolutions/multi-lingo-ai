/**
 * ExerciseSidebar.jsx
 *
 * Collapsible sidebar for exam exercise pages (Reading, Listening, Writing).
 * Contains: level selector, exercise type selector (when applicable),
 * generate button, timer, reset button, and optionally the TTS player (listening).
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
 *   seenExerciseCount  number      — number of seen exercises (disables button when 0)
 *   onReset            () => Promise<void>  — called when user confirms reset
 *   isResetting        boolean     — loading state during reset
 *   // Listening-only props (optional)
 *   transcript       string
 *   tone             string
 *   lang             string
 *   showTranscript   boolean
 *   onToggleTranscript () => void
 *   timerRef         ref
 */

import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ChevronRight, RotateCcw } from "lucide-react";
import NeoDropdown from "./NeoDropdown";
import ExamTimer from "./ExamTimer";
import TTSPlayer from "./TTSPlayer";
import ConfirmModal from "./ConfirmModal";

// ---------------------------------------------------------------------------
// Exercise type options
// ---------------------------------------------------------------------------

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
  seenExerciseCount,
  onReset,
  isResetting,
  transcript,
  tone,
  lang,
  showTranscript,
  onToggleTranscript,
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

  // ── Shared controls ──────────────────────────────────────────────────────
  const controls = (
    <>
      {/* Level */}
      <NeoDropdown
        options={CEFR_LEVELS}
        value={level}
        onChange={onLevelChange}
        isDarkMode={isDarkMode}
        label={t("exam.sidebar.level", "Level")}
      />

      {/* Exercise type (only for reading/listening) */}
      {exerciseType !== "writing" && typeOptions.length > 0 && (
        <NeoDropdown
          options={typeOptions}
          value={questionType}
          onChange={onQuestionTypeChange}
          isDarkMode={isDarkMode}
          label={t("exam.sidebar.type", "Type")}
        />
      )}

      {/* Generate button */}
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

      {/* Reset exercises button */}
      <button
        onClick={() => setShowResetConfirm(true)}
        disabled={seenExerciseCount === 0 || isResetting}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-4 font-black text-sm uppercase tracking-wide transition-all active:scale-[0.98] ${
          seenExerciseCount === 0 || isResetting
            ? "opacity-50 cursor-not-allowed"
            : ""
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
      <p
        className={`text-xs font-black uppercase tracking-widest mb-3 ${labelClass}`}
      >
        {t("exam.timer", "Timer")}
      </p>
      <ExamTimer ref={timerRef} isDarkMode={isDarkMode} />
    </div>
  );

  // ── TTS + Transcript (listening only) ────────────────────────────────────
  const ttsSection = exerciseType === "listening" && transcript && (
    <div className={`${panelBase} p-4 flex flex-col gap-3`}>
      <p
        className={`text-xs font-black uppercase tracking-widest ${labelClass}`}
      >
        {t("exam.audio", "Audio")}
      </p>
      <TTSPlayer text={transcript} lang={lang} isDarkMode={isDarkMode} />
      {tone && (
        <p className={`text-xs font-semibold italic ${labelClass}`}>{tone}</p>
      )}
      <button
        onClick={onToggleTranscript}
        className={`text-xs font-black uppercase tracking-widest transition-all hover:underline ${labelClass}`}
      >
        {showTranscript
          ? t("exam.hide_transcript", "Hide Transcript")
          : t("exam.show_transcript", "Show Transcript")}
      </button>
      {showTranscript && (
        <div
          className={`p-3 rounded-xl border-2 text-sm leading-relaxed font-medium ${isDarkMode ? "bg-slate-700 border-slate-600 text-slate-200" : "bg-slate-50 border-slate-300 text-slate-800"}`}
        >
          {transcript}
        </div>
      )}
    </div>
  );

  // ── Desktop sidebar ──────────────────────────────────────────────────────
  return (
    <>
      {/* Reset confirm modal */}
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

      <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
        {/* Header */}
        <div className={`${panelBase} p-4 flex items-center justify-between`}>
          <span
            className={`font-black uppercase text-xs tracking-widest ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            {t("exam.sidebar.settings", "Settings")}
          </span>
        </div>

        {/* Controls */}
        <div className={`${panelBase} p-4 flex flex-col gap-4`}>{controls}</div>

        {/* Timer */}
        {timerSection}

        {/* TTS + Transcript (listening only) */}
        {ttsSection}
      </aside>

      {/* Mobile bottom strip */}
      <div
        className={`lg:hidden order-last w-full ${panelBase} p-4 flex flex-col gap-4`}
      >
        {controls}
        {timerSection}
        {ttsSection}
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
  transcript: PropTypes.string,
  tone: PropTypes.string,
  lang: PropTypes.string,
  showTranscript: PropTypes.bool,
  onToggleTranscript: PropTypes.func,
  timerRef: PropTypes.shape({ current: PropTypes.object }),
};

ExerciseSidebar.defaultProps = {
  questionType: "random",
  onQuestionTypeChange: () => {},
  seenExerciseCount: 0,
  onReset: () => Promise.resolve(),
  isResetting: false,
  transcript: "",
  tone: "",
  lang: "pt-PT",
  showTranscript: false,
  onToggleTranscript: () => {},
  timerRef: { current: null },
};

export default ExerciseSidebar;
