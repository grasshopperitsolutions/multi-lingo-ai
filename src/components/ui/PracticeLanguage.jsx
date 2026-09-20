import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../contexts/AppContext";
import { flagRegion } from "../../utils/flagRegion";
import LanguageFlagIcon from "../LanguageFlagIcon";
import Tooltip from "../Tooltip";

/**
 * PracticeLanguage
 *
 * "Estás a praticar pt-PT" — the language the app is currently working in,
 * shown wherever that choice changes what you get.
 *
 * **The code is the value, not the label.** `pt-PT` is shorter than
 * "Português (Portugal)", fits beside a page title without wrapping, and says
 * something the label blurs: pt-PT and pt-BR are different practice languages
 * and read almost identically as names.
 *
 * Two variants, because the two jobs differ:
 *
 *   badge — beside a feature's title, where the page already has a subject and
 *           this is a qualifier on it. Must cost no vertical space, so the
 *           long name lives in a tooltip. The whole badge is the link.
 *   card  — the personal dashboard, where it is the first thing on the page
 *           and is stating the context everything below sits in. It has room
 *           for the full name, so there is no tooltip here.
 *
 * Renders nothing when no language is set. A new account mid-onboarding has
 * none, and "Estás a praticar —" is worse than silence.
 */

/** Where both variants send you, and the section that opens when you land. */
const SETTINGS_HREF = "/settings#practiceLanguage";

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

  const goToSettings = () => navigate(SETTINGS_HREF);
  // The tooltip carries the long name on the badge; the accessible name has to
  // carry it too, since a hover tooltip does not exist for a screen reader.
  const describedAs = `${t("common.practising")}: ${label}`;

  if (variant === "card") {
    const region = flagRegion(code);

    return (
      // A region, not a button. The whole card used to be one, which made the
      // flag field a 90px-tall click target for a navigation nobody asked for
      // — and put a heading, a code and a name inside a control, where a
      // screen reader reads them as one run-on label. Only "Trocar" is
      // actionable now, which is also the honest shape: the card informs, the
      // button acts.
      <section
        aria-label={describedAs}
        className={`relative overflow-hidden rounded-2xl border-4 ${
          isDarkMode
            ? "border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
            : "border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
        }`}
      >
        {/* The flag stops being an icon and becomes the field. `fi` sets
            `background-size: contain`; the Tailwind utilities override it
            because flag-icons is imported before index.css in main.jsx, so
            these win on equal specificity without !important. */}
        {region ? (
          <span
            className={`fi fi-${region} absolute inset-0 w-full h-full bg-cover`}
            aria-hidden="true"
          />
        ) : (
          // Mirandese has a flag because mwl-PT carries a region; Interlingua
          // does not. A code with no region gets a field rather than a hole.
          <span
            className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-800"
            aria-hidden="true"
          />
        )}

        {/* Dark enough on the left for white text at AA against any flag,
            clearing towards the right so the colours still read as a flag.
            Fixed rather than theme-dependent on purpose: the card is white on
            dark in both themes, which is what makes one contrast decision
            cover both. */}
        <span
          className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/30"
          aria-hidden="true"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
          <div className="min-w-0">
            <span className="block text-[11px] font-black uppercase tracking-widest text-white/75">
              {t("common.practising")}
            </span>
            {/* Not `uppercase`, unlike every other heading here: BCP-47 casing
                is part of what makes the code precise — `mwl-PT`, not
                `MWL-PT` — and the code is shown precisely because it is exact
                where the name is not. */}
            <span className="block text-3xl font-black tracking-tight text-white break-words">
              {code}
            </span>
            {/* Skipped when the label fell back to the code, which is what
                happens for a language seeded after this browser loaded the
                list. Printing it twice reads as a rendering fault. */}
            {label !== code && (
              <span className="block mt-0.5 text-sm font-bold text-white/80 break-words">
                {label}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={goToSettings}
            className="shrink-0 inline-flex items-center px-4 py-2 rounded-full bg-white text-slate-900 text-[11px] font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_rgba(2,6,23,0.55)] transition-transform hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(2,6,23,0.55)]"
          >
            {t("common.change")}
          </button>
        </div>
      </section>
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
