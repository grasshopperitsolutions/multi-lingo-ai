import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

/**
 * PlansLink — the way to more AI calls, beside a message saying they ran out.
 *
 * `inline` sits under an inline error; `button` takes the place of a "Try
 * again" that the server would only refuse again. Alerts get the same exit
 * from AppContext's `showDailyLimitAlert`.
 */
const PlansLink = ({ variant = "inline", isDarkMode = false, className = "" }) => {
  const { t } = useTranslation();

  const look = variant === "button"
    ? `inline-block px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider text-center transition-all hover-neo-light active-neo ${
        isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
      }`
    : `text-sm font-bold underline decoration-2 underline-offset-4 transition-colors hover:decoration-yellow-400 ${
        isDarkMode ? "text-slate-200" : "text-slate-900"
      }`;

  return (
    <Link to="/pricing" className={`${look} ${className}`}>
      {t("ai_usage.see_plans")}
    </Link>
  );
};

PlansLink.propTypes = {
  variant: PropTypes.oneOf(["inline", "button"]),
  isDarkMode: PropTypes.bool,
  className: PropTypes.string,
};

export default PlansLink;
