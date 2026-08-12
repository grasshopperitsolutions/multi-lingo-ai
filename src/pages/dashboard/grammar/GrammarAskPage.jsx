import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Send, FileUp, X } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { isGrammarSupported } from "../../../config/grammarSupport";
import { getTopics, askGrammar } from "../../../services/grammarService";
import { extractPdfText, MAX_PDF_CHARS } from "../../../utils/pdfText";
import GrammarExampleList from "../../../components/GrammarExampleList";
import Loader from "../../../components/Loader";
import { FeaturePageShell, Card, ErrorBanner, PrimaryButton, GhostButton } from "../../../components/ui";

const MAX_QUESTION_CHARS = 500;

/**
 * GrammarAskPage
 *
 * Free-text grammar questions, optionally about a passage the learner pastes
 * or extracts from a PDF.
 *
 * Answers are not cached: questions are personal and rarely repeat, so writing
 * them to the shared pool would only add noise.
 */
const GrammarAskPage = () => {
  const { isDarkMode, user, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [userText, setUserText] = useState("");
  const [pdfName, setPdfName] = useState(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [topicKeys, setTopicKeys] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const targetLang = user?.learningDialect;
  const supported = isGrammarSupported(targetLang);

  // Topic keys are passed to the prompt so the answer can cross-link into the
  // library. Failing to load them is not fatal — the answer just has no links.
  useEffect(() => {
    if (!user?.token || !supported) return;
    let cancelled = false;

    getTopics({ token: user.token, targetLang })
      .then((topics) => { if (!cancelled) setTopicKeys(topics.map((topic) => topic.key)); })
      .catch(() => { /* cross-links are optional */ });

    return () => { cancelled = true; };
  }, [user, targetLang, supported]);

  const handlePdfSelect = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setIsParsingPdf(true);
    setError(null);
    try {
      const { text, truncated } = await extractPdfText(file);
      setUserText(text);
      setPdfName(file.name);
      if (truncated) {
        showAlert("info", t("grammar.pdf_truncated", { chars: MAX_PDF_CHARS }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;

    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    setIsAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await askGrammar({
        token: user.token,
        question,
        userText,
        targetLang,
        explanationLocale: interfaceLang,
        // There's no per-user CEFR level stored on the profile (only per-exercise
        // level pickers exist); A2 is a plain default, not a fallback for a real field.
        level: "A2",
        topicKeys,
      });
      setAnswer(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAsking(false);
    }
  };

  const breadcrumbItems = [
    { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
    { label: t("dashboard.grammar"), onClick: () => navigate("/dashboard/grammar") },
    { label: t("grammar.ask") },
  ];

  if (!supported) {
    return (
      <FeaturePageShell isDarkMode={isDarkMode} accentColor="amber" breadcrumbItems={breadcrumbItems}>
        <Card isDarkMode={isDarkMode}>
          <p className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
            {t("grammar.not_available_for_language")}
          </p>
        </Card>
      </FeaturePageShell>
    );
  }

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-semibold outline-none transition-colors resize-y ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-amber-500"
  }`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  return (
    <FeaturePageShell isDarkMode={isDarkMode} accentColor="amber" breadcrumbItems={breadcrumbItems}>
      <Card isDarkMode={isDarkMode}>
        <label htmlFor="grammar-question" className={labelClasses}>
          {t("grammar.your_question")}
        </label>
        <textarea
          id="grammar-question"
          rows={3}
          maxLength={MAX_QUESTION_CHARS}
          className={inputClasses}
          placeholder={t("grammar.question_placeholder")}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <div className="mt-4">
          <label htmlFor="grammar-text" className={labelClasses}>
            {t("grammar.optional_text")}
          </label>
          <textarea
            id="grammar-text"
            rows={5}
            className={inputClasses}
            placeholder={t("grammar.text_placeholder")}
            value={userText}
            onChange={(e) => { setUserText(e.target.value); setPdfName(null); }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handlePdfSelect}
          />
          <GhostButton
            onClick={() => fileInputRef.current?.click()}
            disabled={isParsingPdf}
            isDarkMode={isDarkMode}
          >
            <FileUp size={16} />
            {isParsingPdf ? t("grammar.reading_pdf") : t("grammar.upload_pdf")}
          </GhostButton>

          {pdfName && (
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-bold ${
              isDarkMode ? "border-slate-600 text-slate-300" : "border-slate-300 text-slate-600"
            }`}>
              {pdfName}
              <button
                type="button"
                onClick={() => { setPdfName(null); setUserText(""); }}
                aria-label={t("common.remove", "Remove")}
                className="hover:text-rose-500"
              >
                <X size={12} />
              </button>
            </span>
          )}

          <PrimaryButton
            onClick={handleAsk}
            disabled={!question.trim() || isAsking || isParsingPdf}
            loading={isAsking}
            isDarkMode={isDarkMode}
            color="amber"
            className="ml-auto"
          >
            <Send size={16} />
            {t("grammar.ask_button")}
          </PrimaryButton>
        </div>
      </Card>

      {isAsking && <Loader message={t("grammar.thinking")} isDarkMode={isDarkMode} />}

      {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {answer && (
        <div className="flex flex-col gap-4">
          <Card isDarkMode={isDarkMode}>
            {answer.answer.split("\n").filter(Boolean).map((paragraph, i) => (
              <p key={i} className={`mb-3 last:mb-0 ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                {paragraph}
              </p>
            ))}
          </Card>

          {answer.examples?.length > 0 && (
            <Card isDarkMode={isDarkMode}>
              <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                {t("grammar.examples")}
              </h3>
              <GrammarExampleList
                examples={answer.examples}
                targetLang={targetLang}
                isDarkMode={isDarkMode}
                keyPrefix="answer"
              />
            </Card>
          )}

          {answer.relatedTopicKeys?.length > 0 && (
            <Card isDarkMode={isDarkMode}>
              <h3 className={`text-xs font-black uppercase tracking-widest mb-3 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                {t("grammar.related_topics")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {answer.relatedTopicKeys.map((key) => (
                  <button
                    key={key}
                    onClick={() => navigate("/dashboard/grammar/structures")}
                    className={`px-3 py-1.5 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${
                      isDarkMode
                        ? "border-amber-500/50 text-amber-400 hover:bg-slate-800"
                        : "border-amber-400 text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    {t(`grammar.topic.${key}`, key.replace(/-/g, " "))}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </FeaturePageShell>
  );
};

export default GrammarAskPage;
