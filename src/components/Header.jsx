import { Sun, Moon, Settings, LogOut, Globe, Menu, X } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import BarcelosRooster from "./BarcelosRooster";

const Header = () => {
  const {
    isDarkMode,
    setIsDarkMode,
    interfaceLang,
    changeLanguage,
    user,
    logoutUser,
  } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) {
      navigate("/");
    }
  };

  const languages = [
    { code: "en-US", label: t("nav.lang_en"), short: "EN" },
    { code: "pt-PT", label: t("nav.lang_pt"), short: "PT" },
    { code: "es-ES", label: t("nav.lang_es"), short: "ES" },
    { code: "fr-FR", label: t("nav.lang_fr"), short: "FR" },
    { code: "de-DE", label: t("nav.lang_de"), short: "DE" },
  ];

  return (
    <header
      className={`sticky top-4 z-50 mx-4 md:mx-8 rounded-2xl border-4 transition-all duration-300
      ${isDarkMode ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]" : "bg-white border-slate-900 neo-shadow-light"}`}
    >
      <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center space-x-3 group cursor-pointer"
          onClick={() => setShowMobileMenu(false)}
        >
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-slate-900 shadow-[4px_4px_0px_0px_#facc15] group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <BarcelosRooster className="w-10 h-10" />
          </div>
          <span className="text-2xl font-black tracking-tight uppercase group-hover:text-blue-600 transition-colors">
            {t("nav.brand")}
          </span>
        </Link>

        {/* ── DESKTOP NAV (md+) ───────────────────────────────────────── */}
        <div className="hidden md:flex items-center space-x-4">
          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95
              ${isDarkMode ? "bg-slate-700 border-yellow-400" : "bg-yellow-400 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"}`}
          >
            {isDarkMode ? (
              <Sun size={20} className="text-yellow-400" />
            ) : (
              <Moon size={20} className="text-slate-900" />
            )}
          </button>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 flex items-center gap-2
                ${isDarkMode ? "bg-slate-700 border-blue-400 text-blue-400" : "bg-blue-100 border-slate-900 text-blue-600 shadow-[2px_2px_0px_0px_#0f172a]"}`}
            >
              <Globe size={20} />
              <span className="text-sm font-bold uppercase hidden sm:inline">
                {interfaceLang.substring(0, 2)}
              </span>
            </button>
            {showLangMenu && (
              <div
                className={`absolute right-0 mt-2 rounded-2xl border-4 shadow-lg z-50 overflow-hidden
                  ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      changeLanguage(lang.code);
                      setShowLangMenu(false);
                    }}
                    className={`block w-full px-4 py-2 text-left font-bold uppercase text-sm transition-colors ${
                      interfaceLang === lang.code
                        ? isDarkMode
                          ? "bg-blue-600 text-white"
                          : "bg-blue-500 text-white"
                        : isDarkMode
                          ? "text-slate-300 hover:bg-slate-700"
                          : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {user ? (
            <>
              <Link
                to="/settings"
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95 hover:-translate-y-0.5
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white shadow-[3px_3px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
              >
                <Settings size={16} />
                {t('nav.settings')}
              </Link>
              <button
                onClick={handleLogout}
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95 hover:-translate-y-0.5
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white hover:border-rose-500 shadow-[3px_3px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 hover:border-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
              >
                <LogOut size={16} />
                {t('nav.logout')}
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className={`flex px-8 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95
              ${
                isDarkMode
                  ? "bg-blue-600 border-slate-900 text-white hover-neo-dark"
                  : "bg-blue-600 border-slate-900 text-white hover-neo-light"
              }`}
            >
              {t('nav.login')}
            </Link>
          )}
        </div>

        {/* ── MOBILE HAMBURGER BUTTON (< md) ─────────────────────────── */}
        <button
          className={`flex md:hidden p-3 rounded-full border-2 transition-transform active:scale-95 hover:scale-110
            ${isDarkMode ? "bg-slate-700 border-slate-600 text-white" : "bg-white border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"}`}
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label={showMobileMenu ? t("nav.close_menu") : t("nav.open_menu")}
        >
          {showMobileMenu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── MOBILE DRAWER ───────────────────────────────────────────────── */}
      {showMobileMenu && (
        <div
          className={`md:hidden mx-4 mb-4 rounded-2xl border-4 overflow-hidden
            ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
        >
          {/* Theme Toggle Row */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-full flex items-center justify-between px-5 py-4 font-black uppercase tracking-wide text-sm border-b-2 transition-colors
              ${isDarkMode ? "border-slate-700 hover:bg-slate-700" : "border-slate-100 hover:bg-slate-50"}`}
          >
            <span>{isDarkMode ? t("nav.light_mode") : t("nav.dark_mode")}</span>
            <div className={`p-2 rounded-full border-2
              ${isDarkMode ? "bg-slate-600 border-yellow-400" : "bg-yellow-400 border-slate-900"}`}
            >
              {isDarkMode ? (
                <Sun size={18} className="text-yellow-400" />
              ) : (
                <Moon size={18} className="text-slate-900" />
              )}
            </div>
          </button>

          {/* Language Section */}
          <div className={`border-b-2 ${isDarkMode ? "border-slate-700" : "border-slate-100"}`}>
            <p className={`px-5 pt-4 pb-2 text-xs font-black uppercase tracking-widest
              ${isDarkMode ? "text-slate-400" : "text-slate-400"}`}
            >
              <Globe size={12} className="inline mr-1 mb-0.5" />
              {t("nav.language")}
            </p>
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    changeLanguage(lang.code);
                    setShowMobileMenu(false);
                  }}
                  className={`py-2.5 px-3 rounded-xl border-2 font-bold uppercase text-sm transition-all active:scale-95
                    ${
                      interfaceLang === lang.code
                        ? "bg-blue-600 border-blue-600 text-white shadow-[2px_2px_0px_0px_#1e40af]"
                        : isDarkMode
                          ? "bg-slate-700 border-slate-600 text-slate-200 hover:border-blue-400"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-900"
                    }`}
                >
                  {/* Full label on sm+, short code on xs */}
                  <span className="hidden sm:inline">{lang.label}</span>
                  <span className="inline sm:hidden">{lang.short}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Auth Buttons */}
          <div className="px-4 py-4 flex flex-col gap-3">
            {user ? (
              <>
                <Link
                  to="/settings"
                  onClick={() => setShowMobileMenu(false)}
                  className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide transition-all active:scale-95
                    ${
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 text-white shadow-[3px_3px_0px_0px_#1e293b]"
                        : "bg-white border-slate-900 text-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                    }`}
                >
                  <Settings size={18} />
                  {t('nav.settings')}
                </Link>
                <button
                  onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                  className={`flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide transition-all active:scale-95
                    ${
                      isDarkMode
                        ? "bg-slate-700 border-rose-500 text-rose-400 shadow-[3px_3px_0px_0px_#1e293b]"
                        : "bg-white border-rose-500 text-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
                    }`}
                >
                  <LogOut size={18} />
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setShowMobileMenu(false)}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl border-2 font-black uppercase tracking-wide bg-blue-600 border-slate-900 text-white transition-all active:scale-95 shadow-[3px_3px_0px_0px_#0f172a]"
              >
                {t('nav.login')}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
