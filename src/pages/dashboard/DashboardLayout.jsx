import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../contexts/AppContext";
import { useTierAccess } from "../../hooks/useTierAccess";
import Loader from "../../components/Loader";
import Avatar from "../../components/Avatar";
import TooltipButton from "../../components/TooltipButton";
import MobileMenuDrawer from "../../components/MobileMenuDrawer";
import LanguageFlagIcon from "../../components/LanguageFlagIcon";
import { auth } from "../../firebase";
import { updateUserProfile } from "../../services/userService";
import {
  Settings,
  LogOut,
  ShieldCheck,
  Star,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";

// ── DashboardLayout ──────────────────────────────────────────────────────────
// Shared chrome (avatar/greeting, theme/language toggles, admin/settings/
// logout, mobile drawer) for every /dashboard/* page. Renders the active
// page via <Outlet/>.
const DashboardLayout = () => {
  const {
    isDarkMode,
    setIsDarkMode,
    interfaceLang,
    changeLanguage,
    interfaceLanguageOptions,
    isLoadingLanguages,
    user,
    logoutUser,
    refreshUser,
    showAlert,
  } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tier, limits, aiCallsRemaining, isAdmin } = useTierAccess();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  if (!user) {
    return (
      <Loader
        fullScreen
        message={t("dashboard.loading")}
        isDarkMode={isDarkMode}
      />
    );
  }

  // ── Persist theme to Firestore (fire-and-forget) ───────────────────────────
  // Language changes are persisted by changeLanguage() itself.
  const persistPreference = async ({ theme }) => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await updateUserProfile(token, firebaseUser.uid, {
        displayName: user.displayName,
        theme: theme ?? (isDarkMode ? "dark" : "light"),
        learningDialect: user.learningDialect ?? null,
        interests: user.interests ?? [],
      });
      await refreshUser();
    } catch {
      showAlert("error", t("settings.errors.save_failed"));
    }
  };

  const handleThemeToggle = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    persistPreference({ theme: next ? "dark" : "light" });
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) navigate("/");
  };

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 space-y-10">

      {/* ── DASHBOARD HEADER ROW ──────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">

        {/* Left: avatar + greeting (always visible, smaller on mobile) */}
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={user?.photoURL}
            alt={user?.displayName || t("dashboard.profile_alt")}
            size={48}
            isDarkMode={isDarkMode}
            className="shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className={`text-base sm:text-3xl font-black uppercase tracking-tighter truncate ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {t("dashboard.welcome", { name: user?.displayName?.split(" ")[0] || t("dashboard.learner") })}
              </h1>
              {/* Tier Badge */}
              {tier !== "explorer" && (
                <span
                  className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full border-2 text-xs font-black uppercase tracking-wider ${
                    tier === "voyager"
                      ? "bg-blue-100 border-blue-500 text-blue-700"
                      : tier === "vip"
                        ? "bg-purple-100 border-purple-500 text-purple-700"
                        : tier === "admin"
                          ? "bg-rose-100 border-rose-500 text-rose-700"
                          : "bg-yellow-100 border-yellow-500 text-yellow-700"
                  }`}
                >
                  {(tier === "maestro" || tier === "vip" || tier === "admin") && <Star size={12} className="fill-current" />}
                  {tier === "voyager" ? "Voyager" : tier === "vip" ? "VIP" : tier === "admin" ? "Admin" : "Maestro"}
                </span>
              )}
            </div>
            <p className={`hidden sm:block font-bold uppercase tracking-widest text-sm mt-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {t("dashboard.welcome_subtitle")}
            </p>
          </div>
        </div>

        {/* Right: tier + AI usage + action buttons */}
        <div className="flex items-center gap-3 shrink-0">

          {/* ── Tier & AI Usage — desktop only ── */}
          <div className="hidden md:flex items-center gap-3 pr-3 border-r-4 border-current">
            <div className="text-right">
              <p className={`text-xs font-black uppercase tracking-widest leading-tight ${
                tier === "explorer"
                  ? "text-emerald-400"
                  : tier === "voyager"
                    ? "text-blue-500"
                    : tier === "vip"
                      ? "text-purple-500"
                      : tier === "admin"
                        ? "text-rose-500"
                        : "text-yellow-500"
              }`}>
                {limits.label}
              </p>
              <p className={`text-sm font-black tracking-tight ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {limits.aiCallsPerDay === Infinity ? (
                  <span className="text-emerald-500">{t("ai_usage.unlimited")}</span>
                ) : aiCallsRemaining === 0 ? (
                  <span className="text-rose-500">{t("ai_usage.depleted")}</span>
                ) : (
                  <span className={aiCallsRemaining <= 3 ? "text-rose-500" : ""}>
                    {t("ai_usage.remaining", { count: aiCallsRemaining, total: limits.aiCallsPerDay })}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* ── Theme Toggle — desktop only ── */}
          <div className="hidden md:block">
            <TooltipButton
              tooltip={isDarkMode ? t("nav.light_mode") : t("nav.dark_mode")}
              isDarkMode={isDarkMode}
            >
              <button
                onClick={handleThemeToggle}
                aria-label={isDarkMode ? t("nav.light_mode") : t("nav.dark_mode")}
                className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95
                  ${isDarkMode
                    ? "bg-slate-700 border-yellow-400"
                    : "bg-yellow-400 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"}`}
              >
                {isDarkMode
                  ? <Sun size={20} className="text-yellow-400" />
                  : <Moon size={20} className="text-slate-900" />}
              </button>
            </TooltipButton>
          </div>

          {/* ── Language Selector — desktop only ── */}
          <div className="hidden md:block relative">
            <TooltipButton tooltip={t("nav.language")} isDarkMode={isDarkMode}>
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                aria-label={t("nav.language")}
                className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 flex items-center gap-2
                  ${isDarkMode
                    ? "bg-slate-700 border-blue-400 text-blue-400"
                    : "bg-blue-100 border-slate-900 text-blue-600 shadow-[2px_2px_0px_0px_#0f172a]"}`}
              >
                <LanguageFlagIcon code={interfaceLang} className="text-lg leading-none" />
                <span className="text-sm font-bold uppercase">
                  {interfaceLang.split("-")[1] || interfaceLang.split("-")[0].toUpperCase()}
                </span>
              </button>
            </TooltipButton>
            {showLangMenu && (
              <div
                className={`absolute right-0 mt-2 rounded-2xl border-4 shadow-lg z-50 overflow-hidden
                  ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
              >
                {interfaceLanguageOptions.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { changeLanguage(lang.code); setShowLangMenu(false); }}
                    className={`block w-full px-4 py-2 text-left font-bold uppercase text-sm transition-colors ${
                      interfaceLang === lang.code
                        ? isDarkMode ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                        : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <LanguageFlagIcon code={lang.code} className="text-lg leading-none mr-2 align-middle" />
                    {lang.label}
                  </button>
                ))}
                {isLoadingLanguages && (
                  <div className={`px-4 py-2 text-xs font-bold uppercase tracking-widest ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}>
                    {t("common.loading")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Admin — desktop only, admin tier only ── */}
          {isAdmin && (
            <div className="hidden md:block">
              <TooltipButton tooltip="Admin" isDarkMode={isDarkMode}>
                <button
                  onClick={() => navigate("/admin")}
                  aria-label="Admin"
                  className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                      : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
                  }`}
                >
                  <ShieldCheck size={20} />
                </button>
              </TooltipButton>
            </div>
          )}

          {/* ── Settings — desktop only ── */}
          <div className="hidden md:block">
            <TooltipButton tooltip={t("nav.settings")} isDarkMode={isDarkMode}>
              <button
                onClick={() => navigate("/settings")}
                aria-label={t("nav.settings")}
                className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
                }`}
              >
                <Settings size={20} />
              </button>
            </TooltipButton>
          </div>

          {/* ── Logout — desktop only ── */}
          <div className="hidden md:block">
            <TooltipButton tooltip={t("nav.logout")} isDarkMode={isDarkMode}>
              <button
                onClick={handleLogout}
                aria-label={t("nav.logout")}
                className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-rose-400 shadow-[4px_4px_0px_0px_#1e293b]"
                    : "bg-white border-slate-900 text-rose-500 shadow-[4px_4px_0px_0px_#0f172a]"
                }`}
              >
                <LogOut size={20} />
              </button>
            </TooltipButton>
          </div>

          {/* ── Mobile Hamburger — mobile only ── */}
          <button
            className={`flex md:hidden p-3 rounded-xl border-4 transition-transform active:scale-95 hover:scale-110
              ${isDarkMode
                ? "bg-slate-800 border-slate-700 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"}`}
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label={showMobileMenu ? t("nav.close_menu") : t("nav.open_menu")}
          >
            {showMobileMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── MOBILE DRAWER ─────────────────────────────────────────────── */}
      {showMobileMenu && (
        <MobileMenuDrawer
          onThemeToggle={handleThemeToggle}
          onClose={() => setShowMobileMenu(false)}
        />
      )}

      {/* ── Active page ──────────────────────────────────────────────── */}
      <Outlet />
    </main>
  );
};

export default DashboardLayout;
