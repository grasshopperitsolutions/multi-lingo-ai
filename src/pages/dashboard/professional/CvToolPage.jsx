import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FileUp, X, Loader2, ClipboardCheck, Languages } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { useToneChoice } from "../../../hooks/useToneChoice";
import { isAiDeclined } from "../../../services/aiService";
import { reviewCv, translateDocument } from "../../../services/professionalToolsService";
import { extractPdfText } from "../../../utils/pdfText";
import ProToolShell from "../../../components/professional/ProToolShell";
import { Card, ErrorBanner, PrimaryButton, GhostButton, AiNotice } from "../../../components/ui";

/**
 * CvToolPage
 *
 * Review a CV for the market you are applying to, and optionally translate it.
 *
 * The hard constraint here is /api/ask-ai's 8000-character prompt cap. A CV is
 * the longest thing anyone will paste into this app, so the page is honest
 * about the budget in three places: a live counter under the box, an alert
 * when a PDF extract was cut short, and a standing line above the results
 * saying how much was actually reviewed. A review of the first half of a CV
 * presented as a review of the CV would be worse than no review at all.
 */

/** The share of the prompt budget the CV text itself may take. */
const CV_MAX_CHARS = 5000;

const CvToolPage = () => {
  const { isDarkMode, user, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { tone, setTone } = useToneChoice();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [cvText, setCvText] = useState("");
  const [roleHint, setRoleHint] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [isParsingPdf, setIsParsingPdf] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState(null);
  const [review, setReview] = useState(null);
  const [translation, setTranslation] = useState(null);

  const targetLang = user?.learningDialect;

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-semibold outline-none transition-colors resize-y ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-indigo-500"
  }`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  const overBudget = cvText.length > CV_MAX_CHARS;
  const counterColor = overBudget
    ? "text-rose-500"
    : cvText.length > CV_MAX_CHARS * 0.8
      ? "text-amber-500"
      : isDarkMode ? "text-slate-500" : "text-slate-400";

  const handlePdfSelect = async (event) => {
    const file = event.target.files?.[0];
    // Reset immediately so picking the same file twice still fires onChange.
    event.target.value = "";
    if (!file) return;

    setIsParsingPdf(true);
    setError(null);
    try {
      const { text, truncated } = await extractPdfText(file, { maxChars: CV_MAX_CHARS });
      setCvText(text);
      setPdfName(file.name);
      if (truncated) {
        showAlert("info", t("professional.cv_truncated", { chars: CV_MAX_CHARS }));
      }
    } catch {
      // extractPdfText throws a hard-coded English sentence on a scan. Say the
      // useful thing in the reader's own language instead of echoing it.
      setError(t("professional.cv_pdf_unreadable"));
    } finally {
      setIsParsingPdf(false);
    }
  };

  const guardAi = () => {
    if (canUseAI) return true;
    showAlert("warning", t("ai_usage.limit_reached"), {
      label: t("pricing.upgrade"),
      onClick: () => navigate("/pricing"),
    });
    return false;
  };

  const run = async (work) => {
    if (!cvText.trim() || !guardAi()) return;
    setIsWorking(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      if (isAiDeclined(err)) return;
      setError(
        err.code === "PROMPT_NOT_CONFIGURED"
          ? t("professional.not_configured")
          : err.message,
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleReview = () =>
    run(async () => {
      setTranslation(null);
      setReview(
        await reviewCv({
          token: user.token,
          cvText,
          targetLang,
          interfaceLang,
          tone,
          roleHint,
        }),
      );
    });

  const handleTranslate = () =>
    run(async () => {
      setReview(null);
      setTranslation(
        await translateDocument({
          token: user.token,
          text: cvText,
          sourceLang: interfaceLang,
          targetLang,
          tone,
          docType: "cv",
        }),
      );
    });

  return (
    <ProToolShell
      title={t("professional.cv_title")}
      isDarkMode={isDarkMode}
      tone={tone}
      onToneChange={setTone}
      toneDisabled={isWorking}
      reportContext="CvToolPage"
    >
      <Card isDarkMode={isDarkMode}>
        <label className={labelClasses} htmlFor="cv-role">
          {t("professional.cv_role_label")}
        </label>
        <input
          id="cv-role"
          type="text"
          value={roleHint}
          onChange={(e) => setRoleHint(e.target.value)}
          maxLength={120}
          placeholder={t("professional.cv_role_placeholder")}
          className={`${inputClasses} mb-5`}
        />

        <label className={labelClasses} htmlFor="cv-text">
          {t("professional.cv_text_label")}
        </label>
        <textarea
          id="cv-text"
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          rows={10}
          placeholder={t("professional.cv_text_placeholder")}
          className={inputClasses}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <span className={`text-xs font-bold tabular-nums ${counterColor}`}>
            {t("professional.cv_counter", { used: cvText.length, max: CV_MAX_CHARS })}
          </span>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handlePdfSelect}
            />
            <GhostButton
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingPdf || isWorking}
              isDarkMode={isDarkMode}
            >
              {isParsingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              {t("professional.cv_upload")}
            </GhostButton>
          </div>
        </div>

        {pdfName && (
          <div className={`inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full border-2 text-xs font-bold ${
            isDarkMode ? "bg-slate-900 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-300 text-slate-700"
          }`}>
            {pdfName}
            <button
              type="button"
              onClick={() => { setPdfName(""); setCvText(""); }}
              aria-label={t("common.remove")}
              className="p-1 rounded-full hover:text-rose-500"
            >
              <X size={12} strokeWidth={3} />
            </button>
          </div>
        )}

        {overBudget && (
          <p className="mt-3 text-xs font-bold text-rose-500">
            {t("professional.cv_over_budget", { max: CV_MAX_CHARS })}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <PrimaryButton
            onClick={handleReview}
            disabled={!cvText.trim() || isWorking}
            loading={isWorking}
            isDarkMode={isDarkMode}
            color="sky"
          >
            <ClipboardCheck size={16} />
            {t("professional.cv_review_action")}
          </PrimaryButton>
          <GhostButton
            onClick={handleTranslate}
            disabled={!cvText.trim() || isWorking}
            isDarkMode={isDarkMode}
          >
            <Languages size={16} />
            {t("professional.cv_translate_action")}
          </GhostButton>
        </div>
      </Card>

      {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {review && (
        <Card isDarkMode={isDarkMode}>
          <AiNotice isDarkMode={isDarkMode} className="mb-4" />

          {review.truncated && (
            <p className={`mb-4 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
              {t("professional.cv_reviewed_partial", {
                used: review.usedChars,
                total: review.totalChars,
              })}
            </p>
          )}

          <p className={`font-bold leading-relaxed mb-5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {review.summary}
          </p>

          {review.strengths.length > 0 && (
            <div className="mb-5">
              <h3 className={labelClasses}>{t("professional.cv_strengths")}</h3>
              <ul className="flex flex-col gap-1.5">
                {review.strengths.map((item, i) => (
                  <li key={i} className={`text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className={labelClasses}>{t("professional.cv_issues")}</h3>
          <div className="flex flex-col gap-3">
            {review.issues.map((issue, i) => (
              <div
                key={i}
                className={`rounded-xl border-2 p-3 ${
                  isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"
                }`}
              >
                <p className={`text-xs font-black uppercase tracking-widest mb-1 ${
                  isDarkMode ? "text-indigo-400" : "text-indigo-600"
                }`}>
                  {issue.where}
                </p>
                <p className={`text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                  {issue.problem}
                </p>
                <p className={`text-sm font-bold mt-1.5 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {issue.fix}
                </p>
              </div>
            ))}
          </div>

          {review.languageNotes.length > 0 && (
            <div className="mt-5">
              <h3 className={labelClasses}>{t("professional.cv_language_notes")}</h3>
              <ul className="flex flex-col gap-1.5">
                {review.languageNotes.map((note, i) => (
                  <li key={i} className={`text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {translation && (
        <Card isDarkMode={isDarkMode}>
          <AiNotice isDarkMode={isDarkMode} className="mb-4" />
          {translation.truncated && (
            <p className={`mb-4 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
              {t("professional.cv_reviewed_partial", {
                used: translation.usedChars,
                total: translation.totalChars,
              })}
            </p>
          )}
          <pre className={`whitespace-pre-wrap font-semibold text-sm leading-relaxed ${
            isDarkMode ? "text-slate-200" : "text-slate-800"
          }`}>
            {translation.translation}
          </pre>
          {translation.notes.length > 0 && (
            <ul className="flex flex-col gap-1.5 mt-4">
              {translation.notes.map((note, i) => (
                <li key={i} className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </ProToolShell>
  );
};

export default CvToolPage;
