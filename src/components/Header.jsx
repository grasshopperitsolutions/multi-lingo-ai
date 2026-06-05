import { Sun, Moon, Settings, LogOut, Globe, Menu, X } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import BarcelosRooster from "./BarcelosRooster";
import MobileMenuDrawer from "./MobileMenuDrawer";

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
    if (result?.success) navigate("/");
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

        {/* ── DESKTOP NAV (md+) ──────────────────────────────────────── */}
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
              {/* Settings — violet circle with tooltip */}
              <div className="relative group">
                <Link
                  to="/settings"
                  aria-label={t("nav.settings")}
                  className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center
                    ${
                      isDarkMode
                        ? "bg-slate-700 border-violet-400 text-violet-400 shadow-[2px_2px_0px_0px_#1e293b]"
                        : "bg-violet-100 border-slate-900 text-violet-600 shadow-[2px_2px_0px_0px_#0f172a]"
                    }`}
                >
                  <Settings size={20} />
                </Link>
                <span
                  className={`pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap
                    text-xs font-bold uppercase px-2 py-1 rounded-lg border-2 opacity-0 group-hover:opacity-100
                    transition-opacity duration-150 z-50
                    ${
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-slate-900 text-slate-900"
                    }`}
                >
                  {t("nav.settings")}
                </span>
              </div>

              {/* Logout — rose circle with tooltip */}
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  aria-label={t("nav.logout")}
                  className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 flex items-center justify-center
                    ${
                      isDarkMode
                        ? "bg-slate-700 border-rose-400 text-rose-400 shadow-[2px_2px_0px_0px_#1e293b] hover:border-rose-300"
                        : "bg-rose-100 border-slate-900 text-rose-500 shadow-[2px_2px_0px_0px_#0f172a] hover:border-rose-500"
                    }`}
                >
                  <LogOut size={20} />
                </button>
                <span
                  className={`pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap
                    text-xs font-bold uppercase px-2 py-1 rounded-lg border-2 opacity-0 group-hover:opacity-100
                    transition-opacity duration-150 z-50
                    ${
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 text-white"
                        : "bg-white border-slate-900 text-slate-900"
                    }`}
                >
                  {t("nav.logout")}
                </span>
              </div>
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

        {/* ── MOBILE HAMBURGER BUTTON (< md) ──────────────────────────── */}
        <button
          className={`flex md:hidden p-3 rounded-full border-2 transition-transform active:scale-95 hover:scale-110
            ${isDarkMode ? "bg-slate-700 border-slate-600 text-white" : "bg-white border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"}`}
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label={showMobileMenu ? t("nav.close_menu") : t("nav.open_menu")}
        >
          {showMobileMenu ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* ── MOBILE DRAWER ──────────────────────────────────────────────── */}
      {showMobileMenu && (
        <div className="px-4 pb-4">
          <MobileMenuDrawer
            onThemeToggle={() => setIsDarkMode(!isDarkMode)}
            onLanguageChange={(code) => changeLanguage(code)}
            onClose={() => setShowMobileMenu(false)}
          />
        </div>
      )}
    </header>
  );
};

export default Header;
