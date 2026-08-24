import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Flame, Star, Trophy, TrendingUp, ArrowRight } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useFeatureFavourites } from "../../hooks/useFeatureFavourites";
import { suggestedFeatureIds, TODAY_FEATURE_LIMIT } from "../../config/dashboardFeatures";
import DashboardFeatureGrid from "../../components/DashboardFeatureGrid";

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

// ── SectionLabel ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children, isDarkMode }) => (
  <h2
    className={`text-xs font-black uppercase tracking-widest mb-4 ${
      isDarkMode ? "text-slate-400" : "text-slate-500"
    }`}
  >
    {children}
  </h2>
);

SectionLabel.propTypes = {
  children: PropTypes.node.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/**
 * The order the "recommended next thing" is picked from, best first.
 *
 * Kept deliberately dumb for a first pass: the app does not record which
 * feature a user last opened, so there is nothing better to resume from. When
 * a `lastFeatureUsed` field exists on the profile (the existing updateUserProfile
 * PUT can carry it — no new endpoint), that becomes the first choice and this
 * stays as the fallback.
 */
const RECOMMENDED_ORDER = ["challenges", "translator", "story_generator"];

/**
 * TodayPanel
 *
 * The dashboard's default tab, and the answer to "I just signed up, now what?".
 * Deliberately not a card grid: progress, one thing to do next, and only the
 * handful of features this user actually cares about.
 */
const TodayPanel = ({ tiles }) => {
  const { isDarkMode, user } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { favouriteIds } = useFeatureFavourites();

  const stats = [
    { icon: Flame,      label: t("dashboard.day_streak"),     value: String(user?.dayStreak ?? 0),        color: "text-rose-500" },
    { icon: TrendingUp, label: t("dashboard.highest_streak"), value: String(user?.highestDayStreak ?? 0), color: "text-orange-500" },
    { icon: Star,       label: t("dashboard.words"),          value: String(user?.wordsFound ?? 0),       color: "text-emerald-500" },
    // TODO: Awards is a placeholder until achievements exist — it always reads
    // zero. Kept on screen deliberately as a reminder to build them; wire it to
    // a real count (or drop the card) when they land.
    { icon: Trophy,     label: t("dashboard.awards"),         value: "0",                                 color: "text-yellow-500" },
  ];

  const byId = new Map(tiles.map((tile) => [tile.id, tile]));

  // Stored favourite ids are resolved against the *visible* tiles, never
  // rendered directly: a feature can be hidden in Admin or fall out of the
  // user's tier long after it was hearted, and a ghost card would be worse
  // than a shorter list.
  const favouriteTiles = favouriteIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, TODAY_FEATURE_LIMIT);

  const hasFavourites = favouriteTiles.length > 0;

  // Empty state — the one that matters, because a brand-new user is exactly
  // who this panel exists for. Falls back to their onboarding interests.
  const suggestedTiles = suggestedFeatureIds(user?.interests)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, TODAY_FEATURE_LIMIT);

  const shownTiles = hasFavourites ? favouriteTiles : suggestedTiles;

  const recommended = RECOMMENDED_ORDER.map((id) => byId.get(id)).find(
    (tile) => tile && !tile.locked && !tile.unavailable && !tile.purchasable,
  );

  const streak = user?.dayStreak ?? 0;

  return (
    <>
      {/* Progress */}
      <section>
        <SectionLabel isDarkMode={isDarkMode}>{t("dashboard.your_progress")}</SectionLabel>
        <div className="flex gap-3 overflow-x-auto py-2 px-0.5 sm:py-1 sm:grid sm:grid-cols-4 sm:gap-4 snap-x snap-mandatory">
          {stats.map((s) => (
            <div key={s.label} className="snap-start shrink-0 w-[calc(50%-8px)] min-w-[100px] sm:w-auto sm:min-w-0">
              <StatCard {...s} isDarkMode={isDarkMode} />
            </div>
          ))}
        </div>
      </section>

      {/* One thing to do next */}
      {recommended && (
        <section>
          <SectionLabel isDarkMode={isDarkMode}>{t("dashboard.today.recommended")}</SectionLabel>
          <button
            onClick={() => navigate(recommended.route)}
            className={`w-full flex items-center gap-4 p-5 sm:p-6 rounded-2xl border-4 text-left transition-all hover:-translate-y-1 active:scale-[0.99] ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
                : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
            }`}
          >
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 border-current flex items-center justify-center shrink-0 ${recommended.color}`}
            >
              <recommended.icon className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-black text-base sm:text-xl uppercase tracking-tight truncate ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}>
                {streak > 0
                  ? t("dashboard.today.keep_streak", { count: streak })
                  : t("dashboard.today.start_streak")}
              </p>
              <p className={`text-xs sm:text-sm font-bold mt-1 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                {recommended.title}
              </p>
            </div>
            <ArrowRight
              size={22}
              className={`shrink-0 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
            />
          </button>
        </section>
      )}

      {/* Pinned or suggested features */}
      <section>
        <SectionLabel isDarkMode={isDarkMode}>
          {hasFavourites
            ? t("dashboard.today.your_features")
            : t("dashboard.today.suggested_features")}
        </SectionLabel>
        <DashboardFeatureGrid
          tiles={shownTiles}
          emptyMessage={t("dashboard.today.favourites_hint")}
        />
        {!hasFavourites && shownTiles.length > 0 && (
          <p className={`mt-4 text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t("dashboard.today.favourites_hint")}
          </p>
        )}
      </section>
    </>
  );
};

TodayPanel.propTypes = {
  /** Resolved, tier-filtered tiles from useDashboardFeatures. */
  tiles: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default TodayPanel;
