import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * ComingSoonContent
 *
 * The "not implemented yet" placeholder block (icon, title, description,
 * 🚧 banner) shared by every coming-soon feature page.
 */
const ComingSoonContent = ({ icon: Icon, title, description, color, isDarkMode }) => {
  const { t } = useTranslation();

  return (
    <div className={`p-10 rounded-2xl border-4 flex flex-col items-center text-center gap-6 ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}>
      <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 border-current shadow-[4px_4px_0px_0px_currentColor] ${color}`}>
        <Icon className="w-10 h-10" />
      </div>
      <div>
        <h2 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          {title}
        </h2>
        <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {description}
        </p>
      </div>
      <div className={`w-full rounded-xl border-4 p-5 flex items-center gap-4 ${
        isDarkMode
          ? "bg-slate-900 border-rose-500/40 text-rose-400"
          : "bg-rose-50 border-rose-300 text-rose-600"
      }`}>
        <span className="text-2xl" aria-hidden="true">🚧</span>
        <p className="font-black uppercase tracking-widest text-sm text-left">
          {t("dashboard.not_implemented")}
        </p>
      </div>
    </div>
  );
};

ComingSoonContent.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default ComingSoonContent;
