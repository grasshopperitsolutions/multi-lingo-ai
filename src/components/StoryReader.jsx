import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Volume2, Square } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import { useInterestTopics } from "../hooks/useInterestTopics";
import { useTts } from "../hooks/useTts";
import { getStory, getStoryTranslation, getStoryPoolStatus } from "../services/storyService";
import { markStorySeen } from "../services/userService";
import { tokenizeWords } from "../utils/tokenizeWords";
import Loader from "./Loader";
import NeoDropdown from "./NeoDropdown";
import CustomRequestInput from "./CustomRequestInput";
import WordLookupSheet from "./WordLookupSheet";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton, LevelBadge } from "./ui";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"].map((v) => ({ value: v, label: v }));

/**
 * StoryReader
 *
 * Read + listen only, per the Phase 2 scope — no comprehension questions.
 * The transcript is shown in both the learning language (with per-paragraph
 * audio and tap-to-look-up) and the reader's interface language side by side.
 *
 * Fetching the translation is best-effort and never blocks the reading
 * experience: if it fails (AI quota, network), the story still renders in its
 * original language with a quiet notice instead of an error state.
 */
const StoryReader = ({ isDarkMode }) => {
  const { user, setUser, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { topics } = useInterestTopics();
  const { ttsState, playTts, stopTts } = useTts();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [level, setLevel] = useState("A1");
  const [description, setDescription] = useState("");
  const [cacheExhausted, setCacheExhausted] = useState(false);
  const [story, setStory] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [error, setError] = useState(null);
  const [translationError, setTranslationError] = useState(null);
  const [activeWord, setActiveWord] = useState(null);

  const targetLang = user?.learningDialect;
  const showBilingual = !!story && interfaceLang !== story.targetLang;

  // Cheap, AI-free read: tells CustomRequestInput whether this reader has run
  // out of cached stories, which is what unlocks the box for limited tiers.
  // Re-runs on level change because the pool is per level.
  useEffect(() => {
    if (!user?.token || !targetLang) return;
    let cancelled = false;

    getStoryPoolStatus({
      token: user.token,
      level,
      targetLang,
      seenStoryIds: user?.seenStoryIds ?? [],
    })
      .then((status) => { if (!cancelled) setCacheExhausted(status.exhausted); })
      .catch(() => { /* leaving the box locked on failure is the safe default */ });

    return () => { cancelled = true; };
  }, [user, targetLang, level]);

  const handleGetStory = async () => {
    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    setIsLoadingStory(true);
    setError(null);
    setTranslation(null);
    setTranslationError(null);

    try {
      const seenStoryIds = user?.seenStoryIds ?? [];
      const result = await getStory({
        token: user.token, level, targetLang, interests: topics, seenStoryIds, description,
      });
      setStory(result);

      // Fire-and-forget from the reader's point of view — a failure here
      // shouldn't block having just gotten a story.
      markStorySeen(user.token, user.uid, result.storyId, seenStoryIds)
        .then(() => {
          setUser((prev) => ({
            ...prev,
            seenStoryIds: [...new Set([...seenStoryIds, result.storyId])],
          }));
        })
        .catch(() => { /* seen-tracking is best-effort; a repeat story later is a minor inconvenience, not a failure */ });

      if (interfaceLang !== result.targetLang) {
        setIsLoadingTranslation(true);
        getStoryTranslation({
          token: user.token,
          storyId: result.storyId,
          sourceLang: result.targetLang,
          sourceTitle: result.title,
          sourceParagraphs: result.paragraphs,
          locale: interfaceLang,
        })
          .then(setTranslation)
          .catch((err) => setTranslationError(err.message))
          .finally(() => setIsLoadingTranslation(false));
      }
    } catch (err) {
      const message = err.message ?? t("common.error", "Something went wrong. Please try again.");
      setError(message);
      showAlert("error", message, { label: t("common.try_again", "Try Again"), onClick: handleGetStory });
    } finally {
      setIsLoadingStory(false);
    }
  };

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      accentColor="rose"
      title={t("dashboard.story_generator")}
      reportContext="StoryReader"
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <NeoDropdown
            options={CEFR_LEVELS}
            value={level}
            onChange={setLevel}
            isDarkMode={isDarkMode}
            label={t("exam.sidebar.level", "Level")}
            className="flex-1"
          />
          <PrimaryButton
            onClick={handleGetStory}
            disabled={isLoadingStory}
            loading={isLoadingStory}
            isDarkMode={isDarkMode}
            color="sky"
          >
            <BookOpen size={16} />
            {story ? t("story.new_story") : t("story.get_story")}
          </PrimaryButton>
        </div>

        <CustomRequestInput
          value={description}
          onChange={setDescription}
          placeholder={t("story.description_placeholder")}
          cacheExhausted={cacheExhausted}
          disabled={isLoadingStory}
          isDarkMode={isDarkMode}
        />
      </div>

      {isLoadingStory && <Loader message={t("story.loading")} isDarkMode={isDarkMode} />}

      {!isLoadingStory && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {!isLoadingStory && !error && !story && (
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("story.empty_state")}
          </p>
        </Card>
      )}

      {!isLoadingStory && story && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <LevelBadge level={story.level} isDarkMode={isDarkMode} color="sky" />
            <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {story.title}
            </h2>
          </div>

          {showBilingual && isLoadingTranslation && !translation && (
            <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {t("story.translating")}
            </p>
          )}

          {showBilingual && translationError && !translation && (
            <p className={`text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
              {t("story.translation_unavailable")}
            </p>
          )}

          <div className="flex flex-col gap-3">
            {story.paragraphs.map((paragraph, index) => {
              const ttsKey = `story-para-${index}`;
              const isPlaying = ttsState.activeKey === ttsKey;
              const translatedParagraph = translation?.paragraphs?.[index];

              return (
                <div
                  key={index}
                  className={`grid gap-3 ${translatedParagraph ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
                >
                  <Card isDarkMode={isDarkMode} className="!p-4">
                    <button
                      type="button"
                      onClick={() =>
                        isPlaying
                          ? stopTts()
                          : playTts({ key: ttsKey, text: paragraph, lang: story.targetLang, token: user?.token })
                      }
                      aria-label={isPlaying ? t("common.stop", "Stop") : t("grammar.listen", "Listen")}
                      className={`mb-2 p-1.5 rounded-lg border-2 transition-transform hover:scale-110 active:scale-95 ${
                        isDarkMode ? "border-amber-500/50 text-amber-400" : "border-amber-400 text-amber-600"
                      }`}
                    >
                      {isPlaying ? <Square size={12} /> : <Volume2 size={12} />}
                    </button>
                    <p className={`leading-relaxed ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                      {tokenizeWords(paragraph).map((token, i) =>
                        token.word ? (
                          // A tab stop per word would make a paragraph unusable for
                          // keyboard users — tabIndex={-1} keeps it clickable/tappable
                          // and reachable by a screen reader's virtual cursor without
                          // adding to the tab order.
                          <span
                            key={i}
                            role="button"
                            tabIndex={-1}
                            onClick={() => setActiveWord(token.word)}
                            className={`rounded transition-colors cursor-pointer ${
                              isDarkMode ? "hover:bg-slate-700" : "hover:bg-amber-100"
                            }`}
                          >
                            {token.text}
                          </span>
                        ) : (
                          <span key={i}>{token.text}</span>
                        )
                      )}
                    </p>
                  </Card>

                  {translatedParagraph && (
                    <Card isDarkMode={isDarkMode} className="!p-4">
                      <p className={`leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                        {translatedParagraph}
                      </p>
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <WordLookupSheet
        word={activeWord}
        targetLang={targetLang}
        isDarkMode={isDarkMode}
        onClose={() => setActiveWord(null)}
      />
    </FeaturePageShell>
  );
};

StoryReader.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default StoryReader;
