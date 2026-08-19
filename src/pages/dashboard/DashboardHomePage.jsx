import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTierAccess } from "../../hooks/useTierAccess";
import { FEATURE_STATUS, PURCHASABLE_STATUSES, getStatusBadge } from "../../utils/featureAccess";
import { useAppContext } from "../../contexts/AppContext";
import { isGrammarSupported } from "../../config/grammarSupport";
import FeatureCard from "../../components/FeatureCard";
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
  UtensilsCrossed,
  RadioTower,
  Plane,
  Gamepad2,
  GraduationCap,
  Flame,
  Star,
  Trophy,
  TrendingUp,
  Compass,
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

// ── DashboardHomePage ────────────────────────────────────────────────────────
const DashboardHomePage = () => {
  const { isDarkMode, user, showAlert, supportedLanguages } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { featureStatus, isReady } = useTierAccess();

  const stats = [
    { icon: Flame,      label: t("dashboard.day_streak"),      value: String(user?.dayStreak ?? 0),        color: "text-rose-500" },
    { icon: TrendingUp, label: t("dashboard.highest_streak"),  value: String(user?.highestDayStreak ?? 0), color: "text-orange-500" },
    { icon: Star,       label: t("dashboard.words"),           value: String(user?.wordsFound ?? 0),       color: "text-emerald-500" },
    { icon: Trophy,     label: t("dashboard.awards"),          value: "0",                                  color: "text-yellow-500" },
  ];

  const features = [
    { id: "challenges",       route: "/dashboard/challenges",          icon: Gamepad2,       title: t("dashboard.challenges"),        description: t("dashboard.challenges_desc"),        color: "text-yellow-500" },
    {
      id: "exam_training",
      route: "/dashboard/exam-training",
      icon: GraduationCap,
      title: t("dashboard.exam_training"),
      description: t("dashboard.exam_training_desc"),
      color: "text-teal-500",
      disabled: !supportedLanguages.some(lang => lang.code === user?.learningDialect && lang.examSupported),
      disabledReason: t("dashboard.exam_not_available_for_language"),
    },
    { id: "translator",        route: "/dashboard/translator",         icon: Languages,        title: t("dashboard.translator"),        description: t("dashboard.translator_desc"),        color: "text-sky-500" },
    { id: "dictionary",        route: "/dashboard/dictionary",         icon: BookMarked,       title: t("dashboard.dictionary"),        description: t("dashboard.dictionary_desc"),        color: "text-violet-500" },
    {
      id: "grammar",
      route: "/dashboard/grammar",
      icon: PenLine,
      title: t("dashboard.grammar"),
      description: t("dashboard.grammar_desc"),
      color: "text-amber-500",
      // Grammar ships with hand-written pt-PT material only — see
      // src/config/grammarSupport.js for why it isn't offered per-language yet.
      disabled: !isGrammarSupported(user?.learningDialect),
      disabledReason: t("grammar.not_available_for_language"),
    },
    { id: "ai_tutor",          route: "/dashboard/ai-tutor",           icon: BotMessageSquare, title: t("dashboard.ai_tutor"),          description: t("dashboard.ai_tutor_desc"),          color: "text-blue-500" },
    { id: "real_person_tutor", route: "/dashboard/real-person-tutor",  icon: UserRound,        title: t("dashboard.real_person_tutor"), description: t("dashboard.real_person_tutor_desc"), color: "text-emerald-500" },
    { id: "voice_practice",    route: "/dashboard/voice-practice",     icon: Video,            title: t("dashboard.voice_practice"),    description: t("dashboard.voice_practice_desc"),    color: "text-purple-500" },
    { id: "story_generator",   route: "/dashboard/story-generator",    icon: BookOpen,         title: t("dashboard.story_generator"),   description: t("dashboard.story_generator_desc"),   color: "text-rose-500" },
    { id: "history_culture",   route: "/dashboard/history-culture",    icon: Landmark,         title: t("dashboard.history_culture"),   description: t("dashboard.history_culture_desc"),   color: "text-orange-500" },
    { id: "professional_tools",route: "/dashboard/professional-tools", icon: Briefcase,        title: t("dashboard.professional_tools"), description: t("dashboard.professional_tools_desc"), color: "text-indigo-500" },
    { id: "food",              route: "/dashboard/food",               icon: UtensilsCrossed,  title: t("dashboard.food"),              description: t("dashboard.food_desc"),              color: "text-lime-500" },
    { id: "radio_tv",          route: "/dashboard/radio-tv",           icon: RadioTower,       title: t("dashboard.radio_tv"),          description: t("dashboard.radio_tv_desc"),          color: "text-cyan-500" },
    { id: "plan_trip",         route: "/dashboard/plan-trip",          icon: Plane,            title: t("dashboard.plan_trip"),         description: t("dashboard.plan_trip_desc"),         color: "text-pink-500" },
  ];

  // Tile ids double as feature keys. Tiles are never hidden — every feature
  // stays visible and carries a badge saying why it isn't usable yet, so the
  // dashboard doubles as the upsell surface. Access is configured in
  // Admin > Tiers & Features.
  const visibleFeatures = isReady
    ? features.map((feature) => {
        const status = featureStatus(feature.id);
        const badge = getStatusBadge(status);
        return {
          ...feature,
          status,
          // A language-specific block (exam/grammar not offered for the user's
          // dialect) still wins over a tier badge — it explains a different
          // thing and isn't fixed by paying.
          statusBadgeLabel: feature.disabled
            ? feature.statusBadgeLabel
            : badge && t(badge.key, badge.fallback),
          // Purchasable tiles stay clickable so they can route to pricing;
          // unreleased ones are inert.
          locked:
            !feature.disabled &&
            status !== FEATURE_STATUS.AVAILABLE &&
            !PURCHASABLE_STATUSES.includes(status),
        };
      })
    : [];

  const handleFeatureClick = (feature) => {
    if (feature.disabled) {
      showAlert("info", feature.disabledReason);
      return;
    }
    if (PURCHASABLE_STATUSES.includes(feature.status)) {
      navigate("/pricing");
      return;
    }
    if (feature.locked) return;
    navigate(feature.route);
  };

  const isPaidTier = user?.subscriptionTier === "voyager" || user?.subscriptionTier === "maestro";
  const isCanceling = isPaidTier && Boolean(user?.cancelAtPeriodEnd);

  return (
    <>
      {/* Cancellation-scheduled notice — persists on every dashboard visit
          until the period actually ends, not just right after canceling. */}
      {isCanceling && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border-4 mb-6 ${
          isDarkMode
            ? "bg-slate-800 border-amber-700"
            : "bg-amber-50 border-amber-400"
        }`}>
          <Compass size={20} className={isDarkMode ? "text-amber-400 shrink-0" : "text-amber-600 shrink-0"} />
          <p className={`text-sm font-bold ${isDarkMode ? "text-amber-200" : "text-amber-800"}`}>
            {t("subscription.cancel_scheduled_message", {
              date: user.currentPeriodEnd ? new Date(user.currentPeriodEnd * 1000).toLocaleDateString() : "",
              tier: user.subscriptionTier === "maestro" ? "Maestro" : "Voyager",
            })}
          </p>
        </div>
      )}

      {/* Stats Row */}
      <section>
        <h2 className={`text-xs font-black uppercase tracking-widest mb-4 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>{t("dashboard.your_progress")}</h2>
        <div className="flex gap-3 overflow-x-auto py-2 px-0.5 sm:py-1 sm:grid sm:grid-cols-4 sm:gap-4 snap-x snap-mandatory">
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
          {visibleFeatures.map((f) => (
            <FeatureCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              description={f.description}
              color={f.color}
              isDarkMode={isDarkMode}
              onClick={() => handleFeatureClick(f)}
              statusBadgeLabel={f.statusBadgeLabel}
              disabled={f.disabled || f.locked}
            />
          ))}
        </div>
      </section>
    </>
  );
};

export default DashboardHomePage;
