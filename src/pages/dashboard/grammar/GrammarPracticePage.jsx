import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Trophy, Lock } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { useInterestTopics } from "../../../hooks/useInterestTopics";
import { isAiDeclined } from "../../../services/aiService";
import { getPracticeExercise, getKnownTopics, checkOpenAnswer } from "../../../services/grammarPracticeService";
import { markExerciseSeen, resetSeenExercises } from "../../../services/userService";
import { CEFR_LEVELS } from "../../../config/examLevels";
import {
  availablePracticeTypes,
  GRAMMAR_PRACTICE_OPEN_FEATURE,
} from "../../../config/grammarPracticeTypes";
import { isStructuredPracticeSupported } from "../../../config/structuredPracticeSupport";
import { FEATURE_STATUS } from "../../../utils/featureAccess";
import { VERDICT } from "../../../utils/grammarAnswerCheck";
import Loader from "../../../components/Loader";
import NeoDropdown from "../../../components/NeoDropdown";
import PracticeItem from "../../../components/grammarPractice/PracticeItem";
import ExerciseSidebar from "../../../components/ExerciseSidebar";
import CustomRequestInput from "../../../components/CustomRequestInput";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton, LevelBadge, AiNotice } from "../../../components/ui";

/**
 * GrammarPracticePage — Exercícios de Treino
 *
 * AI-written grammar exercises served from a shared pool that starts empty and
 * fills from the first request (see grammarPracticeService). The learner picks
 * a level and, optionally, a topic and a type; everything else is "Surprise
 * me", which lets the model choose the grammar point.
 *
 * Items are answered one at a time and marked on the spot, with the
 * explanation straight after — practice, not an exam sheet.
 */

const LEVEL_STORAGE_KEY = "grammarPractice.level";
const ANY = "";
/** The "Other" row of the topic picker. Never a real topic key. */
const OTHER = "__other__";

function readStoredLevel() {
  try {
    const stored = localStorage.getItem(LEVEL_STORAGE_KEY);
    return CEFR_LEVELS.includes(stored) ? stored : "A1";
  } catch {
    return "A1";
  }
}

/** "verbs-past-imperfect" → "Verbs past imperfect", for keys with no label yet. */
function humanizeKey(key) {
  const words = String(key ?? "").replace(/-/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

const GrammarPracticePage = () => {
  const { isDarkMode, user, setUser, interfaceLang, supportedLanguages, showAlert } = useAppContext();
  const { featureStatus, isReady, canAccess, isAdmin } = useTierAccess();
  const { topics: interestTopics } = useInterestTopics();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const dialect = user?.learningDialect;
  const supported = isStructuredPracticeSupported(dialect, supportedLanguages, { isAdmin });
  const canOpenAnswer = isReady && featureStatus(GRAMMAR_PRACTICE_OPEN_FEATURE) === FEATURE_STATUS.AVAILABLE;

  const [level, setLevel] = useState(readStoredLevel);
  const [topic, setTopic] = useState(ANY);
  const [customTopic, setCustomTopic] = useState("");
  // True once a request had to generate: the learner has seen everything
  // that matched, so a typed topic costs nothing extra — the same rule that
  // unlocks custom requests elsewhere.
  const [poolExhausted, setPoolExhausted] = useState(false);
  const [type, setType] = useState(ANY);
  const [knownTopics, setKnownTopics] = useState([]);

  const [practice, setPractice] = useState(null); // result of getPracticeExercise
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LEVEL_STORAGE_KEY, level);
    } catch {
      // Remembering the level is a convenience; nothing breaks without it.
    }
  }, [level]);

  // Topics known for this dialect. Empty is normal: only "Surprise me" then.
  useEffect(() => {
    let cancelled = false;
    if (!user?.token || !dialect) return undefined;
    getKnownTopics({ token: user.token, dialect }).then((list) => {
      if (!cancelled) setKnownTopics(list);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.token, dialect]);

  const canCustomise = canAccess("custom_requests") || poolExhausted;

  // "Other" is left out rather than shown locked, like the Tale Creator's.
  const topicOptions = useMemo(
    () => [
      { value: ANY, label: t("grammar_practice.surprise_me") },
      ...knownTopics.map((topicDoc) => ({ value: topicDoc.key, label: humanizeKey(topicDoc.key) })),
      ...(canCustomise ? [{ value: OTHER, label: t("grammar_practice.other_topic") }] : []),
    ],
    [knownTopics, canCustomise, t]
  );
  // Losing access while "Other" is selected falls back to Surprise me,
  // derived rather than corrected in an effect.
  const activeTopic = topic === OTHER && !canCustomise ? ANY : topic;
  const usingCustom = activeTopic === OTHER;
  const typeOptions = useMemo(
    () => [
      { value: ANY, label: t("grammar_practice.any_type") },
      ...availablePracticeTypes({ canOpenAnswer }).map((key) => ({
        value: key,
        label: t(`grammar_practice.types.${key}`, key),
      })),
    ],
    [canOpenAnswer, t]
  );

  const errorMessage = (err) => {
    const message = String(err?.message ?? "");
    if (message.includes("not found in")) return t("grammar_practice.not_ready");
    if (message.includes("GRAMMAR_PRACTICE_GENERATION_FAILED")) return t("grammar_practice.generation_failed");
    if (message.includes("GRAMMAR_PRACTICE_TYPE_LOCKED")) return t("grammar_practice.type_locked");
    return message || t("common.error", "Something went wrong. Please try again.");
  };

  const handleStart = async () => {
    if (!user?.token || !dialect) return;
    if (usingCustom && !customTopic.trim()) {
      showAlert("warning", t("grammar_practice.other_topic_required"));
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const next = await getPracticeExercise({
        token: user.token,
        dialect,
        explanationLocale: interfaceLang || user.interfaceLang,
        level,
        type,
        topicKey: usingCustom ? ANY : activeTopic,
        customTopic: usingCustom ? customTopic : "",
        canOpenAnswer,
        seenIds: user.seenExerciseIds?.grammar ?? [],
        interests: interestTopics.map((item) => item.label).join(", "),
      });
      setPractice(next);
      if (next.source === "ai") setPoolExhausted(true);
      setIndex(0);
      setResults({});
      // A topic the model just named shows up in the picker next time.
      if (next.topicKey && !knownTopics.some((known) => known.key === next.topicKey)) {
        setKnownTopics((prev) => [...prev, { key: next.topicKey, family: "", status: "practice" }]
          .sort((a, b) => a.key.localeCompare(b.key)));
      }
    } catch (err) {
      if (isAiDeclined(err)) return;
      const message = errorMessage(err);
      setError(message);
      showAlert("error", message, { label: t("common.try_again", "Try Again"), onClick: handleStart });
    } finally {
      setIsLoading(false);
    }
  };

  const seenCount = user?.seenExerciseIds?.grammar?.length ?? 0;

  /**
   * One AI marking call for a sentence answer. Resolves to null when the
   * learner declines the call or it fails, so the code's verdict stands.
   */
  const handleAskAI = async (item, answer) => {
    try {
      return await checkOpenAnswer({
        token: user.token,
        dialect,
        explanationLocale: interfaceLang || user.interfaceLang,
        level: practice?.level ?? level,
        exercise: practice?.exercise,
        item,
        answer,
      });
    } catch (err) {
      if (!isAiDeclined(err)) showAlert("error", errorMessage(err));
      return null;
    }
  };

  const handleReset = async () => {
    if (!user?.token || !user?.uid) return;
    setIsResetting(true);
    try {
      await resetSeenExercises(user.token, user.uid, "grammar");
      setUser((prev) => ({ ...prev, seenExerciseIds: { ...prev.seenExerciseIds, grammar: [] } }));
      setPractice(null);
      setResults({});
      setIndex(0);
      setError(null);
    } catch (err) {
      showAlert("error", errorMessage(err));
    } finally {
      setIsResetting(false);
    }
  };

  const items = practice?.exercise?.items ?? [];
  const current = items[index];
  const finished = practice && index >= items.length;
  const score = Object.values(results).filter((r) => r.verdict === VERDICT.CORRECT).length;

  // Seen once finished, the same moment the exams mark theirs.
  useEffect(() => {
    if (!finished || !practice?.exerciseId || !user?.token || !user?.uid) return;
    const currentSeen = user.seenExerciseIds?.grammar ?? [];
    if (currentSeen.includes(practice.exerciseId)) return;
    markExerciseSeen(user.token, user.uid, "grammar", practice.exerciseId, currentSeen)
      .then(() => {
        setUser((prev) => ({
          ...prev,
          seenExerciseIds: {
            ...prev.seenExerciseIds,
            grammar: [...new Set([...(prev.seenExerciseIds?.grammar ?? []), practice.exerciseId])],
          },
        }));
      })
      .catch((err) => console.warn("[GrammarPracticePage] could not mark seen", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, practice?.exerciseId]);

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      showPracticeLanguage
      accentColor="amber"
      title={t("grammar.practice")}
      reportContext="GrammarPracticePage"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.grammar"), onClick: () => navigate("/dashboard/grammar") },
        { label: t("grammar.practice") },
      ]}
    >
      {!supported ? (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-amber-300" : "text-amber-800"}`}>
            {t("grammar_practice.not_available_for_language")}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col lg:flex-row gap-5">
          <ExerciseSidebar
            exerciseType="grammar"
            level={level}
            onLevelChange={setLevel}
            questionType={type}
            onQuestionTypeChange={setType}
            typeOptions={typeOptions}
            extraControls={
              <>
                <NeoDropdown options={topicOptions} value={activeTopic} onChange={setTopic} isDarkMode={isDarkMode}
                  label={t("grammar_practice.topic")} disabled={isLoading} />
                {usingCustom && (
                  <CustomRequestInput
                    value={customTopic}
                    onChange={setCustomTopic}
                    placeholder={t("grammar_practice.other_topic_placeholder")}
                    cacheExhausted={poolExhausted}
                    disabled={isLoading}
                    isDarkMode={isDarkMode}
                  />
                )}
                {/* The sentence-answer types need AI marking, so they are Maestro
                    and up. Said here rather than hidden without a word. */}
                {isReady && !canOpenAnswer && (
                  <button
                    type="button"
                    onClick={() => navigate("/pricing")}
                    className={`flex items-start gap-2 text-left text-xs font-bold ${
                      isDarkMode ? "text-amber-300 hover:text-amber-200" : "text-amber-700 hover:text-amber-800"
                    }`}
                  >
                    <Lock size={14} className="mt-0.5 shrink-0" />
                    <span>{t("grammar_practice.open_types_upsell")}</span>
                  </button>
                )}
              </>
            }
            generateLabel={practice ? t("grammar_practice.another") : t("grammar_practice.start")}
            onGenerate={handleStart}
            loading={isLoading}
            isDarkMode={isDarkMode}
            seenExerciseCount={seenCount}
            onReset={handleReset}
            isResetting={isResetting}
            score={finished ? score : null}
            maxScore={finished ? items.length : null}
            showTimer={false}
          />

          <div className="flex-1 min-w-0 flex flex-col gap-4">
          <AiNotice isDarkMode={isDarkMode} variant="input" />

          {isLoading && <Loader message={t("grammar_practice.loading")} isDarkMode={isDarkMode} />}
          {!isLoading && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

          {!isLoading && !error && !practice && (
            <Card isDarkMode={isDarkMode}>
              <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                {t("grammar_practice.empty_state")}
              </p>
            </Card>
          )}

          {!isLoading && practice && current && (
            <Card isDarkMode={isDarkMode}>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <LevelBadge level={practice.level} isDarkMode={isDarkMode} color="amber" />
                <span className={`text-xs font-black uppercase tracking-widest ${muted}`}>
                  {t(`grammar_practice.types.${practice.type}`, practice.type)}
                </span>
                <span className={`ml-auto text-sm font-black tabular-nums ${muted}`}>
                  {t("grammar_practice.progress", { current: index + 1, total: items.length })}
                </span>
              </div>

              {practice.exercise.focusLabel && (
                <p className={`text-sm font-black mb-1 ${isDarkMode ? "text-amber-300" : "text-amber-700"}`}>
                  {practice.exercise.focusLabel}
                </p>
              )}
              {practice.exercise.instructions && (
                <p className={`text-sm font-semibold mb-4 ${muted}`}>{practice.exercise.instructions}</p>
              )}

              <PracticeItem
                type={practice.type}
                item={current}
                exercise={practice.exercise}
                dialect={dialect}
                isDarkMode={isDarkMode}
                result={results[current.id]}
                onResult={(result) => setResults((prev) => ({ ...prev, [current.id]: result }))}
                onAskAI={canOpenAnswer ? handleAskAI : undefined}
              />

              {results[current.id] && (
                <div className="mt-4">
                  <PrimaryButton onClick={() => setIndex((i) => i + 1)} isDarkMode={isDarkMode} color="amber">
                    {index + 1 < items.length ? t("grammar_practice.next") : t("grammar_practice.see_score")}
                    <ArrowRight size={16} />
                  </PrimaryButton>
                </div>
              )}
            </Card>
          )}

          {!isLoading && finished && (
            <Card isDarkMode={isDarkMode}>
              <div className="flex flex-col items-start gap-3">
                <p className={`flex items-center gap-2 text-2xl font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  <Trophy size={24} className="text-amber-500" />
                  {t("grammar_practice.score", { score, total: items.length })}
                </p>
                {practice.exercise.focusLabel && (
                  <p className={`font-semibold ${muted}`}>{practice.exercise.focusLabel}</p>
                )}
                <PrimaryButton onClick={handleStart} isDarkMode={isDarkMode} color="amber">
                  {t("grammar_practice.another")}
                </PrimaryButton>
              </div>
            </Card>
          )}
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
};

export default GrammarPracticePage;
