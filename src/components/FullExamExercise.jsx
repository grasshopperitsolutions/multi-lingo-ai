/**
 * FullExamExercise.jsx
 *
 * Single-file orchestrator for the Full Exam feature.
 * Contains 8 local sub-components plus the default export FullExamExercise.
 *
 * Phases: generating → listening → reading → writing → results
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ClipboardList, ChevronLeft, ChevronRight, Check, Loader as LoaderIcon } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import ExerciseSidebar from "./ExerciseSidebar";
import Loader from "./Loader";
import ReportButton from "./ReportButton";
import ConfirmModal from "./ConfirmModal";
import TTSPlayer from "./TTSPlayer";
import {
  MultipleChoiceExercise,
  TrueFalseExercise,
  FillBlanksExercise,
  MatchingExercise,
  ImageMultipleChoiceExercise,
  BestTitleExercise,
  OrderingExercise,
  ClozeExercise,
} from "./exercises";
import {
  Card,
  SectionHeading,
  PrimaryButton,
  GhostButton,
  LevelBadge,
  CollapsibleCard,
  ExamScoreCard,
} from "./ui";
import { getExercise } from "../services/examExerciseService";
import { evaluateWriting } from "../services/examWritingExerciseService";
import { getScoreColor } from "../services/examUtils";

// ── Constants ─────────────────────────────────────────────────────────────────
const EXAM_STRUCTURE = {
  A1: {
    listening: [
      { type: "image-multiple-choice", maxScore: 4 },
      { type: "true-false", maxScore: 4 },
      { type: "multiple-choice", maxScore: 3 },
    ],
    reading: [
      { type: "true-false", maxScore: 4 },
      { type: "best-title", maxScore: 2 },
      { type: "multiple-choice", maxScore: 3 },
      { type: "fill-blanks", maxScore: 4 },
    ],
    writing: { minWords: 40, maxWords: 60, maxScore: 10 },
  },
  A2: {
    listening: [
      { type: "fill-blanks", maxScore: 5 },
      { type: "matching", maxScore: 5 },
      { type: "true-false", maxScore: 4 },
      { type: "multiple-choice", maxScore: 3 },
    ],
    reading: [
      { type: "true-false", maxScore: 5 },
      { type: "matching", maxScore: 4 },
      { type: "multiple-choice", maxScore: 4 },
      { type: "fill-blanks", maxScore: 5 },
    ],
    writing: { minWords: 60, maxWords: 80, maxScore: 15 },
  },
  B1: {
    listening: [
      { type: "fill-blanks", maxScore: 6 },
      { type: "matching", maxScore: 5 },
      { type: "multiple-choice", maxScore: 4 },
      { type: "true-false", maxScore: 4 },
    ],
    reading: [
      { type: "true-false", maxScore: 6 },
      { type: "multiple-choice", maxScore: 5 },
      { type: "ordering", maxScore: 5 },
      { type: "cloze", maxScore: 8 },
      { type: "fill-blanks", maxScore: 5 },
    ],
    writing: { minWords: 100, maxWords: 120, maxScore: 20 },
  },
  B2: {
    listening: [
      { type: "fill-blanks", maxScore: 6 },
      { type: "true-false", maxScore: 6 },
      { type: "multiple-choice", maxScore: 5 },
      { type: "matching", maxScore: 5 },
    ],
    reading: [
      { type: "true-false", maxScore: 6 },
      { type: "multiple-choice", maxScore: 5 },
      { type: "ordering", maxScore: 6 },
      { type: "cloze", maxScore: 10 },
      { type: "fill-blanks", maxScore: 6 },
    ],
    writing: { minWords: 130, maxWords: 160, maxScore: 25 },
  },
};

const GENERATION_STEPS = [
  { key: "reading_level", i18nKey: "exam.full.gen_step_level" },
  { key: "listening", i18nKey: "exam.full.gen_step_listening" },
  { key: "reading", i18nKey: "exam.full.gen_step_reading" },
  { key: "writing", i18nKey: "exam.full.gen_step_writing" },
  { key: "done", i18nKey: "exam.full.gen_step_done" },
];

// ── Local Sub-Components ──────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// ExamGenerationStep — single animated step row (spinner → checkmark)
// ═══════════════════════════════════════════════════════════════════════════════
const ExamGenerationStep = ({ label, status, isDarkMode }) => {
  const isDone = status === "done";
  const isLoading = status === "loading";

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="w-6 h-6 shrink-0 flex items-center justify-center">
        {isDone ? (
          <Check size={18} className="text-emerald-400 animate-[scale-in_0.2s_ease-out]" />
        ) : isLoading ? (
          <div className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${
            isDarkMode ? "border-sky-400" : "border-sky-600"
          }`} />
        ) : (
          <div className={`w-4 h-4 rounded-full border-2 ${
            isDarkMode ? "border-slate-600" : "border-slate-300"
          }`} />
        )}
      </div>
      <span className={`text-sm font-bold ${
        isDone
          ? isDarkMode ? "text-emerald-400" : "text-emerald-600"
          : isLoading
            ? isDarkMode ? "text-sky-400" : "text-sky-600"
            : isDarkMode ? "text-slate-500" : "text-slate-400"
      }`}>
        {label}
      </span>
    </div>
  );
};

ExamGenerationStep.propTypes = {
  label: PropTypes.string.isRequired,
  status: PropTypes.oneOf(["pending", "loading", "done", "error"]).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ExamGenerationLoader — full step list during generation phase
// ═══════════════════════════════════════════════════════════════════════════════
const ROTATING_KEYS = [
  "exam.full.gen_step_listening",
  "exam.full.gen_step_reading",
  "exam.full.gen_step_writing",
  "exam.full.gen_step_done",
];

const ExamGenerationLoader = ({ steps, isDarkMode }) => {
  const { t } = useTranslation();
  const [rotatingIndex, setRotatingIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotatingIndex((prev) => (prev + 1) % ROTATING_KEYS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card isDarkMode={isDarkMode}>
        <SectionHeading isDarkMode={isDarkMode}>
          <span className="flex items-center gap-2">
            <LoaderIcon size={16} className="animate-spin" />
            Generating Your Exam...
          </span>
        </SectionHeading>
        <div className="flex flex-col gap-1 mt-4">
          {steps.map((step) => (
            <ExamGenerationStep
              key={step.key}
              label={t(step.i18nKey)}
              status={step.status}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      </Card>
      <Card isDarkMode={isDarkMode}>
        <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t(ROTATING_KEYS[rotatingIndex])}
        </p>
        <div className="mt-3">
          <Loader isDarkMode={isDarkMode} message="" />
        </div>
      </Card>
    </div>
  );
};

ExamGenerationLoader.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      i18nKey: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
    })
  ).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ExamExerciseStepper — horizontal dots/tabs for within-section navigation
// ═══════════════════════════════════════════════════════════════════════════════
const ExamExerciseStepper = ({ total, activeIndex, onSelect, answeredSet, isDarkMode }) => {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === activeIndex;
        const isAnswered = answeredSet.has(i);
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`w-8 h-8 rounded-xl border-2 font-black text-xs transition-all active:scale-90 ${
              isActive
                ? isDarkMode
                  ? "border-sky-400 bg-sky-400/20 text-sky-400"
                  : "border-sky-600 bg-sky-100 text-sky-600"
                : isAnswered
                  ? isDarkMode
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                    : "border-emerald-600 bg-emerald-50 text-emerald-600"
                  : isDarkMode
                    ? "border-slate-600 text-slate-400 hover:border-slate-500"
                    : "border-slate-300 text-slate-500 hover:border-slate-400"
            }`}
          >
            {isAnswered ? <Check size={14} /> : i + 1}
          </button>
        );
      })}
    </div>
  );
};

ExamExerciseStepper.propTypes = {
  total: PropTypes.number.isRequired,
  activeIndex: PropTypes.number.isRequired,
  onSelect: PropTypes.func.isRequired,
  answeredSet: PropTypes.instanceOf(Set).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ExamListeningSection — renders N listening exercises sequentially
// ═══════════════════════════════════════════════════════════════════════════════
const EXAM_TYPE_MAP = {
  "multiple-choice": MultipleChoiceExercise,
  "true-false": TrueFalseExercise,
  "fill-blanks": FillBlanksExercise,
  matching: MatchingExercise,
  "image-multiple-choice": ImageMultipleChoiceExercise,
};

const ExamListeningSection = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { examSession, updateExamSection } = useAppContext();
  const exercises = useMemo(() => examSession?.sections?.listening?.exercises ?? [], [examSession]);
  const [activeIndex, setActiveIndex] = useState(0);

  const current = exercises[activeIndex];
  const exerciseData = current?.exercise ?? {};

  const handleAnswer = (questionId, option) => {
    const newAnswers = { ...(current.answers ?? {}), [questionId]: option };
    const updatedExercises = [...exercises];
    updatedExercises[activeIndex] = { ...current, answers: newAnswers };
    updateExamSection("listening", { exercises: updatedExercises });
  };

  const targetLang = exerciseData.targetLang ?? "pt-PT";
  const ExerciseComponent = EXAM_TYPE_MAP[exerciseData.questionType || exerciseData.exerciseType];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LevelBadge level={examSession?.level ?? "A1"} isDarkMode={isDarkMode} color="sky" />
          <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {t("exam.full.section_listening", "Listening")}
          </h2>
        </div>
        <ExamExerciseStepper
          total={exercises.length}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          answeredSet={new Set(exercises.map((ex, i) => (ex.answers && Object.keys(ex.answers).length > 0 ? i : -1)).filter((i) => i >= 0))}
          isDarkMode={isDarkMode}
        />
      </div>

      {exerciseData.transcript && (
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t("exam.audio", "Audio")}</SectionHeading>
          <TTSPlayer text={exerciseData.transcript} lang={targetLang} isDarkMode={isDarkMode} />
        </Card>
      )}

      {exerciseData.instructions?.length > 0 && (
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t("exam.instructions", "Instructions")}</SectionHeading>
          <ul className="flex flex-col gap-1.5 mt-3">
            {exerciseData.instructions.map((instr, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? "border-sky-600 text-sky-400" : "border-sky-500 text-sky-600"}`}>
                  {i + 1}
                </span>
                {instr}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!ExerciseComponent ? (
        <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("common.error", "Unsupported exercise type")}
        </p>
      ) : (
        <ExerciseComponent
          passage={exerciseData.passage}
          questions={exerciseData.questions}
          statements={exerciseData.questions}
          blanks={exerciseData.blanks ?? []}
          wordBank={exerciseData.wordBank ?? []}
          pairs={exerciseData.questions}
          matches={current.answers ?? {}}
          answers={current.answers ?? {}}
          onAnswer={handleAnswer}
          onMatch={handleAnswer}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

ExamListeningSection.propTypes = { isDarkMode: PropTypes.bool.isRequired };

// ═══════════════════════════════════════════════════════════════════════════════
// ExamReadingSection — renders N reading exercises sequentially
// ═══════════════════════════════════════════════════════════════════════════════
const EXAM_READING_TYPE_MAP = {
  "multiple-choice": MultipleChoiceExercise,
  "true-false": TrueFalseExercise,
  "best-title": BestTitleExercise,
  ordering: OrderingExercise,
  cloze: ClozeExercise,
  "fill-blanks": FillBlanksExercise,
  matching: MatchingExercise,
};

const ExamReadingSection = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { examSession, updateExamSection } = useAppContext();
  const exercises = examSession?.sections?.reading?.exercises ?? [];
  const [activeIndex, setActiveIndex] = useState(0);

  const current = exercises[activeIndex];
  const exerciseData = current?.exercise ?? {};

  const handleAnswer = (questionId, option) => {
    const newAnswers = { ...(current.answers ?? {}), [questionId]: option };
    const updatedExercises = [...exercises];
    updatedExercises[activeIndex] = { ...current, answers: newAnswers };
    updateExamSection("reading", { exercises: updatedExercises });
  };

  const ExerciseComponent = EXAM_READING_TYPE_MAP[exerciseData.questionType || exerciseData.exerciseType];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LevelBadge level={examSession?.level ?? "A1"} isDarkMode={isDarkMode} color="teal" />
          <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {t("exam.full.section_reading", "Reading")}
          </h2>
        </div>
        <ExamExerciseStepper
          total={exercises.length}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          answeredSet={new Set(exercises.map((ex, i) => (ex.answers && Object.keys(ex.answers).length > 0 ? i : -1)).filter((i) => i >= 0))}
          isDarkMode={isDarkMode}
        />
      </div>

      {exerciseData.instructions?.length > 0 && (
        <Card isDarkMode={isDarkMode}>
          <SectionHeading isDarkMode={isDarkMode}>{t("exam.instructions", "Instructions")}</SectionHeading>
          <ul className="flex flex-col gap-1.5 mt-3">
            {exerciseData.instructions.map((instr, i) => (
              <li key={i} className={`flex items-start gap-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? "border-teal-600 text-teal-400" : "border-teal-500 text-teal-600"}`}>
                  {i + 1}
                </span>
                {instr}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!ExerciseComponent ? (
        <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("common.error", "Unsupported exercise type")}
        </p>
      ) : (
        <ExerciseComponent
          passage={exerciseData.passage}
          questions={exerciseData.questions}
          statements={exerciseData.questions}
          titles={exerciseData.titles}
          blanks={exerciseData.blanks ?? []}
          wordBank={exerciseData.wordBank ?? []}
          pairs={exerciseData.questions}
          answers={current.answers ?? {}}
          matches={current.answers ?? {}}
          userOrder={current.answers?.ordering ?? []}
          selectedId={current.answers?.bestTitle ?? null}
          onAnswer={handleAnswer}
          onMatch={handleAnswer}
          onSelect={(id) => handleAnswer("bestTitle", id)}
          onReorder={(newOrder) => {
            const newAnswers = { ...(current.answers ?? {}), ordering: newOrder };
            const updatedExercises = [...exercises];
            updatedExercises[activeIndex] = { ...current, answers: newAnswers };
            updateExamSection("reading", { exercises: updatedExercises });
          }}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
};

ExamReadingSection.propTypes = { isDarkMode: PropTypes.bool.isRequired };

// ═══════════════════════════════════════════════════════════════════════════════
// ExamWritingSection — writing task UI, synced to context
// ═══════════════════════════════════════════════════════════════════════════════
const ExamWritingSection = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { examSession, updateExamSection } = useAppContext();
  const writing = examSession?.sections?.writing ?? {};
  const exercise = writing.exercise ?? {};
  const userText = writing.userText ?? "";
  const minWords = exercise?.minWords ?? 100;
  const maxWords = exercise?.maxWords ?? 120;

  const wordCount = userText.trim()
    ? userText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const wordCountColor = () => {
    if (wordCount === 0) return isDarkMode ? "text-slate-500" : "text-slate-400";
    if (wordCount < minWords || wordCount > maxWords)
      return isDarkMode ? "text-rose-400" : "text-rose-600";
    return isDarkMode ? "text-emerald-400" : "text-emerald-600";
  };

  const handleChange = (e) => {
    updateExamSection("writing", { userText: e.target.value });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <LevelBadge level={examSession?.level ?? "A1"} isDarkMode={isDarkMode} color="amber" />
        <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          {t("exam.full.section_writing", "Writing")}
        </h2>
      </div>

      <Card isDarkMode={isDarkMode}>
        <SectionHeading isDarkMode={isDarkMode}>{t("exam.task", "Your Task")}</SectionHeading>
        <p className={`text-sm sm:text-base font-semibold leading-relaxed mt-3 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
          {exercise.prompt}
        </p>
        {exercise.instructions?.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-3">
            {exercise.instructions.map((instr, i) => (
              <li key={i} className={`flex items-start gap-2 text-sm ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? "border-teal-600 text-teal-400" : "border-teal-500 text-teal-600"}`}>
                  {i + 1}
                </span>
                {instr}
              </li>
            ))}
          </ul>
        )}
        <p className={`mt-3 text-xs font-semibold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {t("exam.word_count_target", "Target: {{min}}\u2013{{max}} words", { min: minWords, max: maxWords })}
        </p>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <SectionHeading isDarkMode={isDarkMode}>{t("exam.your_text", "Your Text")}</SectionHeading>
          <span className={`text-xs font-black tabular-nums ${wordCountColor()}`}>
            {wordCount} {t("exam.words", "words")}
            {wordCount > 0 && (wordCount < minWords || wordCount > maxWords) && (
              <span className="ml-1 opacity-75">
                ({wordCount < minWords ? t("exam.too_short", "too short") : t("exam.too_long", "too long")})
              </span>
            )}
          </span>
        </div>
        <textarea
          value={userText}
          onChange={handleChange}
          placeholder={t("exam.textarea_placeholder", "Escreve o teu texto aqui...")}
          rows={10}
          className={`w-full rounded-xl border-4 p-4 font-medium text-sm leading-relaxed resize-y focus:outline-none focus:ring-0 transition-colors ${
            isDarkMode
              ? "bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-teal-500"
              : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-teal-600"
          }`}
          aria-label={t("exam.your_text", "Your Text")}
        />
      </div>
    </div>
  );
};

ExamWritingSection.propTypes = { isDarkMode: PropTypes.bool.isRequired };

// ═══════════════════════════════════════════════════════════════════════════════
// ExamNavFooter — bottom nav: prev/next exercise + section advance
// ═══════════════════════════════════════════════════════════════════════════════
const ExamNavFooter = ({ phase, isDarkMode, onNextSection, onPrevExercise, onNextExercise, onSubmitExam, exerciseIndex, totalExercises }) => {
  const { t } = useTranslation();
  const isFirst = exerciseIndex === 0;
  const isLast = exerciseIndex === totalExercises - 1;

  return (
    <div className={`sticky bottom-0 z-10 -mx-5 px-5 py-4 border-t-4 ${
      isDarkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
    }`}>
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <GhostButton onClick={onPrevExercise} isDarkMode={isDarkMode} disabled={isFirst}>
          <ChevronLeft size={16} /> {t("common.back", "Back")}
        </GhostButton>

        <span className={`text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("exam.full.exercise_of", "Exercise {{n}} of {{total}}", { n: exerciseIndex + 1, total: totalExercises })}
        </span>

        {isLast ? (
          phase === "writing" ? (
            <PrimaryButton onClick={onSubmitExam} isDarkMode={isDarkMode} color="rose">
              {t("exam.full.submit_exam", "Submit Full Exam")}
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={onNextSection} isDarkMode={isDarkMode} color="teal">
              {phase === "listening"
                ? t("exam.full.finish_listening", "Finish Listening")
                : t("exam.full.finish_reading", "Finish Reading")}{" "}
              <ChevronRight size={16} />
            </PrimaryButton>
          )
        ) : (
          <PrimaryButton onClick={onNextExercise} isDarkMode={isDarkMode}>
            {t("common.next", "Next")} <ChevronRight size={16} />
          </PrimaryButton>
        )}
      </div>
    </div>
  );
};

ExamNavFooter.propTypes = {
  phase: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  onNextSection: PropTypes.func.isRequired,
  onPrevExercise: PropTypes.func.isRequired,
  onNextExercise: PropTypes.func.isRequired,
  onSubmitExam: PropTypes.func.isRequired,
  exerciseIndex: PropTypes.number.isRequired,
  totalExercises: PropTypes.number.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ParameterRow — rubric row used in writing results (copied from WritingExercise)
// ═══════════════════════════════════════════════════════════════════════════════
const PARAM_NAME_KEYS = {
  A: "exam.param_a_name",
  B: "exam.param_b_name",
  C: "exam.param_c_name",
  D: "exam.param_d_name",
  E: "exam.param_e_name",
};

const ParameterRow = ({ param, isDarkMode, paramLabel }) => {
  const [expanded, setExpanded] = useState(false);
  const scoreColor = getScoreColor(param.score, param.maxScore, isDarkMode);

  return (
    <button
      onClick={() => setExpanded((p) => !p)}
      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${isDarkMode ? "border-slate-700 hover:bg-slate-700/50" : "border-slate-200 hover:bg-slate-50"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 w-7 h-7 rounded-lg border-2 flex items-center justify-center font-black text-xs ${isDarkMode ? "border-slate-600 bg-slate-700 text-white" : "border-slate-300 bg-slate-100 text-slate-900"}`}>
            {param.id}
          </span>
          <span className={`font-bold text-sm truncate ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
            {paramLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`font-black text-sm tabular-nums ${scoreColor}`}>
            {param.score}
            <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>/{param.maxScore}</span>
          </span>
          <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""} ${isDarkMode ? "text-slate-500" : "text-slate-400"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </div>
      {expanded && (
        <p className={`mt-2 text-sm leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
          {param.feedback}
        </p>
      )}
    </button>
  );
};

ParameterRow.propTypes = {
  param: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    score: PropTypes.number.isRequired,
    maxScore: PropTypes.number.isRequired,
    feedback: PropTypes.string.isRequired,
  }).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  paramLabel: PropTypes.string.isRequired,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ExamResultsPanel — final scores + per-section breakdowns
// ═══════════════════════════════════════════════════════════════════════════════
const ExamResultsPanel = ({ isDarkMode, onStartNewExam }) => {
  const { t } = useTranslation();
  const { examSession, setExamSession } = useAppContext();
  const scores = examSession?.finalScores;
  const writingData = examSession?.sections?.writing;

  if (!scores) {
    return (
      <Card isDarkMode={isDarkMode}>
        <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("common.error", "No results available")}
        </p>
      </Card>
    );
  }

  const totalColor = getScoreColor(scores.total, scores.totalMax, isDarkMode);
  const listeningColor = getScoreColor(scores.listening, scores.listeningMax, isDarkMode);
  const readingColor = getScoreColor(scores.reading, scores.readingMax, isDarkMode);
  const writingColor = getScoreColor(scores.writing, scores.writingMax, isDarkMode);

  const handleNewExam = () => {
    setExamSession(null);
    onStartNewExam?.();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          {t("exam.full.results_title", "Exam Results")}
        </h2>
        <ReportButton isDarkMode={isDarkMode} context="FullExamResults" />
      </div>

      {/* Total Score */}
      <div className={`rounded-2xl border-4 p-6 text-center ${
        isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
      }`}>
        <p className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("exam.full.total_score", "Total Score")}
        </p>
        <p className={`text-5xl font-black tabular-nums ${totalColor}`}>
          {scores.total}
          <span className={`text-xl font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>/{scores.totalMax}</span>
        </p>
        <p className={`text-sm font-bold mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {scores.totalMax > 0 ? Math.round((scores.total / scores.totalMax) * 100) : 0}%
        </p>
      </div>

      {/* Per-section Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ExamScoreCard
          title={t("exam.full.section_listening", "Listening")}
          score={scores.listening}
          maxScore={scores.listeningMax}
          scoreColor={listeningColor}
          isDarkMode={isDarkMode}
        />
        <ExamScoreCard
          title={t("exam.full.section_reading", "Reading")}
          score={scores.reading}
          maxScore={scores.readingMax}
          scoreColor={readingColor}
          isDarkMode={isDarkMode}
        />
        <ExamScoreCard
          title={t("exam.full.section_writing", "Writing")}
          score={scores.writing}
          maxScore={scores.writingMax}
          scoreColor={writingColor}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Writing rubric */}
      {writingData?.evaluation?.parameters && (
        <CollapsibleCard title={t("exam.breakdown", "Score Breakdown")} isDarkMode={isDarkMode} defaultOpen={false}>
          <div className="flex flex-col gap-2 mt-3">
            {writingData.evaluation.parameters.map((param) => (
              <ParameterRow
                key={param.id}
                param={param}
                isDarkMode={isDarkMode}
                paramLabel={t(PARAM_NAME_KEYS[param.id], param.name)}
              />
            ))}
          </div>
        </CollapsibleCard>
      )}

      <GhostButton onClick={handleNewExam} isDarkMode={isDarkMode}>
        {t("exam.full.start_new", "Start New Exam")}
      </GhostButton>
    </div>
  );
};

ExamResultsPanel.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onStartNewExam: PropTypes.func,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Default Export — FullExamExercise
// ═══════════════════════════════════════════════════════════════════════════════
const FullExamExercise = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const { user, examSession, setExamSession, updateExamSection, showAlert } = useAppContext();

  const [genSteps, setGenSteps] = useState(
    GENERATION_STEPS.map((s) => ({ ...s, status: "pending" }))
  );
  const [generating, setGenerating] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const timerRef = useRef(null);

  const phase = examSession?.phase ?? "generating";
  const level = examSession?.level ?? "A1";

  const updateStep = useCallback((key, status) => {
    setGenSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status } : s))
    );
  }, []);

  // ── Generate Exam ───────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!user?.token) return;
    setGenerating(true);
    setExamSession((prev) => ({ ...prev, phase: "generating" }));
    setGenSteps(GENERATION_STEPS.map((s) => ({ ...s, status: "pending" })));

    const struct = EXAM_STRUCTURE[level] ?? EXAM_STRUCTURE.A1;
    const sections = { listening: { exercises: [], activeIndex: 0 }, reading: { exercises: [], activeIndex: 0 }, writing: { exercise: null, userText: "", evaluation: null } };

    try {
      // Step 1: Reading level
      updateStep("reading_level", "loading");
      await new Promise((r) => setTimeout(r, 800));
      updateStep("reading_level", "done");

      // Step 2: Generate listening exercises
      updateStep("listening", "loading");
      for (const slot of struct.listening) {
        try {
          const res = await getExercise({
            token: user.token,
            level,
            type: "listening",
            questionType: slot.type,
            targetLang: user.learningDialect || "pt-PT",
            userDialect: user.interfaceLang || "en-US",
            seenExerciseIds: [],
          });
          sections.listening.exercises.push({
            exercise: res.content,
            exerciseId: res.exerciseId,
            answers: {},
            result: null,
          });
        } catch {
          // If one fails, skip it
        }
      }
      updateStep("listening", "done");

      // Step 3: Generate reading exercises
      updateStep("reading", "loading");
      await new Promise((r) => setTimeout(r, 300));
      for (const slot of struct.reading) {
        try {
          const res = await getExercise({
            token: user.token,
            level,
            type: "reading",
            questionType: slot.type,
            targetLang: user.learningDialect || "pt-PT",
            userDialect: user.interfaceLang || "en-US",
            seenExerciseIds: [],
          });
          sections.reading.exercises.push({
            exercise: res.content,
            exerciseId: res.exerciseId,
            answers: {},
            result: null,
          });
        } catch {
          // skip
        }
      }
      updateStep("reading", "done");

      // Step 4: Generate writing exercise
      updateStep("writing", "loading");
      await new Promise((r) => setTimeout(r, 300));
      try {
        const res = await getExercise({
          token: user.token,
          level,
          type: "writing",
          targetLang: user.learningDialect || "pt-PT",
          userDialect: user.interfaceLang || "en-US",
          seenExerciseIds: [],
        });
        sections.writing.exercise = res.content;
      } catch {
        // skip
      }
      updateStep("writing", "done");

      // Step 5: Done
      updateStep("done", "loading");
      await new Promise((r) => setTimeout(r, 500));
      updateStep("done", "done");

      setExamSession({
        level,
        phase: "listening",
        sections,
        finalScores: null,
      });
      setExerciseIndex(0);
    } catch {
      showAlert("error", t("common.error", "Failed to generate exam. Please try again."));
    } finally {
      setGenerating(false);
    }
  }, [user, level, setExamSession, updateStep, showAlert, t]);

  // ── Section navigation ──────────────────────────────────────────────────────
  const getSectionExercises = (sectionName) => {
    return examSession?.sections?.[sectionName]?.exercises ?? [];
  };

  const currentSectionExercises =
    phase === "listening"
      ? getSectionExercises("listening")
      : phase === "reading"
        ? getSectionExercises("reading")
        : [];

  const totalInSection = currentSectionExercises.length;

  const handlePrevExercise = () => {
    if (exerciseIndex > 0) setExerciseIndex((i) => i - 1);
  };

  const handleNextExercise = () => {
    if (exerciseIndex < totalInSection - 1) setExerciseIndex((i) => i + 1);
  };

  const handleNextSection = () => {
    setExerciseIndex(0);
    if (phase === "listening") {
      setExamSession((prev) => ({ ...prev, phase: "reading" }));
    } else if (phase === "reading") {
      setExamSession((prev) => ({ ...prev, phase: "writing" }));
    }
  };

  const handleSectionChange = (section) => {
    setExerciseIndex(0);
    setExamSession((prev) => ({ ...prev, phase: section }));
  };

  // ── Score exam ──────────────────────────────────────────────────────────────
  const scoreSectionExercises = (sectionName, exercises) => {
    let total = 0;
    let maxTotal = 0;
    const struct = EXAM_STRUCTURE[level] ?? EXAM_STRUCTURE.A1;
    const slots = struct[sectionName] ?? [];

    exercises.forEach((ex, i) => {
      const slot = slots[i];
      const slotMax = slot?.maxScore ?? 0;
      const exerciseData = ex.exercise ?? {};
      const answers = ex.answers ?? {};

      // Count correct answers
      if (exerciseData.questionType === "best-title") {
        const titles = exerciseData.titles ?? [];
        const correctTitle = titles.find((t) => t.isCorrect);
        if (correctTitle && answers.bestTitle === correctTitle.id) {
          total += slotMax;
        }
      } else if (exerciseData.questionType === "ordering") {
        const order = answers.ordering ?? [];
        const items = exerciseData.questions ?? [];
        const correct = items.filter((item) => {
          const userPos = order.indexOf(item.id);
          return userPos >= 0 && userPos + 1 === item.correctPosition;
        }).length;
        const ratio = items.length > 0 ? correct / items.length : 0;
        total += Math.round(ratio * slotMax);
      } else if (exerciseData.blanks?.length) {
        const blanks = exerciseData.blanks ?? [];
        const correct = blanks.filter((b) => answers[b.id] === b.correctAnswer).length;
        const ratio = blanks.length > 0 ? correct / blanks.length : 0;
        total += Math.round(ratio * slotMax);
      } else if (exerciseData.questions?.length) {
        const questions = exerciseData.questions ?? [];
        const correct = questions.filter((q) => answers[q.id] === q.correctAnswer).length;
        const ratio = questions.length > 0 ? correct / questions.length : 0;
        total += Math.round(ratio * slotMax);
      }
      maxTotal += slotMax;
    });

    return { score: total, maxScore: maxTotal };
  };

  const handleSubmitExam = async () => {
    setShowSubmitConfirm(false);
    setSubmitting(true);

    try {
      const listeningScore = scoreSectionExercises("listening", examSession?.sections?.listening?.exercises ?? []);
      const readingScore = scoreSectionExercises("reading", examSession?.sections?.reading?.exercises ?? []);

      // Evaluate writing
      let writingScore = { score: 0, maxScore: 0 };
      const writingSection = examSession?.sections?.writing;
      const writingStruct = (EXAM_STRUCTURE[level] ?? EXAM_STRUCTURE.A1).writing;

      if (writingSection?.userText?.trim() && writingSection?.exercise?.prompt) {
        try {
          const evalResult = await evaluateWriting({
            token: user.token,
            level,
            targetLang: user.learningDialect || "pt-PT",
            interfaceLang: user.interfaceLang || "en-US",
            exercisePrompt: writingSection.exercise.prompt,
            userText: writingSection.userText,
          });
          writingScore = { score: evalResult.totalScore ?? 0, maxScore: evalResult.maxScore ?? writingStruct.maxScore };
          updateExamSection("writing", { evaluation: evalResult });
        } catch {
          writingScore = { score: 0, maxScore: writingStruct.maxScore };
        }
      } else {
        writingScore = { score: 0, maxScore: writingStruct.maxScore };
      }

      const totalScore = listeningScore.score + readingScore.score + writingScore.score;
      const totalMax = listeningScore.maxScore + readingScore.maxScore + writingScore.maxScore;

      setExamSession((prev) => ({
        ...prev,
        phase: "results",
        finalScores: {
          listening: listeningScore.score,
          listeningMax: listeningScore.maxScore,
          reading: readingScore.score,
          readingMax: readingScore.maxScore,
          writing: writingScore.score,
          writingMax: writingScore.maxScore,
          total: totalScore,
          totalMax,
        },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Pre-generation: show Generate button state ─────────────────────────────
  if (phase === "generating" && !generating && !examSession) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          examMode={true}
          examPhase="generating"
          examSession={examSession}
          onExamGenerate={handleGenerate}
          onExamSectionChange={handleSectionChange}
          isDarkMode={isDarkMode}
          timerRef={timerRef}
        />
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl border-4 border-slate-900 bg-rose-400 flex items-center justify-center shrink-0">
            <ClipboardList size={28} className="text-slate-900" />
          </div>
          <h2 className={`text-2xl sm:text-4xl font-black uppercase tracking-tighter text-center ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {t("exam.full_exam", "Full Exam")}
          </h2>
          <p className={`text-sm font-semibold text-center max-w-md ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t("exam.full_exam_desc", "Simulate a complete certification exam session")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showSubmitConfirm && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={t("exam.full.submit_confirm_title", "Submit Your Exam?")}
          message={t("exam.full.submit_confirm_message", "Once submitted, your answers will be locked and scored.")}
          confirmLabel={t("exam.full.submit_exam", "Submit Full Exam")}
          confirmColor="rose"
          isLoading={submitting}
          onConfirm={handleSubmitExam}
          onCancel={() => setShowSubmitConfirm(false)}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          examMode={true}
          examPhase={phase}
          examSession={examSession}
          onExamGenerate={handleGenerate}
          onExamSectionChange={handleSectionChange}
          isDarkMode={isDarkMode}
          timerRef={timerRef}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {phase === "generating" && (
            <ExamGenerationLoader steps={genSteps} isDarkMode={isDarkMode} />
          )}

          {phase === "listening" && (
            <ExamListeningSection isDarkMode={isDarkMode} />
          )}

          {phase === "reading" && (
            <ExamReadingSection isDarkMode={isDarkMode} />
          )}

          {phase === "writing" && (
            <ExamWritingSection isDarkMode={isDarkMode} />
          )}

          {phase === "results" && (
            <ExamResultsPanel isDarkMode={isDarkMode} onStartNewExam={onBack} />
          )}

          {["listening", "reading"].includes(phase) && totalInSection > 0 && (
            <ExamNavFooter
              phase={phase}
              isDarkMode={isDarkMode}
              onNextSection={handleNextSection}
              onPrevExercise={handlePrevExercise}
              onNextExercise={handleNextExercise}
              onSubmitExam={() => setShowSubmitConfirm(true)}
              exerciseIndex={exerciseIndex}
              totalExercises={totalInSection}
            />
          )}

          {phase === "writing" && (
            <ExamNavFooter
              phase="writing"
              isDarkMode={isDarkMode}
              onNextSection={handleNextSection}
              onPrevExercise={() => {}}
              onNextExercise={() => {}}
              onSubmitExam={() => setShowSubmitConfirm(true)}
              exerciseIndex={0}
              totalExercises={1}
            />
          )}
        </div>
      </div>
    </>
  );
};

FullExamExercise.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack: PropTypes.func,
};

export default FullExamExercise;