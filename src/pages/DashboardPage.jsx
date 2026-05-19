import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "../components/FeatureCard";
import Loader from "../components/Loader";
import Avatar from "../components/Avatar";
import ChallengesMenu from "../components/ChallengesMenu";
import HangmanGame from "../components/HangmanGame";
import CrosswordsGame from "../components/CrosswordsGame";
import {
  Languages,
  BookMarked,
  PenLine,
  BotMessageSquare,
  UserRound,
  Video,
  BookOpen,
  Landmark,
  Gamepad2,
  Settings,
  LogOut,
  Zap,
  Flame,
  Star,
  ArrowLeft,
} from "lucide-react";
import PropTypes from "prop-types";

// ── StatCard ──────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, isDarkMode }) => (
  <div
    className={`p-6 rounded-2xl border-4 flex flex-col gap-3 transition-all hover:-translate-y-1
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    <div className={`w-12 h-12 rounded-xl border-2 border-current flex items-center justify-center ${color}`}>
      <Icon size={22} />
    </div>
    <div>
      <p className={`text-3xl font-black tracking-tighter ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {value}
      </p>
      <p className={`text-xs font-black uppercase tracking-widest mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {label}
      </p>
    </div>
  </div>
);

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ── TooltipButton ─────────────────────────────────────────────────────────────
// A thin wrapper that adds a tooltip above any icon button.
const TooltipButton = ({ tooltip, isDarkMode, children }) => {
  const tooltipClasses = isDarkMode
    ? "bg-slate-900 border-yellow-400 text-yellow-400"
    : "bg-white border-slate-900 text-slate-900";

  return (
    <div className="relative group">
      {children}
      <div
        role="tooltip"
        className={[
          "absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
          "px-3 py-1.5 rounded-lg border-2 text-xs font-black uppercase tracking-widest whitespace-nowrap",
          "pointer-events-none select-none",
          "opacity-0 group-hover:opacity-100 -translate-y-1 group-hover:translate-y-0",
          "transition-all duration-150",
          tooltipClasses,
        ].join(" ")}
      >
        {tooltip}
        {isDarkMode ? (
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"
            aria-hidden="true"
          />
        ) : (
          <>
            <span
              className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-900"
              aria-hidden="true"
            />
            <span
              className="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white"
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </div>
  );
};

TooltipButton.propTypes = {
  tooltip: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  children: PropTypes.node.isRequired,
};

// ── DashboardPage ─────────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { isDarkMode, user, logoutUser } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [challengeView, setChallengeView] = useState(null);

  if (!user) {
    return (
      <Loader
        fullScreen
        message={t("dashboard.loading")}
        isDarkMode={isDarkMode}
      />
    );
  }

  const handleLogout = async () => {
    const result = await logoutUser();
    if (result?.success) navigate("/");
  };

  const handleFeatureClick = (feature) => {
    setSelectedFeature(feature);
  };

  const handleBackToDashboard = () => {
    setSelectedFeature(null);
    setChallengeView(null);
  };

  const stats = [
    { icon: BookOpen, label: t("dashboard.languages"), value: "3",   color: "text-blue-500" },
    { icon: Zap,      label: t("dashboard.sessions"),  value: "24",  color: "text-yellow-500" },
    { icon: Flame,    label: t("dashboard.day_streak"), value: "7",  color: "text-rose-500" },
    { icon: Star,     label: t("dashboard.words"),      value: "312", color: "text-emerald-500" },
  ];

  const features = [
    {
      icon: Languages,
      title: t("dashboard.translator"),
      description: t("dashboard.translator_desc"),
      color: "text-sky-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: BookMarked,
      title: t("dashboard.dictionary"),
      description: t("dashboard.dictionary_desc"),
      color: "text-violet-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: PenLine,
      title: t("dashboard.grammar"),
      description: t("dashboard.grammar_desc"),
      color: "text-amber-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: BotMessageSquare,
      title: t("dashboard.ai_tutor"),
      description: t("dashboard.ai_tutor_desc"),
      color: "text-blue-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: UserRound,
      title: t("dashboard.real_person_tutor"),
      description: t("dashboard.real_person_tutor_desc"),
      color: "text-emerald-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: Video,
      title: t("dashboard.voice_practice"),
      description: t("dashboard.voice_practice_desc"),
      color: "text-purple-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: BookOpen,
      title: t("dashboard.story_generator"),
      description: t("dashboard.story_generator_desc"),
      color: "text-rose-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: Landmark,
      title: t("dashboard.history_culture"),
      description: t("dashboard.history_culture_desc"),
      color: "text-orange-500",
      statusBadgeLabel: "In progress...",
    },
    {
      icon: Gamepad2,
      title: t("dashboard.challenges"),
      description: t("dashboard.challenges_desc"),
      color: "text-yellow-500",
    },
  ];

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 space-y-10">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar
            src={user?.photoURL}
            alt={user?.displayName || "Profile"}
            size={48}
            isDarkMode={isDarkMode}
          />
          <div>
            <h1 className={`text-4xl font-black uppercase tracking-tighter ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}>
              {t("dashboard.welcome", { name: user?.displayName?.split(" ")[0] || "Learner" })}
            </h1>
            <p className={`font-bold uppercase tracking-widest text-sm mt-1 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>{t("dashboard.welcome_subtitle")}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <TooltipButton tooltip={t("nav.settings")} isDarkMode={isDarkMode}>
            <button
              onClick={() => navigate("/settings")}
              className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-white shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
              aria-label={t("nav.settings")}
            >
              <Settings size={20} />
            </button>
          </TooltipButton>

          <TooltipButton tooltip={t("nav.logout")} isDarkMode={isDarkMode}>
            <button
              onClick={handleLogout}
              className={`p-3 rounded-xl border-4 transition-all hover:-translate-y-0.5 active:scale-95 ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-rose-400 shadow-[4px_4px_0px_0px_#1e293b]"
                  : "bg-white border-slate-900 text-rose-500 shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
              aria-label={t("nav.logout")}
            >
              <LogOut size={20} />
            </button>
          </TooltipButton>
        </div>
      </div>

      {/* Selected Feature Section (non-challenges) */}
      {selectedFeature && selectedFeature.title !== t("dashboard.challenges") && (
        <section className="space-y-6">
          <button
            onClick={handleBackToDashboard}
            className={`flex items-center gap-2 font-black uppercase tracking-widest text-sm transition-all hover:-translate-x-1 ${
              isDarkMode
                ? "text-slate-400 hover:text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <ArrowLeft size={16} />
            {t("dashboard.back")}
          </button>

          <div
            className={`p-10 rounded-2xl border-4 flex flex-col items-center text-center gap-6 ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
            }`}
          >
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center border-2 border-current shadow-[4px_4px_0px_0px_currentColor] ${selectedFeature.color}`}
            >
              <selectedFeature.icon className="w-10 h-10" />
            </div>
            <div>
              <h2 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {selectedFeature.title}
              </h2>
              <p className={`font-bold ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                {selectedFeature.description}
              </p>
            </div>
            <div
              className={`w-full rounded-xl border-4 p-5 flex items-center gap-4 ${
                isDarkMode
                  ? "bg-slate-900 border-rose-500/40 text-rose-400"
                  : "bg-rose-50 border-rose-300 text-rose-600"
              }`}
            >
              <span className="text-2xl" aria-hidden="true">🚧</span>
              <p className="font-black uppercase tracking-widest text-sm text-left">
                {t("dashboard.not_implemented")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Challenges Menu */}
      {selectedFeature && selectedFeature.title === t("dashboard.challenges") && !challengeView && (
        <ChallengesMenu
          isDarkMode={isDarkMode}
          onBack={handleBackToDashboard}
          onSelect={setChallengeView}
        />
      )}

      {/* Hangman Game */}
      {challengeView === "hangman" && (
        <HangmanGame
          isDarkMode={isDarkMode}
          onBack={() => setChallengeView(null)}
        />
      )}

      {/* Crosswords Game */}
      {challengeView === "crosswords" && (
        <CrosswordsGame
          isDarkMode={isDarkMode}
          onBack={() => setChallengeView(null)}
        />
      )}

      {/* Stats + Features — hidden when a feature or challenge is active */}
      {!selectedFeature && !challengeView && (
        <>
          <section>
            <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>{t("dashboard.your_progress")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((s) => (
                <StatCard key={s.label} {...s} isDarkMode={isDarkMode} />
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