import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import { usePracticeLevel } from "../../hooks/usePracticeLevel";
import { useInterestTopics } from "../../hooks/useInterestTopics";
import { useAlbumStickers } from "../../hooks/useAlbumStickers";
import { useAiErrorAlert } from "../../hooks/useAiError";
import { useSessionRecovery } from "../../hooks/useSessionRecovery";
import { gatherPlayableWords } from "../../hooks/usePictureRound";
import { isAiDeclined } from "../../services/aiService";
import {
  MAX_DESCRIPTION_LENGTH,
  getPicturePool,
  getScenes,
  rankScenes,
  requestDescribeFeedback,
  requestScene,
} from "../../services/getImageService";
import { getConceptTranslations } from "../../services/getWordService";
import { getSeenSceneIds, markSceneSeen, resetSeenScenes } from "../../services/userService";
import { play } from "../../services/soundService";
import { findWordsInText, pickSceneWords } from "../../utils/pictureRound";
import { AiNotice, PrimaryButton } from "../ui";
import AutoGrowTextarea from "../personal/AutoGrowTextarea";
import SeenProgressCard from "../SeenProgressCard";
import Loader from "../Loader";
import PictureTile from "./PictureTile";

/** The fewest findable words that make a scene worth describing. */
const MIN_TARGETS = 3;
/** How many unseen scenes are tried before giving up on finding one in this language. */
const MAX_SCENE_TRIES = 6;
/** Words gathered to build a new scene from. */
const SCENE_POOL = 40;

/**
 * Descreve a imagem (picture_describe, Maestro)
 *
 * A scene with several things in it: write what you see, and get feedback.
 *
 * **Where a scene comes from.** The pool first. A scene is shared by every
 * language (the words to find are translated per player), and each player's
 * seen scenes are tracked, with a reset, like tales and culture pieces. Only
 * when there is no unseen scene a player can use does an unlimited tier get a
 * button to draw a new one, which the server refuses to anyone else.
 *
 * **Which words were found is counted in code.** The description is matched
 * against the target words (and their dictionary forms) before the model is
 * asked anything, and handed to it as a fact. "Found 4 of 6" is never the
 * model's guess. The model then comments on phrasing and anything else the
 * learner described, and suggests two words to look for next.
 *
 * **It is an ordinary AI call**, counted and confirmed like any other. The
 * learner's own keyboard dictation works in the box with no code of ours.
 */
const PictureDescribeGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const { canUseAI, hasUnlimitedAI } = useTierAccess();
  const { level } = usePracticeLevel();
  const { topics } = useInterestTopics();
  const { collect } = useAlbumStickers();
  const alertAiError = useAiErrorAlert();
  const recoverSession = useSessionRecovery();

  const token = user?.token;
  const uid = user?.uid;
  const dialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang = user?.interfaceLang ?? "en-US";
  const topicKey = topics.map((topic) => topic.id).join("|");
  const preferTopicIds = useMemo(() => (topicKey ? topicKey.split("|") : []), [topicKey]);

  // loading | ready | none | creating | error
  const [phase, setPhase] = useState("loading");
  const [noneReason, setNoneReason] = useState(null);
  const [scene, setScene] = useState(null);
  const [targets, setTargets] = useState([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seenIds, setSeenIds] = useState([]);
  const [sceneIds, setSceneIds] = useState([]);
  const [createError, setCreateError] = useState(null);

  const loadNext = useCallback(async () => {
    if (!token || !uid) return;
    setPhase("loading");
    setResult(null);
    setText("");
    setCreateError(null);
    try {
      const [seen, scenes] = await Promise.all([getSeenSceneIds(token, uid), getScenes(token)]);
      setSeenIds(seen);
      setSceneIds(scenes.map((entry) => entry.id));

      const ranked = rankScenes(scenes, { seenIds: seen, preferTopicIds });
      for (const candidate of ranked.slice(0, MAX_SCENE_TRIES)) {
        // A scene can use any word a player of *some* language had; this player
        // needs those words in theirs. Too few and it is skipped, not shown.
        const translations = await getConceptTranslations(candidate.conceptIds, dialect, token);
        const found = candidate.conceptIds
          .filter((id) => translations.has(id))
          .map((id) => ({ conceptId: id, ...translations.get(id) }));
        if (found.length >= MIN_TARGETS) {
          setScene(candidate);
          setTargets(found);
          setPhase("ready");
          return;
        }
      }

      setScene(null);
      setNoneReason(scenes.length === 0 ? "no_scenes" : ranked.length === 0 ? "seen_all" : "no_words");
      setPhase("none");
    } catch (err) {
      if (await recoverSession(err)) return;
      setPhase("error");
    }
  }, [token, uid, dialect, preferTopicIds, recoverSession]);

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  /** Draw a new scene. Only offered to unlimited tiers; the server decides regardless. */
  const handleCreate = async () => {
    setPhase("creating");
    setCreateError(null);
    try {
      const { pictured } = await getPicturePool(token);
      const words = await gatherPlayableWords({
        pictured,
        token,
        locale: dialect,
        preferTopicIds,
        target: SCENE_POOL,
      });
      const pick = pickSceneWords(words ?? [], { preferTopicIds });
      if (!pick) {
        setCreateError("not_enough");
        setPhase("none");
        return;
      }

      const created = await requestScene(
        pick.words.map((word) => word.conceptId),
        token,
      );
      setScene(created);
      setTargets(pick.words.map((word) => ({ conceptId: word.conceptId, word: word.word, baseForm: word.baseForm })));
      setSceneIds((ids) => [...ids, created.id]);
      play("ai_ready");
      setPhase("ready");
    } catch (err) {
      if (await recoverSession(err)) return;
      setCreateError(err?.code === "SCENE_TIER" ? "tier" : err?.code === "PICTURE_CAP" ? "cap" : "failed");
      setPhase("none");
    }
  };

  const handleSubmit = async () => {
    const description = text.trim();
    if (!description) {
      setResult(null);
      return;
    }
    if (!canUseAI) {
      alertAiError({ code: "DAILY_LIMIT" });
      return;
    }

    setIsSubmitting(true);
    // Counted in code, before the model is asked anything.
    const { found, missed } = findWordsInText(description, targets);

    try {
      const feedback = await requestDescribeFeedback({
        token,
        sceneId: scene.id,
        description,
        level,
        targetLanguage: dialect,
        nativeLanguage: interfaceLang,
        found,
        missed,
      });

      const fresh = collect(found.map((entry) => entry.conceptId));
      setResult({ found, missed, fresh: new Set(fresh), ...feedback });
      play(missed.length === 0 ? "win" : "success");

      // Seen now: a scene described once is not offered again until a reset.
      const nextSeen = [...new Set([...seenIds, scene.id])];
      setSeenIds(nextSeen);
      markSceneSeen(token, uid, scene.id, seenIds).catch((err) =>
        console.warn("[PictureDescribeGame] markSceneSeen failed:", err.message),
      );
    } catch (err) {
      // The learner chose not to spend the call: not a failure.
      if (isAiDeclined(err)) return;
      if (await recoverSession(err)) return;
      alertAiError(err, { message: t("picture_games.describe.error"), retry: handleSubmit });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    await resetSeenScenes(token, uid);
    await loadNext();
  };

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const card = `rounded-2xl border-4 p-5 ${
    isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
  }`;

  const seenInPool = seenIds.filter((id) => sceneIds.includes(id)).length;

  const sidebar = (
    <aside className="w-full lg:w-64 shrink-0">
      <SeenProgressCard
        title={t("picture_games.describe.seen_title")}
        seenCount={seenInPool}
        totalCount={sceneIds.length}
        isLoading={phase === "loading"}
        onReset={handleReset}
        resetDisabled={seenIds.length === 0}
        resetLabel={t("picture_games.describe.reset")}
        resetTitle={t("picture_games.describe.reset_title")}
        resetMessage={t("picture_games.describe.reset_message")}
        resetWarning={t("picture_games.describe.reset_warning")}
        resetConfirmLabel={t("picture_games.describe.reset_confirm")}
        isDarkMode={isDarkMode}
      />
    </aside>
  );

  let main;

  if (phase === "loading") {
    main = <Loader isDarkMode={isDarkMode} message={t("picture_games.loading")} />;
  } else if (phase === "creating") {
    main = <Loader isDarkMode={isDarkMode} message={t("picture_games.describe.creating")} />;
  } else if (phase === "error") {
    main = (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <p className="text-rose-500 font-semibold px-4">{t("picture_games.error")}</p>
        <PrimaryButton onClick={loadNext} isDarkMode={isDarkMode} color="sky">
          {t("picture_games.try_again")}
        </PrimaryButton>
      </div>
    );
  } else if (phase === "none") {
    main = (
      <div className={`${card} flex flex-col items-center gap-4 text-center`}>
        <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
          {t(`picture_games.describe.none.${noneReason ?? "no_scenes"}`)}
        </h2>
        <p className={`text-sm font-semibold ${muted}`}>
          {hasUnlimitedAI ? t("picture_games.describe.none.can_create") : t("picture_games.describe.none.cannot_create")}
        </p>
        {createError && (
          <p className="text-sm font-bold text-rose-500" role="alert">
            {t(`picture_games.describe.create_error.${createError}`)}
          </p>
        )}
        {hasUnlimitedAI && (
          <PrimaryButton onClick={handleCreate} isDarkMode={isDarkMode} color="sky">
            <Wand2 size={16} aria-hidden="true" />
            {t("picture_games.describe.create")}
          </PrimaryButton>
        )}
      </div>
    );
  } else {
    main = (
      <div className="flex flex-col gap-5 w-full">
        <PictureTile
          url={scene.url}
          isDarkMode={isDarkMode}
          shape="wide"
          ariaLabel={t("picture_games.describe.scene")}
          className="w-full max-w-2xl mx-auto"
        />

        {!result ? (
          <div className="flex flex-col gap-3 w-full max-w-2xl mx-auto">
            <p className={`text-sm font-black uppercase tracking-widest ${muted}`}>
              {t("picture_games.describe.to_find", { total: targets.length })}
            </p>
            <AutoGrowTextarea
              value={text}
              onChange={setText}
              lang={dialect}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder={t("picture_games.describe.placeholder")}
              aria-label={t("picture_games.describe.placeholder")}
              disabled={isSubmitting}
              className={`w-full min-h-[7rem] rounded-xl border-4 p-3 text-base font-semibold ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                  : "bg-white border-slate-900 text-slate-900 placeholder:text-slate-400"
              }`}
            />
            <AiNotice isDarkMode={isDarkMode} variant="input" />
            <PrimaryButton
              onClick={handleSubmit}
              disabled={!text.trim()}
              loading={isSubmitting}
              isDarkMode={isDarkMode}
              color="sky"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {t("picture_games.describe.check")}
            </PrimaryButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto animate-in fade-in">
            <div className={`${card} flex flex-col gap-3`}>
              <p className={`text-3xl font-black tabular-nums ${isDarkMode ? "text-yellow-400" : "text-slate-900"}`}>
                {t("picture_games.describe.found", { found: result.found.length, total: targets.length })}
              </p>

              {result.found.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label={t("picture_games.describe.found_words")}>
                  {result.found.map((entry) => (
                    <li
                      key={entry.conceptId}
                      lang={dialect}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-slate-900 bg-emerald-300 text-sm font-black text-slate-900"
                    >
                      <Check size={14} aria-hidden="true" />
                      {entry.word}
                      {result.fresh.has(entry.conceptId) && (
                        <span className="inline-flex items-center gap-1 ml-1 text-[10px] uppercase tracking-widest">
                          <Sparkles size={12} aria-hidden="true" />
                          {t("picture_games.new_sticker")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {result.missed.length > 0 && (
                <p className={`text-sm font-semibold ${muted}`}>
                  {t("picture_games.describe.missed")}{" "}
                  <span lang={dialect} className="font-black">
                    {result.missed.map((entry) => entry.word).join(", ")}
                  </span>
                </p>
              )}
            </div>

            <div className={`${card} flex flex-col gap-3`}>
              <AiNotice isDarkMode={isDarkMode} variant="output" />
              {result.feedback && (
                <p className={`text-base font-semibold leading-relaxed ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {result.feedback}
                </p>
              )}

              {result.corrections.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className={`text-xs font-black uppercase tracking-widest ${muted}`}>
                    {t("picture_games.describe.corrections")}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {result.corrections.map((entry) => (
                      <li key={`${entry.original}|${entry.corrected}`} className="flex flex-col gap-0.5" lang={dialect}>
                        <span className="flex flex-wrap items-center gap-2 font-bold">
                          <span className="line-through decoration-rose-500 text-rose-500">{entry.original}</span>
                          <ArrowRight size={14} aria-hidden="true" className={muted} />
                          <span className="text-emerald-600 dark:text-emerald-400">{entry.corrected}</span>
                        </span>
                        {entry.explanation && (
                          <span className={`text-sm font-semibold ${muted}`}>{entry.explanation}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.tryNext.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className={`text-xs font-black uppercase tracking-widest ${muted}`}>
                    {t("picture_games.describe.try_next")}
                  </h3>
                  <ul className="flex flex-col gap-1">
                    {result.tryNext.map((entry) => (
                      <li key={entry.word} lang={dialect} className="font-bold">
                        {entry.question}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <PrimaryButton onClick={loadNext} isDarkMode={isDarkMode} color="sky">
                {t("picture_games.describe.next_scene")}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in">
      <div className="flex flex-col flex-1 min-w-0 w-full">{main}</div>
      {sidebar}
    </div>
  );
};

PictureDescribeGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureDescribeGame;
