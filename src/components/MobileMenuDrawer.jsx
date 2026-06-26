import { Sun, Moon, Globe, Settings, LogOut, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import Avatar from "./Avatar";
import PropTypes from "prop-types";

/**
 * MobileMenuDrawer
 *
 * Shared mobile drawer used in both Header (home page) and DashboardPage.
 * Reads theme, language, and user state directly from AppContext.
 *
 * The parent owns:
 *  - onThemeToggle   — so it can optionally persist to Firestore (dashboard) or not (home)
 *  - onLanguageChange(code) — same reason
 *  - onClose         — to close the drawer after an action
 *
 * Navigation is handled internally via useNavigate to keep parents clean.
 */
const MobileMenuDrawer = ({ onThemeToggle, onLanguageChange, onClose }) => {
  const { isDarkMode, interfaceLang, user, logoutUser } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const languages = [
    { code: "en-US", label: t("nav.lang_en"), short: "EN" },
    { code: "pt-PT", label: t("nav.lang_pt"), short: "PT" },
    { code: "es-ES", label: t("nav.lang_es"), short: "ES" },
    { code: "fr-FR", label: t("nav.lang_fr"), short: "FR" },
    { code: "de-DE", label: t("nav.lang_de"), short: "DE" },
  ];

  const handleDashboard = () => {
    navigate("/dashboard");
    onClose();
  };

  const handleSettings = () => {
    navigate("/settings");
    onClose();
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    onClose();
    if (result?.success) navigate("/");
  };

  const handleLogin = () => {
    navigate("/login");
    onClose();
  };

  const base = isDarkMode
    ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
    : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]";

  const divider = isDarkMode ? "border-slate-700" : "border-slate-100";

  return (
    <div className={`md:hidden rounded-2xl border-4 overflow-hidden ${base}`}>

      {/* ── User identity row (logged-in only) ──────────────────────── */}
      {user && (
        <div className={`flex items-center gap-3 px-5 py-4 border-b-2 ${divider}`}>
          <Avatar
            src={user.photoURL}
            alt={user.displayName || t("dashboard.profile_alt")}
            size={32}
            isDarkMode={isDarkMode}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className={`font-black uppercase tracking-tight text-sm truncate ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}>
              {user.displayName?.split(" ")[0] || t("dashboard.learner")}
            </p>
            <p className={`text-xs truncate ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {user.email}
            </p>
          </div>
        </div>
      )}

      {/* ── Theme toggle row ────────────────────────────────────────── */}
      <button
        onClick={() => { onThemeToggle(); onClose(); }}
        className={`w-full flex items-center justify-between px-5 py-4 font-black uppercase tracking-wide text-sm border-b-2 transition-colors
          ${isDarkMode ? `${divider} hover:bg-slate-700` : `${divider} hover:bg-slate-50`}`}
      >
        <span>{isDarkMode ? t("nav.light_mode") : t("nav.dark_mode")}</span>
        <div className={`p-2 rounded-full border-2 ${
          isDarkMode ? "bg-slate-600 border-yellow-400" : "bg-yellow-400 border-slate-900"
        }`}>
          {isDarkMode
            ? <Sun size={18} className="text-yellow-400" />
            : <Moon size={18} className="text-slate-900" />}
        </div>
      </button>

      {/* ── Language section ────────────────────────────────────────── */}
      <div className={`border-b-2 ${divider}`}>
        <p className={`px-5 pt-4 pb-2 text-xs font-black uppercase tracking-widest ${
          isDarkMode ? "text-slate-400" : "text-slate-400"
        }`}>
          <Globe size={12} className="inline mr-1 mb-0.5" />
          {t("nav.language")}
        </p>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { onLanguageChange(lang.code); onClose(); }}
              className={`py-2.5 px-3 rounded-xl border-2 font-bold uppercase text-sm transition-all active:scale-95
                ${
                  interfaceLang === lang.code
                    ? "bg-blue-600 border-blue-600 text-white shadow-[2px_2px_0px_0px_#1e40af]"
                    : isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-200 hover:border-blue-400"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-900"
                }`}
            >
              <span className="hidden sm:inline">{lang.label}</span>
              <span className="inline sm:hidden">{lang.short}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Auth actions ────────────────────────────────────────────── */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {user ? (
          <>
            <button
              onClick={handleDashboard}
              className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide transition-all active:scale-95
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white shadow-[3px_3px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
            >
              <LayoutDashboard size={18} />
              {t("nav.dashboard")}
            </button>
            <button
              onClick={handleSettings}
              className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide transition-all active:scale-95
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white shadow-[3px_3px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
            >
              <Settings size={18} />
              {t("nav.settings")}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide transition-all active:scale-95
                ${
                  isDarkMode
                    ? "bg-slate-700 border-rose-500 text-rose-400 shadow-[3px_3px_0px_0px_#1e293b]"
                    : "bg-white border-rose-500 text-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
            >
              <LogOut size={18} />
              {t("nav.logout")}
            </button>
          </>
        ) : (
          <button
            onClick={handleLogin}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide bg-blue-600 border-slate-900 text-white transition-all active:scale-95 shadow-[3px_3px_0px_0px_#0f172a]"
          >
            {t("nav.login")}
          </button>
        )}
      </div>
    </div>
  );
};

MobileMenuDrawer.propTypes = {
  onThemeToggle: PropTypes.func.isRequired,
  onLanguageChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MobileMenuDrawer;
