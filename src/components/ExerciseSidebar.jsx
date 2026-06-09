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
 *
 *   // Full Exam props (all optional, ignored when examMode=false)
 *   examMode          bool
 *   examPhase         'generating'|'listening'|'reading'|'writing'|'results'
 *   examSession       object
 *   onExamGenerate    func
 *   onExamSectionChange func
 */

import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ChevronRight, RotateCcw, Headphones, BookOpen, PenLine, Play } from "lucide-react";
import NeoDropdown from "./NeoDropdown";
import ExamTimer from "./ExamTimer";
import ConfirmModal from "./ConfirmModal";
import { LevelBadge } from "./ui";

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
  // Standard props
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
  // Full Exam props
  examMode,
  examPhase,
  examSession,
  onExamGenerate,
  onExamSectionChange,
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

  // ── Exam Mode ───────────────────────────────────────────────────────────────
  if (examMode) {
    const phase = examPhase ?? "generating";
    const sessionLevel = examSession?.level ?? level;
    const listeningCount = examSession?.sections?.listening?.exercises?.length ?? 0;
    const readingCount = examSession?.sections?.reading?.exercises?.length ?? 0;
    const hasScores = examSession?.finalScores != null;
    const scores = examSession?.finalScores;

    const phaseLabel = {
      generating: t("exam.generating", "Generating..."),
      listening: t("exam.full.section_listening", "Listening"),
      reading: t("exam.full.section_reading", "Reading"),
      writing: t("exam.full.section_writing", "Writing"),
      results: t("exam.full.results_title", "Exam Results"),
    };

    // Count answered exercises per section
    const countAnswered = (sectionExercises) => {
      return (sectionExercises ?? []).filter((ex) => ex.answers && Object.keys(ex.answers).length > 0).length;
    };

    const listeningAnswered = countAnswered(examSession?.sections?.listening?.exercises);
    const readingAnswered = countAnswered(examSession?.sections?.reading?.exercises);

    const sidebarContent = (
      <div className={`${panelBase} p-4 flex flex-col gap-4`}>
        {/* Pre-generation: level selector + Generate Exam button */}
        {phase === "generating" && !examSession && (
          <>
            <NeoDropdown
              options={CEFR_LEVELS}
              value={level}
              onChange={onLevelChange}
              isDarkMode={isDarkMode}
              label={t("exam.sidebar.level", "Level")}
            />
            <button
              onClick={onExamGenerate}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-4 font-black text-sm uppercase tracking-wide transition-all active:scale-[0.98] ${
                isDarkMode
                  ? "bg-rose-600 border-rose-500 text-white hover:bg-rose-500 shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-rose-400 border-slate-900 text-slate-900 hover:bg-rose-300 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <Play size={14} /> {t("exam.full.generate_btn", "Generate Exam")}
            </button>
          </>
        )}

        {/* Generating phase: show message */}
        {phase === "generating" && examSession && (
          <p className={`text-xs font-semibold ${isDarkMode ? "text-sky-400" : "text-sky-600"}`}>
            {t("exam.generating", "Generating...")}
          </p>
        )}

        {/* Post-generation: Level badge (locked) + Section navigation */}
        {["listening", "reading", "writing"].includes(phase) && (
          <>
            <div className="flex items-center gap-2">
              <LevelBadge level={sessionLevel} isDarkMode={isDarkMode} color="rose" />
              <span className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>
                {phaseLabel[phase] ?? phase}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>
                {t("exam_exercises.text", "Sections")}
              </p>
              {/* Listening row */}
              <button
                onClick={() => onExamSectionChange?.("listening")}
                disabled={phase === "generating"}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                  phase === "listening"
                    ? isDarkMode
                      ? "border-sky-500 bg-sky-500/20 text-sky-300"
                      : "border-sky-500 bg-sky-50 text-sky-700"
                    : isDarkMode
                      ? "border-transparent text-slate-400 hover:bg-slate-700"
                      : "border-transparent text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Headphones size={14} />
                <span className="text-xs font-bold flex-1">{t("exam.full.section_listening", "Listening")}</span>
                <span className="text-xs font-black tabular-nums">
                  {Array.from({ length: listeningCount }, (_, i) => (
                    <span key={i} className={i < listeningAnswered ? "text-emerald-400" : "text-slate-500"}>
                      {i < listeningAnswered ? "\u25CF" : "\u25CB"}
                    </span>
                  ))}
                </span>
              </button>

              {/* Reading row */}
              <button
                onClick={() => onExamSectionChange?.("reading")}
                disabled={phase === "generating"}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                  phase === "reading"
                    ? isDarkMode
                      ? "border-teal-500 bg-teal-500/20 text-teal-300"
                      : "border-teal-500 bg-teal-50 text-teal-700"
                    : isDarkMode
                      ? "border-transparent text-slate-400 hover:bg-slate-700"
                      : "border-transparent text-slate-500 hover:bg-slate-100"
                }`}
              >
                <BookOpen size={14} />
                <span className="text-xs font-bold flex-1">{t("exam.full.section_reading", "Reading")}</span>
                <span className="text-xs font-black tabular-nums">
                  {Array.from({ length: readingCount }, (_, i) => (
                    <span key={i} className={i < readingAnswered ? "text-emerald-400" : "text-slate-500"}>
                      {i < readingAnswered ? "\u25CF" : "\u25CB"}
                    </span>
                  ))}
                </span>
              </button>

              {/* Writing row */}
              <button
                onClick={() => onExamSectionChange?.("writing")}
                disabled={phase === "generating"}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all ${
                  phase === "writing"
                    ? isDarkMode
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-amber-500 bg-amber-50 text-amber-700"
                    : isDarkMode
                      ? "border-transparent text-slate-400 hover:bg-slate-700"
                      : "border-transparent text-slate-500 hover:bg-slate-100"
                }`}
              >
                <PenLine size={14} />
                <span className="text-xs font-bold flex-1">{t("exam.full.section_writing", "Writing")}</span>
                <span className="text-xs font-black text-slate-500">&mdash;</span>
              </button>
            </div>
          </>
        )}

        {/* Timer */}
        <ExamTimer ref={timerRef} isDarkMode={isDarkMode} />
      </div>
    );

    // Score panel (only when results phase)
    const scorePanel = hasScores && scores && (
      <div className={`${panelBase} p-4 flex flex-col gap-3`}>
        <p className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>
          {t("exam.full.total_score", "Total Score")}
        </p>
        <p className={`text-4xl font-black tabular-nums leading-none ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          {scores.total}
          <span className={`text-lg font-bold ${labelClass}`}>/{scores.totalMax}</span>
        </p>
        <p className={`text-xs font-bold ${labelClass}`}>
          {scores.totalMax > 0 ? Math.round((scores.total / scores.totalMax) * 100) : 0}%
        </p>
        {/* Sub-scores */}
        <div className={`pt-2 border-t-2 ${isDarkMode ? "border-slate-700" : "border-slate-200"} flex flex-col gap-1.5`}>
          <div className="flex justify-between text-xs font-bold">
            <span className={isDarkMode ? "text-sky-400" : "text-sky-600"}>
              {t("exam.full.section_listening", "Listening")}:
            </span>
            <span className={labelClass}>{scores.listening}/{scores.listeningMax}</span>
          </div>
          <div className="flex justify-between text-xs font-bold">
            <span className={isDarkMode ? "text-teal-400" : "text-teal-600"}>
              {t("exam.full.section_reading", "Reading")}:
            </span>
            <span className={labelClass}>{scores.reading}/{scores.readingMax}</span>
          </div>
          <div className="flex justify-between text-xs font-bold">
            <span className={isDarkMode ? "text-amber-400" : "text-amber-600"}>
              {t("exam.full.section_writing", "Writing")}:
            </span>
            <span className={labelClass}>{scores.writing}/{scores.writingMax}</span>
          </div>
        </div>
      </div>
    );

    return (
      <>
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
          {sidebarContent}
          {scorePanel}
        </aside>

        {/* Mobile bottom strip */}
        <div className={`lg:hidden order-last w-full flex flex-col gap-4`}>
          {sidebarContent}
          {scorePanel}
        </div>
      </>
    );
  }

  // ── Standard (non-exam) Mode ──────────────────────────────────────────────
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

  // ── Timer — rendered directly, no outer card wrapper.
  // ExamTimer already renders its own rounded-2xl border-4 shadow card.
  const timerSection = (
    <ExamTimer ref={timerRef} isDarkMode={isDarkMode} />
  );

  // ── Score panel ──────────────────────────────────────────────────────────
  const hasScore = score != null && maxScore != null;

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
              /{minWords}–{maxWords}
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
  // Order: Settings header → Score (when available) → Controls → Timer
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
          warning={t("exam.sidebar.reset_warning", "\u26A0 This cannot be undone.")}
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
        {scoreSection}
        <div className={`${panelBase} p-4 flex flex-col gap-4`}>{controls}</div>
        {timerSection}
      </aside>

      {/* Mobile bottom strip */}
      <div className={`lg:hidden order-last w-full ${panelBase} p-4 flex flex-col gap-4`}>
        {scoreSection}
        {controls}
        {timerSection}
      </div>
    </>
  );
};

ExerciseSidebar.propTypes = {
  exerciseType: PropTypes.oneOf(["reading", "listening", "writing"]),
  level: PropTypes.string,
  onLevelChange: PropTypes.func,
  questionType: PropTypes.string,
  onQuestionTypeChange: PropTypes.func,
  onGenerate: PropTypes.func,
  loading: PropTypes.bool,
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
  // Full Exam props
  examMode: PropTypes.bool,
  examPhase: PropTypes.oneOf(["generating", "listening", "reading", "writing", "results"]),
  examSession: PropTypes.object,
  onExamGenerate: PropTypes.func,
  onExamSectionChange: PropTypes.func,
};

ExerciseSidebar.defaultProps = {
  exerciseType: "reading",
  level: "A1",
  onLevelChange: () => {},
  questionType: "random",
  onQuestionTypeChange: () => {},
  onGenerate: () => {},
  loading: false,
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
  // Full Exam defaults
  examMode: false,
  examPhase: "generating",
  examSession: null,
  onExamGenerate: () => {},
  onExamSectionChange: () => {},
};

export default ExerciseSidebar;