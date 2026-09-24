import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Volume2, Square, MousePointerClick, Loader2, Eye, EyeOff } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "../hooks/useTierAccess";
import { useInterestTopics } from "../hooks/useInterestTopics";
import { useTts } from "../hooks/useTts";
import { useWordFavourites } from "../hooks/useWordFavourites";
import { useLongPress } from "../hooks/useLongPress";
import { getStory, getStoryTranslation, getStoryPoolStatus } from "../services/storyService";
import { markStorySeen } from "../services/userService";
import { tokenizeWords } from "../utils/tokenizeWords";
import { sentenceAt } from "../utils/sentenceAt";
import { getCefrLevelOptions } from "../config/examLevels";
import { STORY_THEMES, DEFAULT_STORY_THEME, CUSTOM_STORY_THEME } from "../config/storyThemes";
import Loader from "./Loader";
import NeoDropdown from "./NeoDropdown";
import CustomRequestInput from "./CustomRequestInput";
import WordLookupSheet from "./WordLookupSheet";
import WordBankSidebar from "./WordBankSidebar";
import DownloadPdfButton from "./DownloadPdfButton";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton, LevelBadge } from "./ui";

/**
 * StoryReader
 *
 * Read + listen only, per the Phase 2 scope — no comprehension questions.
 *
 * The transcript is shown in the learning language, with the interface-language
 * translation **collapsed per paragraph**. Revealing it is a deliberate act:
 * with both columns open from the start the eye goes straight to the language
 * it already knows and the target text is never really read. The title is the
 * exception and is always translated — it is the one line that tells a reader
 * whether this story is worth their time before they start.
 *
 * Fetching the translation is best-effort and never blocks the reading
 * experience: if it fails (AI quota, network), the story still renders in its
 * original language with a quiet notice instead of an error state.
 */

/** How many banked words can be pushed into one generation. See WordBankSidebar. */
const MAX_SELECTED_WORDS = 5;

/**
 * One tappable word in a paragraph.
 *
 * Its own component because the tap/hold gesture needs a hook, and hooks
 * cannot be called from inside the token map.
 */
const StoryWord = ({ text, word, onLookup, onBank, isDarkMode }) => {
  const handlers = useLongPress({
    onClick: () => onLookup(word),
    onLongPress: () => onBank(word),
  });

  return (
    // A tab stop per word would make a paragraph unusable for keyboard users —
    // tabIndex={-1} keeps it clickable/tappable and reachable by a screen
    // reader's virtual cursor without adding to the tab order.
    // select-none is what stops a hold raising the text-selection UI over the
    // word being held on touch devices.
    <span
      role="button"
      tabIndex={-1}
      {...handlers}
      className={`rounded transition-colors cursor-pointer select-none ${
        isDarkMode ? "hover:bg-slate-700" : "hover:bg-amber-100"
      }`}
    >
      {text}
    </span>
  );
};

StoryWord.propTypes = {
  text: PropTypes.string.isRequired,
  word: PropTypes.string.isRequired,
  onLookup: PropTypes.func.isRequired,
  onBank: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const StoryReader = ({ isDarkMode }) => {
  const { user, setUser, interfaceLang, showAlert, supportedLanguages } = useAppContext();
  const { canUseAI, canAccess } = useTierAccess();
  const { topics } = useInterestTopics();
  const { ttsState, playTts, stopTts } = useTts();
  const { words: bankedWords, isFavourite: isBanked, toggle: toggleBanked, remove: removeBanked } = useWordFavourites();
  const { t } = useTranslation();

  // Built inline rather than memoised: six t() calls cost nothing, and a memo
  // here only invites the labels going stale when the interface language
  // changes without `t` changing identity.
  const cefrLevelOptions = getCefrLevelOptions(t);
  const navigate = useNavigate();

  const [level, setLevel] = useState("A1");
  const [theme, setTheme] = useState(DEFAULT_STORY_THEME);
  const [customTheme, setCustomTheme] = useState("");
  const [description, setDescription] = useState("");
  const [cacheExhausted, setCacheExhausted] = useState(false);
  const [story, setStory] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [isLoadingStory, setIsLoadingStory] = useState(false);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [error, setError] = useState(null);
  const [translationError, setTranslationError] = useState(null);
  const [activeWord, setActiveWord] = useState(null);
  // The sentence the word was tapped in, so the lookup can describe the sense
  // the reader actually met rather than the word's commonest one.
  const [activeSentence, setActiveSentence] = useState(null);
  const [selectedWords, setSelectedWords] = useState([]);
  // Indices whose translation the reader has opened. Reset with each story so
  // a new one starts closed like the last one did.
  const [revealed, setRevealed] = useState([]);
  // The in-flight translation request, so opening three paragraphs at once
  // asks for it once.
  const translationRequestRef = useRef(null);

  const targetLang = user?.learningDialect;
  // The reader's own language list already holds the human-readable name; the
  // PDF prints it rather than the raw BCP-47 code.
  const targetLanguageLabel =
    supportedLanguages?.find((lang) => lang.code === targetLang)?.label ?? targetLang ?? "";
  const showBilingual = !!story && interfaceLang !== story.targetLang;

  // Same rule the custom-description box uses: anything that forces a fresh
  // generation unlocks together with it, rather than opening a second route to
  // the same AI call. That covers both the selected words and a written-in
  // theme — a preset theme can be served from the shared pool, arbitrary words
  // never can.
  const canCustomise = canAccess("custom_requests") || cacheExhausted;

  // "Other" is dropped from the picker rather than shown locked: the page
  // already renders one upgrade prompt for the description box, and two
  // identical locks stacked on one screen explain the tier worse than one does.
  const themeOptions = STORY_THEMES
    .filter((option) => option.id !== CUSTOM_STORY_THEME || canCustomise)
    .map((option) => ({ value: option.id, label: t(option.labelKey) }));

  // Reading the last unseen tale can flip `cacheExhausted` back to false, which
  // would take "Other" out of the list while it was still the selected value —
  // leaving the dropdown showing the first option and the request sending a
  // theme the reader can no longer see. Derived rather than corrected in an
  // effect, so there is no frame where the two disagree.
  const activeTheme = theme === CUSTOM_STORY_THEME && !canCustomise ? DEFAULT_STORY_THEME : theme;

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

  // A word removed from the bank must not stay queued for the next story.
  //
  // Keyed on the contents, not the array: getFavouriteIds hands back a fresh
  // [] whenever the profile has no favWordIds field yet, so depending on the
  // array itself re-runs this on every render. Returning `prev` unchanged is
  // the other half — React bails out of the re-render instead of taking a new
  // array that happens to hold the same words, which is what turned this into
  // an infinite loop the first time round.
  const bankedKey = bankedWords.join("\u0000");
  useEffect(() => {
    setSelectedWords((prev) => {
      const next = prev.filter((word) => bankedKey.split("\u0000").includes(word));
      return next.length === prev.length ? prev : next;
    });
  }, [bankedKey]);

  const handleBankWord = (word) => {
    const alreadyBanked = isBanked(word);
    toggleBanked(word);
    // A hold has no visible result of its own — without this the reader can't
    // tell whether they held long enough.
    showAlert(
      "success",
      alreadyBanked ? t("word_bank.removed", { word }) : t("word_bank.added", { word }),
    );
  };

  const handleToggleSelect = (word) => {
    setSelectedWords((prev) =>
      prev.includes(word)
        ? prev.filter((existing) => existing !== word)
        : prev.length >= MAX_SELECTED_WORDS ? prev : [...prev, word],
    );
  };

  /**
   * Fetch the translation, once, the first time somebody asks to see one.
   *
   * It used to be fetched the moment a story loaded, while every paragraph
   * rendered collapsed — so the call happened whether or not anyone opened
   * one, and most readers never do. The result is cached per locale in
   * Firestore, so this only ever cost the *first* reader of a story in a given
   * language; that is still a reader paying for something they did not ask
   * for.
   */
  const ensureTranslation = useCallback(() => {
    if (translation) return Promise.resolve(translation);
    if (translationRequestRef.current) return translationRequestRef.current;
    if (!story || interfaceLang === story.targetLang) return Promise.resolve(null);

    setIsLoadingTranslation(true);
    setTranslationError(null);

    const request = getStoryTranslation({
      token: user.token,
      storyId: story.storyId,
      sourceLang: story.targetLang,
      sourceTitle: story.title,
      sourceParagraphs: story.paragraphs,
      locale: interfaceLang,
    })
      .then((result) => {
        setTranslation(result);
        return result;
      })
      .catch((err) => {
        setTranslationError(err.message);
        return null;
      })
      .finally(() => {
        setIsLoadingTranslation(false);
        translationRequestRef.current = null;
      });

    translationRequestRef.current = request;
    return request;
  }, [translation, story, interfaceLang, user]);

  // Awaited before revealing rather than revealed optimistically, so an open
  // paragraph always has something under it; the loading line above covers
  // the wait.
  const toggleRevealed = async (index) => {
    if (revealed.includes(index)) {
      setRevealed((prev) => prev.filter((i) => i !== index));
      return;
    }
    const ready = await ensureTranslation();
    if (ready) setRevealed((prev) => (prev.includes(index) ? prev : [...prev, index]));
  };

  const toggleAllRevealed = async () => {
    if (allRevealed) {
      setRevealed([]);
      return;
    }
    const ready = await ensureTranslation();
    if (ready) setRevealed(story.paragraphs.map((_, i) => i));
  };

  // Optional-chained on purpose: a story whose content failed to load arrives
  // with no `paragraphs` at all, and a reader that throws on it replaces the
  // page with an error boundary instead of the empty state it should show.
  const paragraphCount = story?.paragraphs?.length ?? 0;
  const allRevealed = paragraphCount > 0 && revealed.length === paragraphCount;

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
    setRevealed([]);
    translationRequestRef.current = null;

    try {
      const seenStoryIds = user?.seenStoryIds ?? [];
      const requiredWords = canCustomise ? selectedWords : [];
      const result = await getStory({
        token: user.token, level, targetLang, interests: topics, seenStoryIds, description, requiredWords,
        theme: activeTheme,
        customTheme: activeTheme === CUSTOM_STORY_THEME ? customTheme : "",
      });
      setStory(result);
      // Spent — leaving them selected would make the next "new story" press
      // silently generate again instead of drawing from the pool.
      setSelectedWords([]);

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
      showPracticeLanguage
      accentColor="rose"
      title={t("dashboard.story_generator")}
      reportContext="StoryReader"
      breadcrumbItems={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
    >
      <div className="flex flex-col lg:flex-row gap-5">
        <WordBankSidebar
          words={bankedWords}
          selected={selectedWords}
          onToggleSelect={handleToggleSelect}
          onRemove={removeBanked}
          maxSelected={MAX_SELECTED_WORDS}
          canSelect={canCustomise}
          isDarkMode={isDarkMode}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <NeoDropdown
                options={cefrLevelOptions}
                value={level}
                onChange={setLevel}
                isDarkMode={isDarkMode}
                label={t("exam.sidebar.level", "Level")}
                className="flex-1"
              />
              {/* Level and theme are one decision made twice, so they share a
                  row and the button sits after both — pressing it before
                  picking a theme is the thing that shouldn't be easy. */}
              <NeoDropdown
                options={themeOptions}
                value={activeTheme}
                onChange={setTheme}
                isDarkMode={isDarkMode}
                label={t("story.theme_label")}
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

            {/* Same component as the description box below, because it is the
                same bargain: arbitrary words can never be served from the
                shared pool, so this always spends a generation. Only reachable
                once "Other" is in the picker, which is already the unlocked
                case — so its locked state never renders here. */}
            {activeTheme === CUSTOM_STORY_THEME && (
              <CustomRequestInput
                value={customTheme}
                onChange={setCustomTheme}
                placeholder={t("story.theme_other_placeholder")}
                cacheExhausted={cacheExhausted}
                disabled={isLoadingStory}
                isDarkMode={isDarkMode}
              />
            )}

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

          {!isLoadingStory && story && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <LevelBadge level={story.level} isDarkMode={isDarkMode} color="sky" />
                  <h2 className={`text-xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {story.title}
                  </h2>
                </div>
                {/* Always shown, unlike the paragraphs: this is the line that
                    tells a reader what they are about to read. */}
                {translation?.title && (
                  <p className={`text-sm font-bold italic ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {translation.title}
                  </p>
                )}
              </div>

              {/* Tapping a word for a definition is the feature readers are least
                  likely to discover on their own — nothing about the paragraph
                  looks interactive until you happen to click it. */}
              <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
                isDarkMode
                  ? "border-slate-700 bg-slate-800/60 text-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}>
                <MousePointerClick size={14} className="shrink-0" />
                {/* Two keys, not one edited sentence: a fill only ever adds
                    keys that are missing, so rewording an existing string
                    would never reach the locales that already have it. */}
                <p className="text-xs font-bold">
                  {t("story.tap_word_hint")}{" "}
                  <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>
                    {t("story.hold_word_hint")}
                  </span>
                </p>
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

              {/* One press for the whole story, once a reader has decided they
                  want it — five paragraphs is five presses otherwise. The PDF
                  sits beside it: both are things you do to the whole story
                  rather than to one paragraph. */}
              <div className="flex flex-wrap items-center gap-2">
                <DownloadPdfButton
                  title={story.title}
                  paragraphs={story.paragraphs}
                  level={story.level}
                  languageLabel={targetLanguageLabel}
                  isDarkMode={isDarkMode}
                />
              {showBilingual && (
                <button
                  type="button"
                  onClick={toggleAllRevealed}
                  disabled={isLoadingTranslation}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${
                    isDarkMode
                      ? "border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
                      : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600"
                  }`}
                >
                  {allRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  {allRevealed ? t("story.hide_all_translations") : t("story.show_all_translations")}
                </button>
              )}
              </div>

              <div className="flex flex-col gap-3">
                {story.paragraphs.map((paragraph, index) => {
                  const ttsKey = `story-para-${index}`;
                  const isActive = ttsState.activeKey === ttsKey;
                  // Gemini synthesis takes seconds; until it lands there is nothing
                  // to stop, so the button shows a spinner rather than a stop square.
                  const isGenerating = isActive && ttsState.isGenerating;
                  const isPlaying = isActive && !isGenerating;
                  const translatedParagraph = translation?.paragraphs?.[index];
                  const isRevealed = revealed.includes(index);

                  return (
                    <div
                      key={index}
                      className={`grid gap-3 ${
                        translatedParagraph && isRevealed ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      <Card isDarkMode={isDarkMode} className="!p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() =>
                              isActive
                                ? stopTts()
                                : playTts({ key: ttsKey, text: paragraph, lang: story.targetLang, token: user?.token })
                            }
                            aria-label={
                              isGenerating
                                ? t("translator.generating", "Preparing audio…")
                                : isPlaying
                                  ? t("common.stop", "Stop")
                                  : t("grammar.listen", "Listen")
                            }
                            aria-busy={isGenerating}
                            className={`p-1.5 rounded-lg border-2 transition-transform hover:scale-110 active:scale-95 ${
                              isDarkMode ? "border-amber-500/50 text-amber-400" : "border-amber-400 text-amber-600"
                            }`}
                          >
                            {isGenerating
                              ? <Loader2 size={12} className="animate-spin" />
                              : isPlaying
                                ? <Square size={12} />
                                : <Volume2 size={12} />}
                          </button>

                          {/* Offered before the translation exists, because
                              pressing this is what fetches it. */}
                          {showBilingual && (
                            <button
                              type="button"
                              onClick={() => toggleRevealed(index)}
                              disabled={isLoadingTranslation}
                              aria-expanded={isRevealed}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 ${
                                isDarkMode
                                  ? "border-slate-700 text-slate-400 hover:text-slate-200"
                                  : "border-slate-200 text-slate-500 hover:text-slate-900"
                              }`}
                            >
                              {isRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                              {isRevealed ? t("story.hide_translation") : t("story.show_translation")}
                            </button>
                          )}
                        </div>

                        <p className={`leading-relaxed ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                          {tokenizeWords(paragraph).map((token, i) =>
                            token.word ? (
                              <StoryWord
                                key={i}
                                text={token.text}
                                word={token.word}
                                onLookup={(tapped) => {
                                  setActiveWord(tapped);
                                  setActiveSentence(sentenceAt(paragraph, token.start, targetLang));
                                }}
                                onBank={handleBankWord}
                                isDarkMode={isDarkMode}
                              />
                            ) : (
                              <span key={i}>{token.text}</span>
                            )
                          )}
                        </p>
                      </Card>

                      {translatedParagraph && isRevealed && (
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
        </div>
      </div>

      <WordLookupSheet
        word={activeWord}
        sentence={activeSentence ?? undefined}
        targetLang={targetLang}
        isDarkMode={isDarkMode}
        onClose={() => {
          setActiveWord(null);
          setActiveSentence(null);
        }}
      />
    </FeaturePageShell>
  );
};

StoryReader.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default StoryReader;
