import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../contexts/AppContext";
import LanguageFlagIcon from "../LanguageFlagIcon";
import Tooltip from "../Tooltip";

/**
 * PracticeLanguage
 *
 * "You are practising pt-PT" — the language the app is currently working in,
 * shown wherever that choice changes what you get.
 *
 * **The code is the value, not the label.** `pt-PT` is shorter than
 * "Português (Portugal)", fits beside a page title without wrapping, and says
 * something the label blurs: pt-PT and pt-BR are different practice languages
 * and read almost identically as names. The full label is one hover away in
 * the tooltip, which is where the long form belongs.
 *
 * Always a link to Settings. The note raises exactly one question — how do I
 * change this — and answering it in place is what makes it worth its space
 * rather than only informing.
 *
 * Two variants, because the two jobs differ:
 *
 *   badge — beside a feature's title, where the page already has a subject and
 *           this is a qualifier on it. Must cost no vertical space.
 *   card  — the personal dashboard, where it is the first thing on the page
 *           and is stating the context everything below sits in.
 *
 * Renders nothing when no language is set. A new account mid-onboarding has
 * none, and "You are practising —" is worse than silence.
 */

/** The label for a code, from the languages already loaded in context. */
function useLanguageLabel(code) {
  const { supportedLanguages } = useAppContext();
  if (!code) return "";
  const match = (supportedLanguages ?? []).find((lang) => lang.code === code);
  return match?.label || code;
}

const PracticeLanguage = ({ variant = "badge", isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAppContext();

  const code = user?.learningDialect;
  const label = useLanguageLabel(code);

  if (!code) return null;

  const goToSettings = () => navigate("/settings");
  // The tooltip carries the long name; the accessible name has to carry it
  // too, since a hover tooltip does not exist for a screen reader.
  const describedAs = `${t("common.practising")}: ${label}`;

  if (variant === "card") {
    return (
      <Tooltip text={label} isDarkMode={isDarkMode}>
        <button
          type="button"
          onClick={goToSettings}
          aria-label={describedAs}
          className={`w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border-4 text-left transition-all active:scale-[0.99] ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 hover:border-slate-600"
              : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:-translate-y-0.5"
          }`}
        >
          <span className="min-w-0">
            <span
              className={`block text-[11px] font-black uppercase tracking-widest ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {t("common.practising")}
            </span>
          {/* Not `uppercase`, unlike every other heading here: BCP-47 casing
              is part of what makes the code precise — `mwl-PT`, not
              `MWL-PT` — and the code is shown precisely because it is exact
              where the name is not. */}
            <span
              className={`block text-lg font-black tracking-tight break-words ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              {code}
            </span>
          </span>

          <LanguageFlagIcon code={code} className="text-3xl leading-none shrink-0" />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip text={label} isDarkMode={isDarkMode} className="inline-flex">
      <button
        type="button"
        onClick={goToSettings}
        aria-label={describedAs}
        className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg border-2 text-[11px] font-black tracking-widest transition-colors ${
          isDarkMode
            ? "border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white"
            : "border-slate-300 text-slate-600 hover:border-slate-900 hover:text-slate-900"
        }`}
      >
        <LanguageFlagIcon code={code} className="text-sm leading-none" />
        {code}
      </button>
    </Tooltip>
  );
};

PracticeLanguage.propTypes = {
  variant: PropTypes.oneOf(["badge", "card"]),
  isDarkMode: PropTypes.bool.isRequired,
};

export default PracticeLanguage;
