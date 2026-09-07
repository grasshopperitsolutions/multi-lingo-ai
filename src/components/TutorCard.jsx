import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ExternalLink, Mail, MessageCircle, Phone, Sparkles } from "lucide-react";
import Avatar from "./Avatar";

/**
 * One entry in the tutor directory.
 *
 * Also renders the "coming soon" placeholder for languages with no tutor yet,
 * via `comingSoon` — the two shapes share enough card chrome that splitting
 * them into separate components would mean keeping two sets of styles in step.
 */
const TutorCard = ({ tutor, isDarkMode, comingSoon = false, language }) => {
  const { t } = useTranslation();

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
          {language}
        </p>
        <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? "text-yellow-400" : "text-blue-600"}`}>
          {t("tutors.coming_soon")}
        </p>
        <p className={`text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-500"}`}>
          {t("tutors.coming_soon_hint")}
        </p>
      </div>
    );
  }

  const phoneDigits = (tutor.phone ?? "").replace(/[^\d]/g, "");

  return (
    <div className={cardClasses}>
      <div className="flex items-center gap-4 mb-4">
        <Avatar src={tutor.photoURL} alt={tutor.displayName} size={64} isDarkMode={isDarkMode} />
        <div className="min-w-0">
          <h3 className={`font-black text-lg leading-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
            {tutor.displayName}
          </h3>
          {tutor.languages?.length > 0 && (
            <p className={`text-xs font-black uppercase tracking-widest mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {tutor.languages.join(" · ")}
            </p>
          )}
        </div>
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
            <div className="flex flex-wrap gap-2">
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
                <a
                  href={`tel:${tutor.phone}`}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold
                    ${isDarkMode ? "border-slate-600 text-slate-200" : "border-slate-300 text-slate-700"}`}
                >
                  <Phone size={14} />
                  {tutor.phone}
                </a>
              )}
              {tutor.whatsapp && phoneDigits && (
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold
                    ${isDarkMode ? "border-emerald-600 text-emerald-400" : "border-emerald-600 text-emerald-700"}`}
                >
                  <MessageCircle size={14} />
                  {t("tutors.whatsapp")}
                </a>
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
              {tutor.links.map((link) => (
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
                    <ExternalLink size={14} className="shrink-0" />
                    <span>{link.label}</span>
                    {link.platform && (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full no-underline
                        ${isDarkMode ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                        {link.platform}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

TutorCard.propTypes = {
  tutor: PropTypes.object,
  isDarkMode: PropTypes.bool.isRequired,
  comingSoon: PropTypes.bool,
  language: PropTypes.string,
};

export default TutorCard;
