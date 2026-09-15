import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Send, Copy, Check } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { useToneChoice } from "../../../hooks/useToneChoice";
import { isAiDeclined } from "../../../services/aiService";
import { EMAIL_MODES } from "../../../config/professionalTools";
import {
  writeEmail,
  reviewEmail,
  translateDocument,
} from "../../../services/professionalToolsService";
import ProToolShell from "../../../components/professional/ProToolShell";
import { Card, ErrorBanner, PrimaryButton, AiNotice } from "../../../components/ui";

/**
 * EmailToolPage
 *
 * Three things you might need to do to a work email, on one page: write it
 * from a brief, correct one you already wrote, or translate one.
 *
 * One page rather than three because the input is the same box and the tone
 * toggle is the same control — splitting them would mean choosing a route
 * before knowing which of the three you wanted.
 */
const EmailToolPage = () => {
  const { isDarkMode, user, interfaceLang, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { tone, setTone } = useToneChoice();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [mode, setMode] = useState(EMAIL_MODES.WRITE);
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const targetLang = user?.learningDialect;

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-semibold outline-none transition-colors resize-y ${
    isDarkMode
      ? "bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-400"
      : "bg-white border-slate-900 text-slate-900 placeholder-slate-400 focus:border-indigo-500"
  }`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  const modes = [
    { key: EMAIL_MODES.WRITE, label: t("professional.email_mode_write") },
    { key: EMAIL_MODES.REVIEW, label: t("professional.email_mode_review") },
    { key: EMAIL_MODES.TRANSLATE, label: t("professional.email_mode_translate") },
  ];

  const handleRun = async () => {
    if (!text.trim()) return;

    if (!canUseAI) {
      showAlert("warning", t("ai_usage.limit_reached"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
      return;
    }

    setIsWorking(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      if (mode === EMAIL_MODES.WRITE) {
        const written = await writeEmail({
          token: user.token, brief: text, targetLang, tone, recipient,
        });
        setResult({ kind: "write", ...written });
      } else if (mode === EMAIL_MODES.REVIEW) {
        const reviewed = await reviewEmail({
          token: user.token, draft: text, targetLang, interfaceLang, tone,
        });
        setResult({ kind: "review", ...reviewed });
      } else {
        // Translation shares one prompt with the CV tool — an email and a CV
        // want the same thing from a translator, in the same register.
        const translated = await translateDocument({
          token: user.token, text, sourceLang: interfaceLang, targetLang, tone, docType: "email",
        });
        setResult({ kind: "translate", ...translated });
      }
    } catch (err) {
      if (isAiDeclined(err)) return;
      setError(
        err.code === "PROMPT_NOT_CONFIGURED" ? t("professional.not_configured") : err.message,
      );
    } finally {
      setIsWorking(false);
    }
  };

  const bodyText =
    result?.kind === "write"
      ? `${result.subject}\n\n${result.body}`
      : result?.kind === "review"
        ? result.corrected
        : result?.translation ?? "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bodyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("error", t("common.error"));
    }
  };

  return (
    <ProToolShell
      title={t("professional.email_title")}
      isDarkMode={isDarkMode}
      tone={tone}
      onToneChange={setTone}
      toneDisabled={isWorking}
      reportContext="EmailToolPage"
    >
      <Card isDarkMode={isDarkMode}>
        {/* Mode first: it changes what the box below is asking for. */}
        <div className="flex flex-wrap gap-2 mb-5">
          {modes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => { setMode(item.key); setResult(null); }}
              aria-pressed={mode === item.key}
              className={`px-4 py-2.5 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${
                mode === item.key
                  ? isDarkMode
                    ? "bg-yellow-400 border-yellow-400 text-slate-900"
                    : "bg-blue-600 border-slate-900 text-white"
                  : isDarkMode
                    ? "bg-slate-900 border-slate-700 text-slate-300"
                    : "bg-white border-slate-300 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === EMAIL_MODES.WRITE && (
          <>
            <label className={labelClasses} htmlFor="email-recipient">
              {t("professional.email_recipient_label")}
            </label>
            <input
              id="email-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              maxLength={120}
              placeholder={t("professional.email_recipient_placeholder")}
              className={`${inputClasses} mb-5`}
            />
          </>
        )}

        <label className={labelClasses} htmlFor="email-text">
          {mode === EMAIL_MODES.WRITE
            ? t("professional.email_brief_label")
            : t("professional.email_draft_label")}
        </label>
        <textarea
          id="email-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={
            mode === EMAIL_MODES.WRITE
              ? t("professional.email_brief_placeholder")
              : t("professional.email_draft_placeholder")
          }
          className={inputClasses}
        />

        <div className="mt-5">
          <PrimaryButton
            onClick={handleRun}
            disabled={!text.trim() || isWorking}
            loading={isWorking}
            isDarkMode={isDarkMode}
            color="sky"
          >
            <Send size={16} />
            {t("professional.email_action")}
          </PrimaryButton>
        </div>
      </Card>

      {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {result && (
        <Card isDarkMode={isDarkMode}>
          <AiNotice isDarkMode={isDarkMode} className="mb-4" />

          {result.kind === "write" && (
            <p className={`font-black text-lg tracking-tight mb-3 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {result.subject}
            </p>
          )}

          <pre className={`whitespace-pre-wrap font-semibold text-sm leading-relaxed ${
            isDarkMode ? "text-slate-200" : "text-slate-800"
          }`}>
            {bodyText}
          </pre>

          <button
            type="button"
            onClick={handleCopy}
            className={`mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-full border-2 font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 ${
              isDarkMode
                ? "border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
                : "border-slate-300 text-slate-600 hover:border-blue-600 hover:text-blue-600"
            }`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t("translator.copied") : t("translator.copy")}
          </button>

          {result.kind === "review" && result.changes.length > 0 && (
            <div className="mt-5 flex flex-col gap-3">
              <h3 className={labelClasses}>{t("professional.email_changes")}</h3>
              {result.changes.map((change, i) => (
                <div
                  key={i}
                  className={`rounded-xl border-2 p-3 ${
                    isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <p className={`text-sm font-semibold line-through ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                    {change.original}
                  </p>
                  <p className={`text-sm font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                    {change.replacement}
                  </p>
                  <p className={`text-xs font-semibold mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    {change.why}
                  </p>
                </div>
              ))}
            </div>
          )}

          {result.kind === "review" && result.registerNote && (
            <p className={`mt-4 text-sm font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
              {result.registerNote}
            </p>
          )}

          {(result.notes ?? []).length > 0 && (
            <ul className="flex flex-col gap-1.5 mt-4">
              {result.notes.map((note, i) => (
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

export default EmailToolPage;
