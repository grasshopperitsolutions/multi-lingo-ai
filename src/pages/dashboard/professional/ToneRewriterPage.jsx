import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { WandSparkles, Copy, Check } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { useToneChoice } from "../../../hooks/useToneChoice";
import { isAiDeclined } from "../../../services/aiService";
import { rewriteTone } from "../../../services/professionalToolsService";
import ProToolShell from "../../../components/professional/ProToolShell";
import { Card, ErrorBanner, PrimaryButton, AiNotice } from "../../../components/ui";

/**
 * ToneRewriterPage
 *
 * Paste any work message, get it back in the other register.
 *
 * The most general of the three tools, and the one the formal/informal toggle
 * was really made for — here the toggle is not a setting on the output, it is
 * the entire request.
 */
const ToneRewriterPage = () => {
  const { isDarkMode, user, showAlert } = useAppContext();
  const { canUseAI } = useTierAccess();
  const { tone, setTone } = useToneChoice();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [text, setText] = useState("");
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

  const handleRewrite = async () => {
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
      setResult(await rewriteTone({ token: user.token, text, targetLang, tone }));
    } catch (err) {
      if (isAiDeclined(err)) return;
      setError(
        err.code === "PROMPT_NOT_CONFIGURED" ? t("professional.not_configured") : err.message,
      );
    } finally {
      setIsWorking(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.rewritten);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showAlert("error", t("common.error"));
    }
  };

  return (
    <ProToolShell
      title={t("professional.tone_title")}
      isDarkMode={isDarkMode}
      tone={tone}
      onToneChange={setTone}
      toneDisabled={isWorking}
      reportContext="ToneRewriterPage"
    >
      <Card isDarkMode={isDarkMode}>
        <label className={labelClasses} htmlFor="tone-text">
          {t("professional.tone_input_label")}
        </label>
        <textarea
          id="tone-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={t("professional.tone_input_placeholder")}
          className={inputClasses}
        />

        <div className="mt-5">
          <PrimaryButton
            onClick={handleRewrite}
            disabled={!text.trim() || isWorking}
            loading={isWorking}
            isDarkMode={isDarkMode}
            color="sky"
          >
            <WandSparkles size={16} />
            {t("professional.tone_action")}
          </PrimaryButton>
        </div>
      </Card>

      {error && <ErrorBanner error={error} isDarkMode={isDarkMode} />}

      {result && (
        <Card isDarkMode={isDarkMode}>
          <AiNotice isDarkMode={isDarkMode} className="mb-4" />

          <pre className={`whitespace-pre-wrap font-semibold text-sm leading-relaxed ${
            isDarkMode ? "text-slate-200" : "text-slate-800"
          }`}>
            {result.rewritten}
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

          {result.changed.length > 0 && (
            <div className="mt-5">
              <h3 className={labelClasses}>{t("professional.tone_changes")}</h3>
              <ul className="flex flex-col gap-1.5">
                {result.changed.map((change, i) => (
                  <li key={i} className={`text-sm font-semibold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </ProToolShell>
  );
};

export default ToneRewriterPage;
