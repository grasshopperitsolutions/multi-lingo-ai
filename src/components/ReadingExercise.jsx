import { useState, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BookOpen, CheckCircle2, RotateCcw } from "lucide-react";
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

  // Hook to confirm generating a new exercise when one is in progress
  const {
    showConfirm: showNewExerciseConfirm,
    onGenerateClick,
    handleConfirm: handleConfirmNewExercise,
    handleCancel: handleCancelNewExercise,
  } = useGenerateConfirm(exercise !== null);

  const allAnswered =
    exercise?.questions?.length > 0 &&
    exercise.questions.every((q) => answers[q.id] != null);

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

  const seenExerciseCount = (user.seenExerciseIds?.reading ?? []).length;

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetSeenExercises(user.token, user.uid);
      setUser((prev) => ({ ...prev, seenExerciseIds: { ...prev.seenExerciseIds, reading: [] } }));
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

  // Confirm dialog: clean up state then generate a new exercise
  const handleNewExercise = () => {
    setExercise(null);
    setExerciseId(null);
    setAnswers({});
    setResult(null);
    setError(null);
    timerRef.current?.reset();
    handleGetExercise();
  };

  // Wraps the sidebar generate button — shows confirm if exercise is ongoing
  const handleGenerateWrapper = () => {
    onGenerateClick(handleGetExercise);
  };

  const headerIcon = (
    <div className="w-10 h-10 rounded-xl border-4 border-slate-900 bg-emerald-400 flex items-center justify-center shrink-0">
      <BookOpen size={18} className="text-slate-900" />
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
      warning={t("exam.sidebar.new_exercise_warning", "⚠ This cannot be undone.")}
      confirmLabel={t("exam.sidebar.new_exercise_confirm", "Yes, generate new exercise")}
      confirmColor="yellow"
      isLoading={loading}
      onConfirm={() => handleConfirmNewExercise(handleNewExercise)}
      onCancel={handleCancelNewExercise}
    />
  ) : null;

  // Loading/error guards
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
            message={t("exam.generating", "Generating exercise...")}
            fullScreen={true}
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

  // Error guard — exercise failed to load; Try Again fetches a new exercise
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

  // Render the appropriate exercise component based on questionType
  const renderExerciseComponent = () => {
    switch (exercise.questionType) {
      case "multiple-choice":
        return (
          <MultipleChoiceExercise
            passage={exercise.text}
            questions={exercise.questions}
            answers={answers}
            onAnswer={handleSelectAnswer}
            isDarkMode={isDarkMode}
          />
        );
      case "true-false":
        return (
          <TrueFalseExercise
            passage={exercise.text}
            statements={exercise.questions}
            answers={answers}
            onAnswer={handleSelectAnswer}
            isDarkMode={isDarkMode}
          />
        );
      case "best-title":
        return (
          <BestTitleExercise
            passage={exercise.text}
            titles={exercise.questions}
            selectedId={answers.bestTitle}
            onSelect={(titleId) => handleSelectAnswer("bestTitle", titleId)}
            isDarkMode={isDarkMode}
          />
        );
      case "ordering":
        return (
          <OrderingExercise
            items={exercise.questions}
            userOrder={answers.ordering || []}
            onReorder={(order) => setAnswers({ ordering: order })}
            isDarkMode={isDarkMode}
          />
        );
      case "cloze":
        return (
          <ClozeExercise
            passage={exercise.text}
            blanks={exercise.questions}
            answers={answers}
            onAnswer={handleSelectAnswer}
            isDarkMode={isDarkMode}
          />
        );
      case "fill-blanks":
        return (
          <FillBlanksExercise
            passage={exercise.text}
            wordBank={exercise.wordBank}
            blanks={exercise.questions}
            answers={answers}
            onAnswer={handleSelectAnswer}
            isDarkMode={isDarkMode}
          />
        );
      case "matching":
        return (
          <MatchingExercise
            pairs={exercise.questions}
            extraItems={exercise.extraItems}
            matches={answers}
            onMatch={handleSelectAnswer}
            isDarkMode={isDarkMode}
          />
        );
      case "notice-sign":
        return (
          <NoticeSignExercise
            notices={exercise.questions}
            answers={answers}
            onAnswer={handleSelectAnswer}
            isDarkMode={isDarkMode}
          />
        );
      default:
        return (
          <div className="text-rose-500">
            Unknown exercise type: {exercise.questionType}
          </div>
        );
    }
  };

  // Main exercise view
  if (exercise && !result) {
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
                <LevelBadge level={level} isDarkMode={isDarkMode} />
                <h2
                  className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
                >
                  {t("exam.reading", "Reading Comprehension")}
                </h2>
              </div>
              <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
            </div>

            <ErrorBanner error={error} isDarkMode={isDarkMode} />

            {/* Vocabulary section */}
            {exercise.vocabulary?.length > 0 && (
              <div>
                <SectionHeading isDarkMode={isDarkMode}>
                  {t("exam.vocabulary", "Vocabulary")}
                </SectionHeading>
                <div className="flex flex-col gap-1.5">
                  {exercise.vocabulary.map((item) => (
                    <div
                      key={item.word}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg ${isDarkMode ? "bg-slate-800" : "bg-slate-50"}`}
                    >
                      <span
                        className={`font-black text-sm shrink-0 ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}
                      >
                        {item.word}
                      </span>
                      <span
                        className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}
                      >
                        — {item.definition}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exercise content */}
            <div>
              <SectionHeading isDarkMode={isDarkMode}>
                {t("exam.comprehension_questions", "Comprehension Questions")}
              </SectionHeading>
              {renderExerciseComponent()}
            </div>

            <p
              className={`text-xs font-semibold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}
            >
              {Object.keys(answers).length} / {exercise.questions.length}{" "}
              {t("exam.questions_answered", "questions answered")}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <PrimaryButton
                onClick={handleCheckAnswers}
                isDarkMode={isDarkMode}
                disabled={!allAnswered}
                className="flex-1"
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

  // Results view
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
          />

          <div className="flex-1 min-w-0 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LevelBadge level={level} isDarkMode={isDarkMode} color="emerald" />
                <h2
                  className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}
                >
                  {t("exam.results", "Results")}
                </h2>
              </div>
              <ReportButton isDarkMode={isDarkMode} context="ReadingExercise" />
            </div>

            {/* Collapsible: original passage */}
            {exercise.text && (
              <CollapsibleCard
                title={t("exam.task", "Your Task")}
                isDarkMode={isDarkMode}
                defaultOpen={false}
              >
                <p
                  className={`mt-3 text-sm leading-relaxed whitespace-pre-wrap ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                >
                  {exercise.text}
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
                      className={`text-sm font-bold ${item.isCorrect ? (isDarkMode ? "text-emerald-400" : "text-emerald-700") : (isDarkMode ? "text-rose-400" : "text-rose-600")}`}
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

            {/* Try Again — resets state, same exercise */}
            <GhostButton onClick={handleTryAgain} isDarkMode={isDarkMode}>
              <RotateCcw size={14} /> {t("exam.try_again", "Try Again")}
            </GhostButton>
          </div>
        </div>
      </>
    );
  }

  // Initial state: show sidebar with no exercise
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
            {headerIcon}
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
};

ReadingExercise.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ReadingExercise;