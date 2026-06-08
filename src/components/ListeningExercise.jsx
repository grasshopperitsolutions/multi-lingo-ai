import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Headphones, CheckCircle2, RotateCcw } from "lucide-react";
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
} from "./exercises";
import {
  Card,
  SectionHeading,
  ErrorBanner,
  PrimaryButton,
  GhostButton,
  LevelBadge,
  CollapsibleCard,
} from "./ui";
import { getExercise } from "../services/examExerciseService";
import {
  checkListeningAnswers,
  getListeningScoreColor,
} from "../services/examUtils";
import { markExerciseSeen, resetSeenExercises } from "../services/userService";
import useGenerateConfirm from "../hooks/useGenerateConfirm";

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
  const timerRef = useRef(null);

  const {
    showConfirm: showNewExerciseConfirm,
    onGenerateClick,
    handleConfirm: handleConfirmNewExercise,
    handleCancel: handleCancelNewExercise,
  } = useGenerateConfirm(exercise !== null);

  const exerciseType = exercise?.exerciseType;

  const allAnswered = (() => {
    if (!exercise) return false;
    if (exerciseType === "fill-blanks")
      return (
        exercise.blanks?.length > 0 &&
        exercise.blanks.every((b) => answers[b.id] != null)
      );
    // multiple-choice and true-false both use exercise.questions
    return (
      exercise.questions?.length > 0 &&
      exercise.questions.every((q) => answers[q.id] != null)
    );
  })();

  const markCurrentExerciseSeen = async () => {
    if (!exerciseId || !user?.token || !user?.uid) return;
    const currentSeen = user.seenExerciseIds?.listening ?? [];
    await markExerciseSeen(
      user.token,
      user.uid,
      "listening",
      exerciseId,
      currentSeen,
    );
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
    if (!exercise) return;

    if (exerciseType === "fill-blanks") {
      if (!exercise.blanks?.length) return;
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
      // multiple-choice and true-false
      if (!exercise.questions?.length) return;
      const userAnswers = Object.entries(answers).map(
        ([questionId, selectedAnswer]) => ({ questionId, selectedAnswer }),
      );
      const res = checkListeningAnswers(userAnswers, exercise.questions);
      setResult(res);
    }

    timerRef.current?.stop();
    await markCurrentExerciseSeen();
  };

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
      setError(null);
      timerRef.current?.reset();
    } finally {
      setIsResetting(false);
    }
  };

  const handleNewExercise = () => {
    setExercise(null);
    setExerciseId(null);
    setAnswers({});
    setResult(null);
    setError(null);
    timerRef.current?.reset();
    handleGetExercise();
  };

  const handleGenerateWrapper = () => {
    onGenerateClick(handleGetExercise);
  };

  const headerIcon = (
    <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-sky-400 flex items-center justify-center shrink-0">
      <Headphones size={18} className="text-slate-900" />
    </div>
  );

  const newExerciseModal = showNewExerciseConfirm ? (
    <ConfirmModal
      isDarkMode={isDarkMode}
      title={t("exam.sidebar.new_exercise_title", "New Exercise")}
      message={t(
        "exam.sidebar.new_exercise_message",
        "You have an exercise in progress. Generating a new one will discard your current work.",
      )}
      warning={t(
        "exam.sidebar.new_exercise_warning",
        "⚠ This cannot be undone.",
      )}
      confirmLabel={t(
        "exam.sidebar.new_exercise_confirm",
        "Yes, generate new exercise",
      )}
      confirmColor="yellow"
      isLoading={loading}
      onConfirm={() => handleConfirmNewExercise(handleNewExercise)}
      onCancel={handleCancelNewExercise}
    />
  ) : null;

  // ── Shared: Audio player card ──────────────────────────────────────────────
  const audioCard = exercise?.transcript && (
    <Card isDarkMode={isDarkMode}>
      <SectionHeading isDarkMode={isDarkMode}>
        {t("exam.audio", "Audio")}
      </SectionHeading>
      <TTSPlayer
        text={exercise.transcript}
        lang={targetLang}
        isDarkMode={isDarkMode}
      />
      {exercise.tone && (
        <p
          className={`mt-2 text-xs font-semibold italic ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {exercise.tone}
        </p>
      )}
    </Card>
  );

  // ── Shared: Transcript card ────────────────────────────────────────────────
  const transcriptCard = exercise?.transcript && (
    <CollapsibleCard
      title={t("exam.transcript", "Transcript")}
      isDarkMode={isDarkMode}
      defaultOpen={false}
    >
      <p
        className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isDarkMode ? "text-slate-300" : "text-slate-700"
        }`}
      >
        {exercise.transcript}
      </p>
    </CollapsibleCard>
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!exercise && loading) {
    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="listening"
            level={level}
            onLevelChange={setLevel}
            questionType={questionType}
            onQuestionTypeChange={setQuestionType}
            onGenerate={handleGenerateWrapper}
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
            />
            {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}
          </div>
        </div>
      </>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (!exercise && error) {
    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="listening"
            level={level}
            onLevelChange={setLevel}
            questionType={questionType}
            onQuestionTypeChange={setQuestionType}
            onGenerate={handleGenerateWrapper}
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
      </>
    );
  }

  // ── Exercise in progress ───────────────────────────────────────────────────
  if (exercise && !result) {
    const questionCount =
      exerciseType === "fill-blanks"
        ? exercise.blanks?.length ?? 0
        : exercise.questions?.length ?? 0;

    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="listening"
            level={level}
            onLevelChange={setLevel}
            questionType={questionType}
            onQuestionTypeChange={setQuestionType}
            onGenerate={handleGenerateWrapper}
            loading={loading}
            isDarkMode={isDarkMode}
            timerRef={timerRef}
            seenExerciseCount={seenExerciseCount}
            onReset={handleReset}
            isResetting={isResetting}
          />

          <div className="flex-1 min-w-0 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LevelBadge level={level} isDarkMode={isDarkMode} color="sky" />
                <h2
                  className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {t("exam.listening", "Listening Comprehension")}
                </h2>
              </div>
              <ReportButton
                isDarkMode={isDarkMode}
                context="ListeningExercise"
              />
            </div>

            <ErrorBanner error={error} isDarkMode={isDarkMode} />

            {audioCard}
            {transcriptCard}

            {exercise.instructions?.length > 0 && (
              <Card isDarkMode={isDarkMode}>
                <SectionHeading isDarkMode={isDarkMode}>
                  {t("exam.instructions", "Instructions")}
                </SectionHeading>
                <ul className="flex flex-col gap-1.5">
                  {exercise.instructions.map((instr, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2 text-xs ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-black ${
                          isDarkMode
                            ? "border-sky-600 text-sky-400"
                            : "border-sky-500 text-sky-600"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {instr}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <div>
              <SectionHeading isDarkMode={isDarkMode}>
                {t("exam.comprehension_questions", "Comprehension Questions")}
              </SectionHeading>
              <div className="flex flex-col gap-3">
                {exerciseType === "multiple-choice" && (
                  <MultipleChoiceExercise
                    questions={exercise.questions}
                    answers={answers}
                    onAnswer={handleSelectAnswer}
                    isDarkMode={isDarkMode}
                  />
                )}
                {exerciseType === "true-false" && (
                  <TrueFalseExercise
                    statements={exercise.questions}
                    answers={answers}
                    onAnswer={handleSelectAnswer}
                    isDarkMode={isDarkMode}
                  />
                )}
                {exerciseType === "fill-blanks" && (
                  <FillBlanksExercise
                    passage={exercise.passage}
                    wordBank={exercise.wordBank ?? []}
                    blanks={exercise.blanks ?? []}
                    answers={answers}
                    onAnswer={handleSelectAnswer}
                    isDarkMode={isDarkMode}
                  />
                )}
              </div>
            </div>

            <p
              className={`text-xs font-semibold ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {Object.keys(answers).length} / {questionCount}{" "}
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
      </>
    );
  }

  // ── Results view ───────────────────────────────────────────────────────────
  if (result) {
    const scoreColor = getListeningScoreColor(
      result.score,
      result.maxScore,
      isDarkMode,
    );

    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="listening"
            level={level}
            onLevelChange={setLevel}
            questionType={questionType}
            onQuestionTypeChange={setQuestionType}
            onGenerate={handleGenerateWrapper}
            loading={loading}
            isDarkMode={isDarkMode}
            timerRef={timerRef}
            seenExerciseCount={seenExerciseCount}
            onReset={handleReset}
            isResetting={isResetting}
            score={result.score}
            maxScore={result.maxScore}
            scoreColor={scoreColor}
          />

          <div className="flex-1 min-w-0 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LevelBadge level={level} isDarkMode={isDarkMode} color="sky" />
                <h2
                  className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {t("exam.results", "Results")}
                </h2>
              </div>
              <ReportButton
                isDarkMode={isDarkMode}
                context="ListeningExercise"
              />
            </div>

            {audioCard}
            {transcriptCard}

            <CollapsibleCard
              title={t("exam.your_answers", "Your Answers")}
              isDarkMode={isDarkMode}
              defaultOpen={false}
            >
              <div className="flex flex-col gap-2 mt-3">
                {result.breakdown.map((item, i) => (
                  <div
                    key={item.questionId}
                    className={`rounded-xl border-2 px-4 py-3 ${
                      isDarkMode
                        ? "border-slate-700 bg-slate-800/50"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold mb-1 ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {i + 1}. {item.question}
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        item.isCorrect
                          ? isDarkMode
                            ? "text-sky-400"
                            : "text-sky-700"
                          : isDarkMode
                            ? "text-rose-400"
                            : "text-rose-600"
                      }`}
                    >
                      {item.userAnswer ?? t("exam.no_answer", "No answer")}
                    </p>
                    {!item.isCorrect && (
                      <p
                        className={`text-xs mt-1 ${
                          isDarkMode ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {t("exam.correct_answer", "Correct")}: {item.correctAnswer}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleCard>

            <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
              <RotateCcw size={14} /> {t("exam.try_again", "Try Again")}
            </GhostButton>
          </div>
        </div>
      </>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  return (
    <>
      {newExerciseModal}
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          exerciseType="listening"
          level={level}
          onLevelChange={setLevel}
          questionType={questionType}
          onQuestionTypeChange={setQuestionType}
          onGenerate={handleGenerateWrapper}
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
              className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              {t("exam.listening", "Listening Comprehension")}
            </h2>
          </div>
          <p
            className={`text-sm font-semibold text-center ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {t("exam.language_note_dynamic", "Exercise is in {{lang}}.", {
              lang: user?.learningDialect || "pt-PT",
            })}
          </p>
        </div>
      </div>
    </>
  );
};

ListeningExercise.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ListeningExercise;
