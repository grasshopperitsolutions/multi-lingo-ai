import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Headphones, CheckCircle2, RotateCcw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import ExerciseSidebar from "./ExerciseSidebar";
import Loader from "./Loader";
import ReportButton from "./ReportButton";
import FillBlanksExercise from "./exercises/FillBlanksExercise";
import {
  Card,
  SectionHeading,
  ErrorBanner,
  PrimaryButton,
  GhostButton,
  ResultRow,
  LevelBadge,
  CollapsibleCard,
} from "./ui";
import { getExercise } from "../services/examExerciseService";
import {
  checkListeningAnswers,
  getListeningScoreColor,
} from "../services/examUtils";
import { markExerciseSeen, resetSeenExercises } from "../services/userService";

const ListeningExercise = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, setUser, showAlert } = useAppContext();

  const targetLang = user?.learningDialect ?? "pt-PT";

  const [level, setLevel] = useState("A1");
  const [questionType, setQuestionType] = useState("random");
  const [exercise, setExercise] = useState(null);
  const [exerciseId, setExerciseId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const timerRef = useRef(null);

  const isFillBlanks = exercise?.exerciseType === "fill-blanks";

  const allAnswered = isFillBlanks
    ? exercise?.blanks?.length > 0 &&
      exercise.blanks.every((b) => answers[b.id] != null)
    : exercise?.questions?.length > 0 &&
      exercise.questions.every((q) => answers[q.id] != null);

  const markCurrentExerciseSeen = async () => {
    if (!exerciseId || !user?.token || !user?.uid) return;
    const currentSeen = user.seenExerciseIds?.listening ?? [];
    await markExerciseSeen(user.token, user.uid, "listening", exerciseId, currentSeen);
    setUser((prev) => ({
      ...prev,
      seenExerciseIds: {
        ...prev.seenExerciseIds,
        listening: [...new Set([...currentSeen, exerciseId])],
      },
    }));
  };

  const handleGetExercise = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await getExercise({
        token: user.token,
        level,
        type: "listening",
        questionType: questionType === "random" ? undefined : questionType,
        targetLang: user.learningDialect || "pt-PT",
        userDialect: user.interfaceLang || "en-US",
        seenExerciseIds: user.seenExerciseIds?.listening ?? [],
      });
      setExercise(res.content);
      setExerciseId(res.exerciseId);
      setAnswers({});
      setResult(null);
      setError(null);
      setShowTranscript(false);
      timerRef.current?.reset();
      timerRef.current?.start();
    } catch (err) {
      const errorMessage =
        err.message ??
        t("common.error", "Something went wrong. Please try again.");
      setError(errorMessage);
      showAlert("error", errorMessage, {
        label: t("common.try_again", "Try Again"),
        onClick: handleGetExercise,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleCheckAnswers = async () => {
    if (isFillBlanks) {
      if (!exercise?.blanks?.length) return;
      const blankQuestions = exercise.blanks.map((b) => ({
        id: b.id,
        text: b.correctAnswer,
        correctAnswer: b.correctAnswer,
      }));
      const userAnswers = exercise.blanks.map((b) => ({
        questionId: b.id,
        selectedAnswer: answers[b.id] || "",
      }));
      const res = checkListeningAnswers(userAnswers, blankQuestions);
      setResult(res);
    } else {
      if (!exercise?.questions) return;
      const userAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({ questionId, selectedAnswer }),
      );
      const res = checkListeningAnswers(userAnswers, exercise.questions);
      setResult(res);
    }
    await markCurrentExerciseSeen();
  };

  // Resets answer state so the user can attempt the same exercise again.
  // Does NOT fetch a new exercise — exercise + exerciseId are intentionally kept.
  const handleTryAgain = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    timerRef.current?.reset();
    timerRef.current?.start();
  };

  const seenExerciseCount = (user.seenExerciseIds?.listening ?? []).length;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetSeenExercises(user.token, user.uid, "listening");
      setUser((prev) => ({
        ...prev,
        seenExerciseIds: { ...prev.seenExerciseIds, listening: [] },
      }));
      setExercise(null);
      setExerciseId(null);
      setAnswers({});
      setResult(null);
      setShowTranscript(false);
      setError(null);
      timerRef.current?.reset();
    } finally {
      setIsResetting(false);
    }
  };

  const headerIcon = (
    <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-sky-400 flex items-center justify-center shrink-0">
      <Headphones size={18} className="text-slate-900" />
    </div>
  );

  // Loading guard
  if (!exercise && loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          exerciseType="listening"
          level={level}
          onLevelChange={setLevel}
          questionType={questionType}
          onQuestionTypeChange={setQuestionType}
          onGenerate={handleGetExercise}
          loading={loading}
          isDarkMode={isDarkMode}
          timerRef={timerRef}
          seenExerciseCount={seenExerciseCount}
          onReset={handleReset}
          isResetting={isResetting}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <Loader
            isDarkMode={isDarkMode}
            message={t("exam.generating", "Generating exercise...")}
            fullScreen={true}
          />
          {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}
        </div>
      </div>
    );
  }

  // Error guard — exercise failed to load; Try Again fetches a new exercise
  if (!exercise && error) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          exerciseType="listening"
          level={level}
          onLevelChange={setLevel}
          questionType={questionType}
          onQuestionTypeChange={setQuestionType}
          onGenerate={handleGetExercise}
          loading={loading}
          isDarkMode={isDarkMode}
          timerRef={timerRef}
          seenExerciseCount={seenExerciseCount}
          onReset={handleReset}
          isResetting={isResetting}
        />
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <ErrorBanner error={error} isDarkMode={isDarkMode} />
          <PrimaryButton onClick={handleGetExercise} isDarkMode={isDarkMode}>
            <RotateCcw size={14} /> {t("common.try_again", "Try Again")}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // Main listening view
  if (exercise && !result) {
    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          exerciseType="listening"
          level={level}
          onLevelChange={setLevel}
          questionType={questionType}
          onQuestionTypeChange={setQuestionType}
          onGenerate={handleGetExercise}
          loading={loading}
          isDarkMode={isDarkMode}
          timerRef={timerRef}
          seenExerciseCount={seenExerciseCount}
          onReset={handleReset}
          isResetting={isResetting}
          transcript={exercise.transcript}
          tone={exercise.tone}
          lang={targetLang}
          showTranscript={showTranscript}
          onToggleTranscript={() => setShowTranscript((p) => !p)}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LevelBadge level={level} isDarkMode={isDarkMode} color="sky" />
              <h2
                className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
              >
                {t("exam.listening", "Listening Comprehension")}
              </h2>
            </div>
            <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
          </div>
          <ErrorBanner error={error} isDarkMode={isDarkMode} />

          {/* Instructions */}
          {exercise.instructions?.length > 0 && (
            <Card isDarkMode={isDarkMode}>
              <SectionHeading isDarkMode={isDarkMode}>
                {t("exam.instructions", "Instructions")}
              </SectionHeading>
              <ul className="flex flex-col gap-1.5">
                {exercise.instructions.map((instr, i) => (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-xs ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${isDarkMode ? "border-sky-600 text-sky-400" : "border-sky-500 text-sky-600"}`}
                    >
                      {i + 1}
                    </span>
                    {instr}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Comprehension Questions */}
          <div>
            <SectionHeading isDarkMode={isDarkMode}>
              {t("exam.comprehension_questions", "Comprehension Questions")}
            </SectionHeading>
            {isFillBlanks ? (
              <FillBlanksExercise
                passage={exercise.passage}
                wordBank={exercise.wordBank}
                blanks={exercise.blanks}
                answers={answers}
                onAnswer={handleSelectAnswer}
                isDarkMode={isDarkMode}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {exercise.questions.map((q, i) => (
                  <div
                    key={q.id}
                    className={`rounded-2xl border-4 p-4 sm:p-5 ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
                  >
                    <p
                      className={`text-sm sm:text-base font-bold mb-3 ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}
                    >
                      <span
                        className={`inline-flex w-6 h-6 rounded-full border-2 items-center justify-center text-xs font-black mr-2 shrink-0 ${isDarkMode ? "border-sky-600 text-sky-400" : "border-sky-500 text-sky-600"}`}
                      >
                        {i + 1}
                      </span>
                      {q.text}
                    </p>
                    <div className="flex flex-col gap-2">
                      {q.options.map((option) => {
                        const isSelected = (answers[q.id] ?? null) === option;
                        return (
                          <button
                            key={option}
                            onClick={() => handleSelectAnswer(q.id, option)}
                            className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-[0.98] ${isSelected ? (isDarkMode ? "bg-sky-900/40 border-sky-500 text-sky-300" : "bg-sky-50 border-sky-500 text-sky-800") : isDarkMode ? "border-slate-600 text-slate-300 hover:bg-slate-700/50" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p
            className={`text-xs font-semibold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
          >
            {Object.keys(answers).length} /{" "}
            {isFillBlanks ? exercise.blanks.length : exercise.questions.length}{" "}
            {t("exam.questions_answered", "questions answered")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryButton
              onClick={handleCheckAnswers}
              isDarkMode={isDarkMode}
              disabled={!allAnswered}
              className="flex-1"
              color="sky"
            >
              <CheckCircle2 size={16} />{" "}
              {t("exam.check_answers", "Check My Answers")}
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  if (result) {
    const scoreColor = getListeningScoreColor(
      result.score,
      result.maxScore,
      isDarkMode,
    );

    return (
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          exerciseType="listening"
          level={level}
          onLevelChange={setLevel}
          questionType={questionType}
          onQuestionTypeChange={setQuestionType}
          onGenerate={handleGetExercise}
          loading={loading}
          isDarkMode={isDarkMode}
          timerRef={timerRef}
          seenExerciseCount={seenExerciseCount}
          onReset={handleReset}
          isResetting={isResetting}
          transcript={exercise?.transcript}
          tone={exercise?.tone}
          lang={targetLang}
          showTranscript={showTranscript}
          onToggleTranscript={() => setShowTranscript((p) => !p)}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LevelBadge level={level} isDarkMode={isDarkMode} color="sky" />
              <h2
                className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
              >
                {t("exam.results", "Results")}
              </h2>
            </div>
            <ReportButton isDarkMode={isDarkMode} context="ListeningExercise" />
          </div>

          {/* Collapsible: transcript */}
          {exercise?.transcript && (
            <CollapsibleCard
              title={t("exam.transcript", "Transcript")}
              isDarkMode={isDarkMode}
              defaultOpen={false}
            >
              <p
                className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
              >
                {exercise.transcript}
              </p>
            </CollapsibleCard>
          )}

          {/* Collapsible: user's answers summary */}
          <CollapsibleCard
            title={t("exam.your_answers", "Your Answers")}
            isDarkMode={isDarkMode}
            defaultOpen={false}
          >
            <div className="flex flex-col gap-2 mt-3">
              {result.breakdown.map((item, i) => (
                <div
                  key={item.questionId}
                  className={`rounded-xl border-2 px-4 py-3 ${isDarkMode ? "border-slate-700 bg-slate-800/50" : "border-slate-200 bg-slate-50"}`}
                >
                  <p
                    className={`text-xs font-semibold mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {i + 1}. {item.question}
                  </p>
                  <p
                    className={`text-sm font-bold ${item.isCorrect ? (isDarkMode ? "text-sky-400" : "text-sky-700") : (isDarkMode ? "text-rose-400" : "text-rose-600")}`}
                  >
                    {item.userAnswer ?? t("exam.no_answer", "No answer")}
                  </p>
                  {!item.isCorrect && (
                    <p
                      className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {t("exam.correct_answer", "Correct")}: {item.correctAnswer}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleCard>

          {/* Score card */}
          <Card isDarkMode={isDarkMode}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-black uppercase tracking-widest mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                >
                  {t("exam.score", "Score")}
                </p>
                <p
                  className={`text-5xl font-black tabular-nums leading-none ${scoreColor}`}
                >
                  {result.score}
                  <span
                    className={`text-2xl ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
                  >
                    /{result.maxScore}
                  </span>
                </p>
                <p
                  className={`text-xs font-semibold mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
                >
                  {result.percentage}%
                </p>
              </div>
              <CheckCircle2 size={48} className={scoreColor} />
            </div>
          </Card>

          <div>
            <SectionHeading isDarkMode={isDarkMode}>
              {t("exam.breakdown", "Score Breakdown")}
            </SectionHeading>
            <div className="flex flex-col gap-2">
              {result.breakdown.map((item, i) => (
                <ResultRow
                  key={item.questionId}
                  item={item}
                  index={i}
                  isDarkMode={isDarkMode}
                  colorScheme="sky"
                />
              ))}
            </div>
          </div>

          {/* Try Again — resets state, same exercise */}
          <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
            <RotateCcw size={14} /> {t("exam.try_again", "Try Again")}
          </GhostButton>
        </div>
      </div>
    );
  }

  // Initial state
  return (
    <div className="flex flex-col lg:flex-row gap-5">
      <ExerciseSidebar
        exerciseType="listening"
        level={level}
        onLevelChange={setLevel}
        questionType={questionType}
        onQuestionTypeChange={setQuestionType}
        onGenerate={handleGetExercise}
        loading={loading}
        isDarkMode={isDarkMode}
        timerRef={timerRef}
        seenExerciseCount={seenExerciseCount}
        onReset={handleReset}
        isResetting={isResetting}
      />
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 mb-4">
          {headerIcon}
          <h2
            className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            {t("exam.listening", "Listening Comprehension")}
          </h2>
        </div>
        <p
          className={`text-sm font-semibold text-center ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
        >
          {t("exam.language_note_dynamic", "Exercise is in {{lang}}.", {
            lang: user?.learningDialect || "pt-PT",
          })}
        </p>
      </div>
    </div>
  );
};

ListeningExercise.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ListeningExercise;
