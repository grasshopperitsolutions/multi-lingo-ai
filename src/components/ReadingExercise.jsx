import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BookOpen, RotateCcw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import ExerciseSidebar from "./ExerciseSidebar";
import Loader from "./Loader";
import ReportButton from "./ReportButton";
import ConfirmModal from "./ConfirmModal";
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
import { checkReadingAnswers, getScoreColor } from "../services/examUtils";
import { markExerciseSeen, resetSeenExercises } from "../services/userService";
import {
  MultipleChoiceExercise,
  TrueFalseExercise,
  BestTitleExercise,
  OrderingExercise,
  ClozeExercise,
  FillBlanksExercise,
  MatchingExercise,
  NoticeSignExercise,
} from "./exercises";
import useGenerateConfirm from "../hooks/useGenerateConfirm";

const ReadingExercise = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, setUser, showAlert } = useAppContext();

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

  const allAnswered = (() => {
    if (!exercise?.questions?.length) return false;
    if (exercise.questionType === "best-title") return !!answers.bestTitle;
    if (exercise.questionType === "ordering")
      return answers.ordering?.length > 0;
    return exercise.questions.every((q) => answers[q.id] != null);
  })();

  const markCurrentExerciseSeen = async () => {
    if (!exerciseId || !user?.token || !user?.uid) return;
    const currentSeen = user.seenExerciseIds?.reading ?? [];
    await markExerciseSeen(user.token, user.uid, "reading", exerciseId, currentSeen);
    setUser((prev) => ({
      ...prev,
      seenExerciseIds: {
        ...prev.seenExerciseIds,
        reading: [...new Set([...currentSeen, exerciseId])],
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
        type: "reading",
        questionType: questionType === "random" ? undefined : questionType,
        targetLang: user.learningDialect || "pt-PT",
        userDialect: user.interfaceLang || "en-US",
        seenExerciseIds: user.seenExerciseIds?.reading ?? [],
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
    if (!exercise?.questions) return;
    const userAnswers = Object.entries(answers).map(
      ([questionId, selectedAnswer]) => ({ questionId, selectedAnswer }),
    );
    const res = checkReadingAnswers(userAnswers, exercise.questions);
    setResult(res);
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

  const seenExerciseCount = (user.seenExerciseIds?.reading ?? []).length;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetSeenExercises(user.token, user.uid, "reading");
      setUser((prev) => ({
        ...prev,
        seenExerciseIds: { ...prev.seenExerciseIds, reading: [] },
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

  const newExerciseModal = showNewExerciseConfirm ? (
    <ConfirmModal
      isDarkMode={isDarkMode}
      title={t("exam.sidebar.new_exercise_title", "New Exercise")}
      message={t(
        "exam.sidebar.new_exercise_message",
        "You have an exercise in progress. Generating a new one will discard your current work.",
      )}
      warning={t("exam.sidebar.new_exercise_warning", "⚠ This cannot be undone.")}
      confirmLabel={t("exam.sidebar.new_exercise_confirm", "Yes, generate new exercise")}
      confirmColor="yellow"
      isLoading={loading}
      onConfirm={() => handleConfirmNewExercise(handleNewExercise)}
      onCancel={handleCancelNewExercise}
    />
  ) : null;

  if (!exercise && loading) {
    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="reading"
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
              fullScreen={true}
            />
            {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}
          </div>
        </div>
      </>
    );
  }

  if (!exercise && error) {
    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="reading"
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

  if (result) {
    const scoreColor = getScoreColor(result.score, result.maxScore, isDarkMode);

    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="reading"
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
                <LevelBadge level={level} isDarkMode={isDarkMode} color="teal" />
                <h2
                  className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
                >
                  {t("exam.results", "Results")}
                </h2>
              </div>
              <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
            </div>

            <CollapsibleCard
              title={t("exam.passage", "Passage")}
              isDarkMode={isDarkMode}
              defaultOpen={false}
            >
              <p
                className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
              >
                {exercise?.passage ?? exercise?.text}
              </p>
            </CollapsibleCard>

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
                      className={`text-sm font-bold ${item.isCorrect ? (isDarkMode ? "text-teal-400" : "text-teal-700") : (isDarkMode ? "text-rose-400" : "text-rose-600")}`}
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

            <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
              <RotateCcw size={14} /> {t("exam.try_again", "Try Again")}
            </GhostButton>
          </div>
        </div>
      </>
    );
  }

  if (!exercise) {
    return (
      <>
        {newExerciseModal}
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="reading"
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
              <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-teal-400 flex items-center justify-center shrink-0">
                <BookOpen size={18} className="text-slate-900" />
              </div>
              <h2
                className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
              >
                {t("exam.reading", "Reading Comprehension")}
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
      </>
    );
  }

  return (
    <>
      {newExerciseModal}
      <div className="flex flex-col lg:flex-row gap-5">
        <ExerciseSidebar
          exerciseType="reading"
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
              <LevelBadge level={level} isDarkMode={isDarkMode} color="teal" />
              <h2
                className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
              >
                {t("exam.reading", "Reading Comprehension")}
              </h2>
            </div>
            <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
          </div>

          <ErrorBanner error={error} isDarkMode={isDarkMode} />

          {exercise.passage && (
            <Card isDarkMode={isDarkMode}>
              <SectionHeading isDarkMode={isDarkMode}>
                {t("exam.passage", "Passage")}
              </SectionHeading>
              <p
                className={`text-sm sm:text-base leading-relaxed ${
                  isDarkMode ? "text-slate-200" : "text-slate-800"
                }`}
              >
                {exercise.passage}
              </p>
            </Card>
          )}

          <div>
            <SectionHeading isDarkMode={isDarkMode}>
              {t("exam.comprehension_questions", "Comprehension Questions")}
            </SectionHeading>
            <div className="flex flex-col gap-3">
              {exercise.questionType === "multiple-choice" && (
                <MultipleChoiceExercise
                  questions={exercise.questions}
                  answers={answers}
                  onAnswer={handleSelectAnswer}
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "true-false" && (
                <TrueFalseExercise
                  questions={exercise.questions}
                  answers={answers}
                  onAnswer={handleSelectAnswer}
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "best-title" && (
                <BestTitleExercise
                  passage={exercise.passage}
                  options={exercise.questions.map((q) => q.text)}
                  selected={answers.bestTitle ?? null}
                  onSelect={(opt) =>
                    setAnswers((prev) => ({ ...prev, bestTitle: opt }))
                  }
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "ordering" && (
                <OrderingExercise
                  sentences={exercise.questions.map((q) => q.text)}
                  ordering={answers.ordering ?? []}
                  onReorder={(newOrder) =>
                    setAnswers((prev) => ({ ...prev, ordering: newOrder }))
                  }
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "cloze" && (
                <ClozeExercise
                  passage={exercise.passage}
                  blanks={exercise.questions}
                  answers={answers}
                  onAnswer={handleSelectAnswer}
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "fill-blanks" && (
                <FillBlanksExercise
                  passage={exercise.passage}
                  wordBank={exercise.wordBank}
                  blanks={exercise.blanks}
                  answers={answers}
                  onAnswer={handleSelectAnswer}
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "matching" && (
                <MatchingExercise
                  pairs={exercise.questions}
                  answers={answers}
                  onAnswer={handleSelectAnswer}
                  isDarkMode={isDarkMode}
                />
              )}
              {exercise.questionType === "notice-sign" && (
                <NoticeSignExercise
                  signs={exercise.questions}
                  answers={answers}
                  onAnswer={handleSelectAnswer}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          </div>

          <p
            className={`text-xs font-semibold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
          >
            {Object.keys(answers).length} / {exercise.questions?.length ?? 0}{" "}
            {t("exam.questions_answered", "questions answered")}
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <PrimaryButton
              onClick={handleCheckAnswers}
              isDarkMode={isDarkMode}
              disabled={!allAnswered}
              className="flex-1"
              color="teal"
            >
              {t("exam.check_answers", "Check My Answers")}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </>
  );
};

ReadingExercise.propTypes = { isDarkMode: PropTypes.bool.isRequired };

export default ReadingExercise;
