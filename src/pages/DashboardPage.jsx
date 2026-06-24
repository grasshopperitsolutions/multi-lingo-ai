import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "../components/FeatureCard";
import { useTierAccess } from "../hooks/useTierAccess";
import Loader from "../components/Loader";
import Avatar from "../components/Avatar";
import ChallengesMenu from "../components/ChallengesMenu";
import ExamTrainingMenu from "../components/ExamTrainingMenu";
import TranslatorPanel from "../components/TranslatorPanel";
import DictionaryPanel from "../components/DictionaryPanel";
import TooltipButton from "../components/TooltipButton";
import MobileMenuDrawer from "../components/MobileMenuDrawer";
import { auth } from "../firebase";
import { updateUserProfile } from "../services/userService";
import {
  Languages,
  BookMarked,
  PenLine,
  BotMessageSquare,
  UserRound,
  Video,
  BookOpen,
  Landmark,
  Briefcase,
  Gamepad2,
  GraduationCap,
  Settings,
  LogOut,
  Flame,
  Star,
  Trophy,
  ArrowLeft,
  Sun,
  Moon,
  Globe,
  Menu,
  X,
} from "lucide-react";
import PropTypes from "prop-types";

// ── StatCard ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, isDarkMode }) => (
  <div
    className={`p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border-4 flex flex-col gap-1.5 sm:gap-3 transition-all hover:-translate-y-1
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    <div className="flex items-center gap-2 sm:gap-3">
      <div className={`w-7 h-7 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl border-2 border-current flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={14} className="sm:hidden" />
        <Icon size={22} className="hidden sm:block" />
      </div>
      <p className={`text-lg sm:text-3xl font-black tracking-tighter ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>
        {value}
      </p>
    </div>
    <p className={`text-[9px] sm:text-xs font-black uppercase tracking-widest leading-tight ${
      isDarkMode ? "text-slate-400" : "text-slate-500"
    }`}>
      {label}
    </p>
  </div>
);

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ── DashboardPage ────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const {
    isDarkMode,
    setIsDarkMode,
    interfaceLang,
    changeLanguage,
    user,
    logoutUser,
    refreshUser,
    showAlert,
  } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tier, limits, aiCallsRemaining } = useTierAccess();
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [dictionaryPreFill, setDictionaryPreFill] = useState('');
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

  const languages = [
    { code: "en-US", label: t("nav.lang_en"), short: "EN" },
    { code: "pt-PT", label: t("nav.lang_pt"), short: "PT" },
    { code: "es-ES", label: t("nav.lang_es"), short: "ES" },
    { code: "fr-FR", label: t("nav.lang_fr"), short: "FR" },
    { code: "de-DE", label: t("nav.lang_de"), short: "DE" },
  ];

  // ── Persist theme or language to Firestore (fire-and-forget) ──────────────
  const persistPreference = async ({ theme, lang }) => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await updateUserProfile(token, firebaseUser.uid, {
        displayName: user.displayName,
        interfaceLang: lang ?? interfaceLang,
        theme: theme ?? (isDarkMode ? "dark" : "light"),
        learningDialect: user.learningDialect ?? "pt-PT",
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

  const handleLanguageChange = (code) => {
    changeLanguage(code);
    persistPreference({ lang: code });
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) navigate("/");
  };

  const handleFeatureClick = (feature) => setSelectedFeature(feature);

  const handleBackToDashboard = () => {
    setSelectedFeature(null);
    setDictionaryPreFill('');
  };

  const handleLookupInDictionary = (phrase) => {
    setDictionaryPreFill(phrase);
    setSelectedFeature(features.find((f) => f.id === 'dictionary'));
  };

  // ── Stats ──
  const stats = [
    { icon: Flame,  label: t("dashboard.day_streak"), value: String(user?.dayStreak ?? 0),  color: "text-rose-500" },
    { icon: Star,   label: t("dashboard.words"),       value: String(user?.wordsFound ?? 0), color: "text-emerald-500" },
    { icon: Trophy, label: t("dashboard.awards"),      value: "0",                            color: "text-yellow-500" },
  ];

  const features = [
    { id: "challenges",       icon: Gamepad2,       title: t("dashboard.challenges"),        description: t("dashboard.challenges_desc"),        color: "text-yellow-500" },
    { id: "exam_training",    icon: GraduationCap,  title: t("dashboard.exam_training"),     description: t("dashboard.exam_training_desc"),     color: "text-teal-500" },
    { id: "translator",       icon: Languages,      title: t("dashboard.translator"),        description: t("dashboard.translator_desc"),        color: "text-sky-500" },
    { id: "dictionary",       icon: BookMarked,     title: t("dashboard.dictionary"),        description: t("dashboard.dictionary_desc"),        color: "text-violet-500" },
    { id: "grammar",          icon: PenLine,        title: t("dashboard.grammar"),           description: t("dashboard.grammar_desc"),           color: "text-amber-500",   statusBadgeLabel: t("dashboard.coming_soon") },
    { id: "ai_tutor",         icon: BotMessageSquare, title: t("dashboard.ai_tutor"),        description: t("dashboard.ai_tutor_desc"),          color: "text-blue-500",    statusBadgeLabel: t("dashboard.coming_soon") },
    { id: "real_person_tutor",icon: UserRound,      title: t("dashboard.real_person_tutor"), description: t("dashboard.real_person_tutor_desc"), color: "text-emerald-500", statusBadgeLabel: t("dashboard.coming_soon") },
    { id: "voice_practice",   icon: Video,          title: t("dashboard.voice_practice"),    description: t("dashboard.voice_practice_desc"),    color: "text-purple-500",  statusBadgeLabel: t("dashboard.coming_soon") },
    { id: "story_generator",  icon: BookOpen,       title: t("dashboard.story_generator"),   description: t("dashboard.story_generator_desc"),   color: "text-rose-500",    statusBadgeLabel: t("dashboard.coming_soon") },
    { id: "history_culture",  icon: Landmark,       title: t("dashboard.history_culture"),   description: t("dashboard.history_culture_desc"),   color: "text-orange-500",  statusBadgeLabel: t("dashboard.coming_soon") },
    { id: "professional_tools", icon: Briefcase,    title: t("dashboard.professional_tools"), description: t("dashboard.professional_tools_desc"), color: "text-indigo-500", statusBadgeLabel: t("dashboard.coming_soon") },
  ];

  const isTranslator   = selectedFeature?.id === 'translator';
  const isChallenges   = selectedFeature?.id === 'challenges';
  const isDictionary   = selectedFeature?.id === 'dictionary';
  const isExamTraining = selectedFeature?.id === 'exam_training';
  const isOtherFeature = selectedFeature && !isTranslator && !isChallenges && !isDictionary && !isExamTraining;

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
                  ? "text-slate-400"
                  : tier === "voyager"
                    ? "text-blue-500"
                    : tier === "vip"
                      ? "text-purple-500"
                      : tier === "admin"
                        ? "text-rose-500"
                        : "text-yellow-500"
              }`}>
                {limits.label} Level
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
                <Globe size={20} />
                <span className="text-sm font-bold uppercase">
                  {interfaceLang.substring(0, 2)}
                </span>
              </button>
            </TooltipButton>
            {showLangMenu && (
              <div
                className={`absolute right-0 mt-2 rounded-2xl border-4 shadow-lg z-50 overflow-hidden
                  ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"}`}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => { handleLanguageChange(lang.code); setShowLangMenu(false); }}
                    className={`block w-full px-4 py-2 text-left font-bold uppercase text-sm transition-colors ${
                      interfaceLang === lang.code
                        ? isDarkMode ? "bg-blue-600 text-white" : "bg-blue-500 text-white"
                        : isDarkMode ? "text-slate-300 hover:bg-slate-700" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
          onLanguageChange={handleLanguageChange}
          onClose={() => setShowMobileMenu(false)}
        />
      )}

      {/* ── Translator ── */}
      {isTranslator && (
        <TranslatorPanel
          isDarkMode={isDarkMode}
          onBack={handleBackToDashboard}
          onLookupInDictionary={handleLookupInDictionary}
        />
      )}

      {/* ── Challenges Hub ── */}
      {isChallenges && (
        <ChallengesMenu isDarkMode={isDarkMode} onBack={handleBackToDashboard} />
      )}

      {/* ── Dictionary ── */}
      {isDictionary && (
        <DictionaryPanel
          isDarkMode={isDarkMode}
          onBack={handleBackToDashboard}
          initialQuery={dictionaryPreFill}
        />
      )}

      {/* ── Exam Training ── */}
      {isExamTraining && (
        <ExamTrainingMenu isDarkMode={isDarkMode} onBack={handleBackToDashboard} />
      )}

      {/* ── Other features (not yet implemented) ── */}
      {isOtherFeature && (
        <section className="space-y-6">
          <button
            onClick={handleBackToDashboard}
            className={`flex items-center gap-2 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1 ${
              isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ArrowLeft size={16} />
            {t("dashboard.back")}
          </button>
          <div className={`p-10 rounded-2xl border-4 flex flex-col items-center text-center gap-6 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
              : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
          }`}>
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 border-current shadow-[4px_4px_0px_0px_currentColor] ${selectedFeature.color}`}>
              <selectedFeature.icon className="w-10 h-10" />
            </div>
            <div>
              <h2 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {selectedFeature.title}
              </h2>
              <p className={`font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {selectedFeature.description}
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
        </section>
      )}

      {/* Stats + Features — hidden when a feature is active */}
      {!selectedFeature && (
        <>
          {/* Stats Row */}
          <section>
            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>{t("dashboard.your_progress")}</h2>
            <div className="flex gap-3 overflow-x-auto py-2 px-0.5 sm:py-1 sm:grid sm:grid-cols-3 sm:gap-4 snap-x snap-mandatory">
              {stats.map((s) => (
                <div key={s.label} className="snap-start shrink-0 w-[calc(50%-8px)] min-w-[100px] sm:w-auto sm:min-w-0">
                  <StatCard {...s} isDarkMode={isDarkMode} />
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>{t("dashboard.what_you_can_do")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((f) => (
                <FeatureCard
                  key={f.title}
                  icon={f.icon}
                  title={f.title}
                  description={f.description}
                  color={f.color}
                  isDarkMode={isDarkMode}
                  onClick={() => handleFeatureClick(f)}
                  statusBadgeLabel={f.statusBadgeLabel}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
};

export default DashboardPage;
