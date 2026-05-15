import { Sun, Moon, Settings, LogOut, Globe } from "lucide-react";
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

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) {
      navigate("/");
    }
  };

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
        >
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center border-2 border-slate-900 shadow-[4px_4px_0px_0px_#facc15] group-hover:scale-110 group-hover:rotate-12 transition-transform">
            <BarcelosRooster className="w-10 h-10" />
          </div>
          <span className="text-2xl font-black tracking-tight uppercase group-hover:text-blue-600 transition-colors">
            Multi Lingo AI
          </span>
        </Link>

        <div className="flex items-center space-x-3 md:space-x-4">
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
                {[
                  { code: "en", label: "English" },
                  { code: "pt-PT", label: "Portuguese" },
                  { code: "es", label: "Spanish" },
                  { code: "fr", label: "French" },
                ].map((lang) => (
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
              {/* Desktop: text buttons */}
              <Link
                to="/settings"
                className={`hidden md:flex items-center gap-2 px-5 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95 hover:-translate-y-0.5
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
                className={`hidden md:flex items-center gap-2 px-5 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95 hover:-translate-y-0.5
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white hover:border-rose-500 shadow-[3px_3px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 hover:border-rose-500 shadow-[3px_3px_0px_0px_#0f172a]"
                }`}
              >
                <LogOut size={16} />
                {t('nav.logout')}
              </button>

              {/* Mobile: icon-only buttons */}
              <Link
                to="/settings"
                aria-label={t('nav.settings')}
                className={`flex md:hidden w-11 h-11 items-center justify-center rounded-full border-2 transition-all active:scale-95 hover:scale-110
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-white shadow-[2px_2px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
                }`}
              >
                <Settings size={18} />
              </Link>
              <button
                onClick={handleLogout}
                aria-label={t('nav.logout')}
                className={`flex md:hidden w-11 h-11 items-center justify-center rounded-full border-2 transition-all active:scale-95 hover:scale-110
                ${
                  isDarkMode
                    ? "bg-slate-700 border-slate-600 text-rose-400 hover:border-rose-500 shadow-[2px_2px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-rose-500 hover:border-rose-500 shadow-[2px_2px_0px_0px_#0f172a]"
                }`}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              {/* Desktop: full text login button */}
              <Link
                to="/login"
                className={`hidden md:flex px-8 py-3 rounded-full font-black uppercase tracking-wider border-2 transition-all active:scale-95
                ${
                  isDarkMode
                    ? "bg-blue-600 border-slate-900 text-white hover-neo-dark"
                    : "bg-blue-600 border-slate-900 text-white hover-neo-light"
                }`}
              >
                {t('nav.login')}
              </Link>

              {/* Mobile: icon-only login button */}
              <Link
                to="/login"
                aria-label={t('nav.login')}
                className={`flex md:hidden w-11 h-11 items-center justify-center rounded-full border-2 bg-blue-600 border-slate-900 transition-all active:scale-95 hover:scale-110 shadow-[2px_2px_0px_0px_#0f172a]`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="white"
                  className="w-5 h-5"
                  aria-hidden="true"
                >
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
