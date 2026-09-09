import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink, EyeOff, Mail, Phone, Sparkles } from "lucide-react";
import Avatar from "./Avatar";
import LanguageFlagIcon from "./LanguageFlagIcon";
import TooltipButton from "./TooltipButton";
import { PLATFORM_ICONS } from "../config/platformIconMap";

/**
 * One entry in the tutor directory.
 *
 * One other shape shares this component rather than living apart:
 * `comingSoon` (no data behind it — a single generic placeholder, not one
 * per language, see TutorsPage). It and the real card carrying an `isOwn`
 * flag for the viewer's own listing share enough chrome — same size, same
 * border weight, same grid cell — that splitting them would mean keeping two
 * sets of styles in step by hand.
 *
 * The "become a tutor" / "apply" CTA used to be a third shape here, styled
 * as a dashed placeholder card sitting in the grid. It's now a single small
 * button at the bottom of TutorsPage instead — a signed-in visitor deciding
 * whether to become a tutor isn't a listing, and giving it a whole grid cell
 * overstated it.
 */
const TutorCard = ({
  tutor,
  isDarkMode,
  comingSoon = false,
  isOwn = false,
  languageOptions = [],
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const cardClasses = `p-6 rounded-[2rem] border-4 h-full flex flex-col
    ${isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"}`;

  if (comingSoon) {
    return (
      <div
        className={`p-6 rounded-[2rem] border-4 border-dashed h-full flex flex-col items-center justify-center text-center gap-3
          ${isDarkMode ? "bg-slate-900/40 border-slate-700" : "bg-slate-50 border-slate-300"}`}
      >
        <Sparkles size={28} className={isDarkMode ? "text-slate-500" : "text-slate-400"} />
        <p className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
          {t("tutors.coming_soon")}
        </p>
        <p className={`text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
          {t("tutors.coming_soon_hint")}
        </p>
      </div>
    );
  }

  const phoneDigits = (tutor.phone ?? "").replace(/[^\d]/g, "");
  const languageLabel = (code) =>
    languageOptions.find((l) => l.code === code)?.label || code;

  return (
    <div className={`${cardClasses} ${isOwn ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-transparent" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar src={tutor.photoURL} alt={tutor.displayName} size={64} isDarkMode={isDarkMode} />
          <div className="min-w-0">
            <h3 className={`font-black text-lg leading-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {tutor.displayName}
            </h3>
            {tutor.languages?.length > 0 && (
              <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-black uppercase tracking-widest mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {tutor.languages.map((code, i) => (
                  <span key={code} className="inline-flex items-center gap-1">
                    <LanguageFlagIcon code={code} />
                    {languageLabel(code)}
                    {i < tutor.languages.length - 1 && <span aria-hidden="true">·</span>}
                  </span>
                ))}
              </p>
            )}
          </div>
        </div>

        {isOwn && tutor.published === false && (
          <TooltipButton tooltip={t("tutors.own_badge_hidden_hint")} isDarkMode={isDarkMode}>
            <span
              className={`inline-flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full border-2 text-[10px] font-black uppercase tracking-widest
                ${isDarkMode ? "border-slate-600 text-slate-400" : "border-slate-400 text-slate-500"}`}
            >
              <EyeOff size={11} />
              {t("tutors.own_badge_hidden")}
            </span>
          </TooltipButton>
        )}
      </div>

      <p className={`text-sm font-bold whitespace-pre-line mb-5 ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
        {tutor.description}
      </p>

      <div className="mt-auto space-y-3">
        {(tutor.email || tutor.phone) && (
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {t("tutors.contact")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {tutor.email && (
                <a
                  href={`mailto:${tutor.email}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold
                    ${isDarkMode ? "border-slate-600 text-slate-200" : "border-slate-300 text-slate-700"}`}
                >
                  <Mail size={14} />
                  {tutor.email}
                </a>
              )}
              {tutor.phone && (
                <span className="inline-flex items-center gap-1.5">
                  {/* The WhatsApp icon in front of the number, not a second
                      full-width button with its own "available on WhatsApp"
                      sentence — the icon and the tooltip on it say that. */}
                  {tutor.whatsapp && phoneDigits && (
                    <TooltipButton tooltip="WhatsApp" isDarkMode={isDarkMode}>
                      <a
                        href={`https://wa.me/${phoneDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-full transition-transform active:scale-90 hover:scale-110"
                      >
                        <PLATFORM_ICONS.WhatsApp width={20} height={20} />
                      </a>
                    </TooltipButton>
                  )}
                  <a
                    href={`tel:${tutor.phone}`}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold
                      ${isDarkMode ? "border-slate-600 text-slate-200" : "border-slate-300 text-slate-700"}`}
                  >
                    <Phone size={14} />
                    {tutor.phone}
                  </a>
                </span>
              )}
            </div>
          </div>
        )}

        {tutor.links?.length > 0 && (
          <div>
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
              {t("tutors.links")}
            </p>
            <ul className="space-y-2">
              {tutor.links.map((link) => {
                // A brand icon says what the link icon-badge used to say in
                // text, so the icon replaces both the generic external-link
                // glyph and the text pill for platforms one exists for.
                const Icon = PLATFORM_ICONS[link.platform];
                return (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      // These are arbitrary third-party URLs on a public page —
                      // noopener stops the target reaching back through
                      // window.opener, noreferrer keeps our URLs out of their logs.
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 text-sm font-bold underline decoration-2 underline-offset-2
                        ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}
                    >
                      {Icon
                        ? <Icon width={16} height={16} className="shrink-0" />
                        : <ExternalLink size={14} className="shrink-0" />}
                      <span>{link.label}</span>
                      {!Icon && link.platform && (
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full no-underline
                          ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                          {link.platform}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isOwn && (
          <button
            type="button"
            onClick={() => navigate("/settings#tutorSettings")}
            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95
              ${isDarkMode ? "border-yellow-400 text-yellow-400 hover:bg-yellow-400/10" : "border-blue-600 text-blue-600 hover:bg-blue-50"}`}
          >
            {t("tutors.update_profile")}
          </button>
        )}
      </div>
    </div>
  );
};

TutorCard.propTypes = {
  tutor: PropTypes.object,
  isDarkMode: PropTypes.bool.isRequired,
  comingSoon: PropTypes.bool,
  /** This is the signed-in viewer's own listing — adds the hidden/draft
   *  badge and the "update my profile" button. */
  isOwn: PropTypes.bool,
  /** supportedLanguages from AppContext, for resolving a code to a label. */
  languageOptions: PropTypes.arrayOf(
    PropTypes.shape({ code: PropTypes.string, label: PropTypes.string }),
  ),
};

export default TutorCard;
