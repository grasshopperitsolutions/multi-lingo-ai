import { useState } from "react";
import PropTypes from "prop-types";
import { SettingsSection } from "./ui";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Send, UserRound } from "lucide-react";
import { submitTutorApplication } from "../services/tutorService";
import { parseTutorUrl } from "../config/tutorPlatforms";
import { URL_ERROR_KEYS } from "../services/tutorUrlValidation";

/**
 * Shown in Settings to anyone whose tier cannot publish a tutor profile.
 *
 * Approval is deliberately not a field on the application document: an admin
 * approves by granting the applicant the `vip` tier in the Users panel, which
 * is what the server-side tier gate on the `tutors` collection actually
 * checks. A separate `approved` boolean would be a second source of truth
 * that could disagree with the tier.
 */
const TutorApplicationForm = ({ isDarkMode, defaultOpen = false, id = undefined }) => {
  const { t } = useTranslation();

  const [instagram, setInstagram] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const postUrlParsed = postUrl.trim() ? parseTutorUrl(postUrl) : null;
  const postUrlError = postUrlParsed && !postUrlParsed.ok ? URL_ERROR_KEYS[postUrlParsed.reason] : null;

  const canSend = instagram.trim() && postUrl.trim() && !postUrlError && !isSending;

  const handleSubmit = async () => {
    setIsSending(true);
    setError(null);
    try {
      await submitTutorApplication({ instagram, postUrl, message });
      setSent(true);
      setInstagram("");
      setPostUrl("");
      setMessage("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const inputClasses = `w-full px-4 py-3 rounded-xl border-4 font-bold outline-none transition-all
    ${isDarkMode
      ? "bg-slate-900 border-slate-700 text-white focus:border-yellow-400 placeholder-slate-500"
      : "bg-white border-slate-300 text-slate-900 focus:border-blue-600 placeholder-slate-400"}`;

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  const hintClasses = `mt-1 text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`;

  return (
    <SettingsSection
      id={id}
      title={t("tutors.apply_title")}
      icon={<UserRound size={16} className="inline mr-2" />}
      isDarkMode={isDarkMode}
      defaultOpen={defaultOpen}
    >
      <p className={`text-sm font-bold mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("tutors.apply_intro")}
      </p>

      {sent ? (
        <p className={`flex items-center gap-2 text-sm font-bold ${isDarkMode ? "text-emerald-400" : "text-emerald-700"}`}>
          <Check size={18} />
          {t("tutors.apply_sent")}
        </p>
      ) : (
        <div className="space-y-5">
          <div>
            <span className={labelClasses}>{t("tutors.apply_instagram")}</span>
            <input
              type="text"
              value={instagram}
              placeholder="@"
              onChange={(e) => setInstagram(e.target.value)}
              className={inputClasses}
            />
            <p className={hintClasses}>{t("tutors.apply_instagram_hint")}</p>
          </div>

          <div>
            <span className={labelClasses}>{t("tutors.apply_post")}</span>
            <input
              type="url"
              value={postUrl}
              placeholder="https://"
              onChange={(e) => setPostUrl(e.target.value)}
              className={inputClasses}
            />
            <p className={hintClasses}>{t("tutors.apply_post_hint")}</p>
            {postUrlError && <p className="mt-1 text-xs font-bold text-rose-500">{t(postUrlError)}</p>}
          </div>

          <div>
            <span className={labelClasses}>{t("tutors.apply_message")}</span>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputClasses}
            />
            <p className={hintClasses}>{t("tutors.apply_message_hint")}</p>
          </div>

          {error && <p className="text-sm font-bold text-rose-500">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className={`inline-flex items-center gap-3 px-6 py-4 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95
              ${!canSend
                ? "opacity-40 cursor-not-allowed border-slate-400 text-slate-400"
                : isDarkMode
                  ? "bg-yellow-400 border-yellow-400 text-slate-900 shadow-[4px_4px_0px_0px_#854d0e]"
                  : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
          >
            {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {t("tutors.apply_submit")}
          </button>
        </div>
      )}
    </SettingsSection>
  );
};

TutorApplicationForm.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  /** Whether the card starts expanded. Defaults closed, like the editor it
   *  stands in for. */
  defaultOpen: PropTypes.bool,
  /** Forwarded to the wrapping SettingsSection, so #tutorSettings finds this
   *  card too when the visitor isn't eligible to publish yet. */
  id: PropTypes.string,
};

export default TutorApplicationForm;
