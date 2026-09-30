import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { useTts } from "../../../hooks/useTts";
import { useWordFavourites } from "../../../hooks/useWordFavourites";
import { isAiDeclined } from "../../../services/aiService";
import { generatePracticeText, translatePracticeText } from "../../../services/grammarTextService";
import { useWordLookup } from "../../../hooks/useWordLookup";
import { getCefrLevelOptions } from "../../../config/examLevels";
import { usePracticeLevel } from "../../../hooks/usePracticeLevel";
import DefaultLevelLink from "../../../components/DefaultLevelLink";
import Loader from "../../../components/Loader";
import NeoDropdown from "../../../components/NeoDropdown";
import WordBankSidebar from "../../../components/WordBankSidebar";
import DownloadPdfButton from "../../../components/DownloadPdfButton";
import TappableParagraph from "../../../components/TappableParagraph";
import WordLookupSheet from "../../../components/WordLookupSheet";
import {
  FeaturePageShell,
  Card,
  ErrorBanner,
  PrimaryButton,
  LevelBadge,
  TtsControls,
  AiNotice,
} from "../../../components/ui";

/**
 * GrammarTextPage — Practice Text
 *
 * A short passage written around whatever the learner says they want to work
 * on. The nearest thing to it in the app is the Tale Creator, and the
 * difference is the whole point of it existing: a tale is written to be
 * enjoyed and deliberately told *not* to drill a structure, while this is
 * written to be picked apart. Hence what surrounds the prose — the note saying
 * what to look for, and the list of the forms it actually used.
 *
 * **Every press generates.** There is no pool: the request is a sentence
 * somebody typed, so there is nothing to match a cached text against. See
 * grammarTextService for why that is not worth fixing.
 *
 * **Not gated on the learning language**, unlike its four neighbours in the
 * grammar hub. Those serve the hand-written pt-PT library; this one writes
 * from scratch and so has nothing to be missing.
 */

/** Same cap as the Tale Creator — the sidebar is shared, and so is the reason. */
const MAX_SELECTED_WORDS = 5;

const GrammarTextPage = () => {
  const { isDarkMode, user, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { ttsState, playTts, pauseTts, stopTts } = useTts();
  const { words: bankedWords, remove: removeBanked } = useWordFavourites();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { level, setLevel } = usePracticeLevel();
  const [focus, setFocus] = useState("");
  const [selectedWords, setSelectedWords] = useState([]);
  const [text, setText] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Tap a word to look it up, hold it to bank it — as in the Tale Creator.
  const { activeWord, activeSentence, lookup, close: closeLookup, bank } = useWordLookup();

  // The translation, fetched the first time the reader opens one and kept for
  // as long as the text is on screen. Nothing is stored: the text itself is
  // never stored either (grammarTextService).
  const [translation, setTranslation] = useState(null);
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false);
  const [translationError, setTranslationError] = useState(null);
  const [revealed, setRevealed] = useState([]);
  // The in-flight request, so opening three paragraphs at once asks once.
  const translationRequestRef = useRef(null);

  const targetLang = user?.learningDialect;
  const cefrLevelOptions = getCefrLevelOptions(t);

  const handleToggleSelect = (word) => {
    setSelectedWords((prev) => {
      if (prev.includes(word)) return prev.filter((w) => w !== word);
      if (prev.length >= MAX_SELECTED_WORDS) return prev;
      return [...prev, word];
    });
  };

  const handleGenerate = async () => {
    // Checked before the AI gate rather than after: "you have no calls left"
    // is the wrong thing to say to someone who has not filled in the one field
    // the feature needs.
    if (!focus.trim()) {
      showAlert("warning", t("grammar.text_focus_required"));
      return;
    }
    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await generatePracticeText({
        token: user.token,
        targetLang,
        explanationLang: interfaceLang,
        level,
        focus,
        requiredWords: selectedWords,
      });
      setText(result);
      // A new text starts closed and untranslated, like the last one did.
      setTranslation(null);
      setTranslationError(null);
      setRevealed([]);
      translationRequestRef.current = null;
      // Spent. Left selected, the next press would silently ask for the same
      // words again — the same reason the Tale Creator clears them.
      setSelectedWords([]);
    } catch (err) {
      // The user chose not to spend an AI call — not an error worth a banner.
      if (isAiDeclined(err)) return;
      const message = err.message ?? t("common.error", "Something went wrong. Please try again.");
      setError(message);
      showAlert("error", message, { label: t("common.try_again", "Try Again"), onClick: handleGenerate });
    } finally {
      setIsLoading(false);
    }
  };

  // Reading the text in the language it is written in needs no translation.
  const showBilingual = !!text && interfaceLang !== text.targetLang;
  const paragraphCount = text?.paragraphs?.length ?? 0;
  const allRevealed = paragraphCount > 0 && revealed.length === paragraphCount;

  const ensureTranslation = useCallback(() => {
    if (translation) return Promise.resolve(translation);
    if (translationRequestRef.current) return translationRequestRef.current;
    if (!text || interfaceLang === text.targetLang) return Promise.resolve(null);

    setIsLoadingTranslation(true);
    setTranslationError(null);

    const request = translatePracticeText({
      token: user.token,
      sourceLang: text.targetLang,
      locale: interfaceLang,
      title: text.title,
      paragraphs: text.paragraphs,
    })
      .then((result) => {
        setTranslation(result);
        return result;
      })
      .catch((err) => {
        if (!isAiDeclined(err)) setTranslationError(err.message);
        return null;
      })
      .finally(() => {
        setIsLoadingTranslation(false);
        translationRequestRef.current = null;
      });

    translationRequestRef.current = request;
    return request;
  }, [translation, text, interfaceLang, user]);

  // Awaited before revealing, so an open paragraph always has something under it.
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
    if (ready) setRevealed(text.paragraphs.map((_, i) => i));
  };

  // One string for the whole passage, so listening plays straight through.
  const spokenText = text
    ? [text.title, ...(text.paragraphs ?? [])].filter(Boolean).join("\n\n")
    : "";

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-semibold outline-none transition-colors disabled:opacity-50 ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-teal-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-teal-500"
  }`;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      showPracticeLanguage
      accentColor="amber"
      title={t("grammar.text")}
      reportContext="GrammarTextPage"
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("dashboard.grammar"), onClick: () => navigate("/dashboard/grammar") },
        { label: t("grammar.text") },
      ]}
    >
      <div className="flex flex-col lg:flex-row gap-5">
        <WordBankSidebar
          words={bankedWords}
          selected={selectedWords}
          onToggleSelect={handleToggleSelect}
          onRemove={removeBanked}
          maxSelected={MAX_SELECTED_WORDS}
          // Always selectable, unlike the Tale Creator's. There, picking words
          // forces a generation that would otherwise have come free from the
          // pool, so it is gated with the custom-request box. Here every press
          // generates whatever you do, so there is nothing to gate.
          canSelect
          hintKey="word_bank.select_hint_practice"
          isDarkMode={isDarkMode}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="practice-focus"
                className={`block text-xs font-black uppercase tracking-widest mb-2 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {t("grammar.text_focus_label")}
              </label>
              <textarea
                id="practice-focus"
                rows={2}
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder={t("grammar.text_focus_placeholder")}
                disabled={isLoading}
                maxLength={200}
                className={`${inputClasses} resize-y`}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <NeoDropdown
                options={cefrLevelOptions}
                value={level}
                onChange={setLevel}
                isDarkMode={isDarkMode}
                label={t("exam.sidebar.level", "Level")}
                className="flex-1"
              />
              <PrimaryButton
                onClick={handleGenerate}
                disabled={isLoading}
                loading={isLoading}
                isDarkMode={isDarkMode}
                color="amber"
              >
                <Sparkles size={16} />
                {text ? t("grammar.text_generate_another") : t("grammar.text_generate")}
              </PrimaryButton>
            </div>
            <DefaultLevelLink isDarkMode={isDarkMode} />

            {/* Before anything is generated, per Terms §3.3. */}
            <AiNotice isDarkMode={isDarkMode} variant="input" />
          </div>

          {isLoading && <Loader message={t("grammar.text_loading")} isDarkMode={isDarkMode} />}

          {!isLoading && error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

          {!isLoading && !error && !text && (
            <Card isDarkMode={isDarkMode}>
              <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                {t("grammar.text_empty_state")}
              </p>
            </Card>
          )}

          {!isLoading && text && (
            <Card isDarkMode={isDarkMode}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`shrink-0 p-2 rounded-lg border-2 ${
                  isDarkMode ? "border-teal-500/50 text-teal-400" : "border-teal-400 text-teal-600"
                }`}>
                  <FileText size={16} />
                </div>
                <h2 className={`text-xl font-black tracking-tight flex-1 min-w-0 ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}>
                  {text.title}
                </h2>

                <DownloadPdfButton
                  title={text.title}
                  paragraphs={text.paragraphs}
                  languageLabel={text.targetLang}
                  isDarkMode={isDarkMode}
                />

                {/* Out of the shared clip cache, for two reasons that each
                    stand alone. The passage is written around this user's own
                    word bank and the focus they typed; and grammarTextService
                    persists nothing, so every generation is unique and a
                    cached clip could never be hit a second time. */}
                <TtsControls
                  cacheable={false}
                  ttsKey="grammar-practice-text"
                  text={spokenText}
                  lang={text.targetLang}
                  token={user?.token}
                  accent="amber"
                  ttsState={ttsState}
                  playTts={playTts}
                  pauseTts={pauseTts}
                  stopTts={stopTts}
                  isDarkMode={isDarkMode}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-4">
                <LevelBadge level={text.level} isDarkMode={isDarkMode} color="amber" />
                {showBilingual && (
                  <button
                    type="button"
                    onClick={toggleAllRevealed}
                    disabled={isLoadingTranslation}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 disabled:opacity-40 ${
                      isDarkMode
                        ? "border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
                        : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600"
                    }`}
                  >
                    {isLoadingTranslation
                      ? <Loader2 size={13} className="animate-spin" />
                      : allRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    {allRevealed ? t("story.hide_all_translations") : t("story.show_all_translations")}
                  </button>
                )}
              </div>

              {showBilingual && translationError && !translation && (
                <p className={`mb-3 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
                  {t("story.translation_unavailable")}
                </p>
              )}

              {/* Above the passage, not below it: knowing what to watch for is
                  what turns reading it into practising. */}
              {text.focusNote && (
                <div className={`mb-4 px-4 py-3 rounded-xl border-2 ${
                  isDarkMode
                    ? "bg-slate-900 border-teal-800 text-teal-200"
                    : "bg-teal-50 border-teal-300 text-teal-900"
                }`}>
                  <p className="text-[11px] font-black uppercase tracking-widest opacity-70">
                    {t("grammar.text_what_to_look_for")}
                  </p>
                  <p className="text-sm font-bold mt-1">{text.focusNote}</p>
                </div>
              )}

              {text.paragraphs.map((paragraph, i) => {
                const translatedParagraph = translation?.paragraphs?.[i];
                const isRevealed = revealed.includes(i);
                return (
                  <div key={i} className="mb-4 last:mb-0">
                    <TappableParagraph
                      text={paragraph}
                      lang={text.targetLang}
                      onLookup={lookup}
                      onBank={bank}
                      isDarkMode={isDarkMode}
                      className={`leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}
                    />

                    {/* Offered before the translation exists, because pressing
                        it is what fetches it. */}
                    {showBilingual && (
                      <button
                        type="button"
                        onClick={() => toggleRevealed(i)}
                        disabled={isLoadingTranslation}
                        aria-expanded={isRevealed}
                        className={`mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 ${
                          isDarkMode
                            ? "border-slate-700 text-slate-400 hover:text-slate-200"
                            : "border-slate-200 text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {isRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                        {isRevealed ? t("story.hide_translation") : t("story.show_translation")}
                      </button>
                    )}

                    {translatedParagraph && isRevealed && (
                      <p
                        lang={interfaceLang}
                        className={`mt-2 leading-relaxed text-justify hyphens-auto rounded-xl border-2 px-3 py-2 ${
                          isDarkMode
                            ? "border-slate-700 bg-slate-900/40 text-slate-400"
                            : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {translatedParagraph}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* After the passage, so it reads as an answer key rather than a
                  spoiler. Absent when the model returned none, which is not an
                  error — the prose is still the thing that was asked for. */}
              {text.highlights.length > 0 && (
                <div className="mt-5">
                  <p className={`text-[11px] font-black uppercase tracking-widest mb-2 ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}>
                    {t("grammar.text_examples_in_text")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {text.highlights.map((item) => (
                      <span
                        key={item}
                        className={`px-2.5 py-1 rounded-full border-2 text-xs font-bold break-words ${
                          isDarkMode
                            ? "bg-slate-900 border-slate-600 text-slate-200"
                            : "bg-white border-slate-400 text-slate-700"
                        }`}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <WordLookupSheet
        word={activeWord}
        sentence={activeSentence ?? undefined}
        targetLang={targetLang}
        isDarkMode={isDarkMode}
        onClose={closeLookup}
      />
    </FeaturePageShell>
  );
};

export default GrammarTextPage;
