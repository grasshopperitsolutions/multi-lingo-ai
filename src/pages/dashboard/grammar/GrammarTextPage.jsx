import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileText, Sparkles } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { useTts } from "../../../hooks/useTts";
import { useWordFavourites } from "../../../hooks/useWordFavourites";
import { isAiDeclined } from "../../../services/aiService";
import { generatePracticeText } from "../../../services/grammarTextService";
import { getCefrLevelOptions } from "../../../config/examLevels";
import Loader from "../../../components/Loader";
import NeoDropdown from "../../../components/NeoDropdown";
import WordBankSidebar from "../../../components/WordBankSidebar";
import DownloadPdfButton from "../../../components/DownloadPdfButton";
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

  const [level, setLevel] = useState("A1");
  const [focus, setFocus] = useState("");
  const [selectedWords, setSelectedWords] = useState([]);
  const [text, setText] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

              <div className="flex items-center gap-3 mb-4">
                <LevelBadge level={text.level} isDarkMode={isDarkMode} color="amber" />
              </div>

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

              {text.paragraphs.map((paragraph, i) => (
                <p key={i} className={`mb-3 last:mb-0 leading-relaxed ${
                  isDarkMode ? "text-slate-300" : "text-slate-700"
                }`}>
                  {paragraph}
                </p>
              ))}

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
    </FeaturePageShell>
  );
};

export default GrammarTextPage;
