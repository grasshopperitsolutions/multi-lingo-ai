import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Flame, Star, Trophy, TrendingUp, Heart, X } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useFeatureFavourites } from "../../hooks/useFeatureFavourites";
import { suggestedFeatureIds, TODAY_SUGGESTION_LIMIT } from "../../config/dashboardFeatures";
import { favouritableById } from "../../config/favouritableFeatures";
import { useTierAccess } from "../../hooks/useTierAccess";
import { FEATURE_STATUS, PURCHASABLE_STATUSES } from "../../utils/featureAccess";
import Tooltip from "../../components/Tooltip";

// ── StatCard ────────────────────────────────────────────────────────────────
// One design at every width, rather than a small mobile card and a large
// desktop one. Fixed width because these live in a scrolling strip: uniform
// cards make the row read as a rail, and adding a fifth or sixth stat later
// just makes it scroll a little sooner.
const StatCard = ({ icon: Icon, label, value, color, isDarkMode }) => (
  <div
    className={`w-[198px] shrink-0 snap-start p-3 rounded-xl border-4 flex flex-col gap-1.5 transition-all hover:-translate-y-1
    ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
    }`}
  >
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-lg border-2 border-current flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={16} />
      </div>
      <p className={`text-xl font-black tracking-tighter ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>
        {value}
      </p>
    </div>
    <p className={`text-[9px] font-black uppercase tracking-widest leading-tight ${
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
 * TodayPanel
 *
 * The top of the dashboard, and the answer to "I just signed up, now what?".
 * Deliberately not a full card grid — the group sections below already show
 * every card. This is progress, then shortcut squares for the handful of
 * features this user has pinned (or, before they pin any, a few picked from
 * their onboarding interests).
 */
const TodayPanel = ({ tiles }) => {
  const { isDarkMode, user, showAlert } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { favouriteIds, isPending, toggle } = useFeatureFavourites();
  const { featureStatus, isVisible } = useTierAccess();

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

  // Stored favourite ids are resolved, never rendered directly: a feature can
  // be hidden in Admin or fall out of the user's tier long after it was
  // hearted, and a ghost card would be worse than a shorter list.
  //
  // A favourite may be a whole dashboard tile (already resolved in `tiles`) or
  // something finer-grained pinned from its own page — Hangman, Grammar Tips.
  // Those are not tiles, so they get resolved and gated here instead.
  const resolveFavourite = (id) => {
    const tile = byId.get(id);
    if (tile) return tile;

    const entry = favouritableById(id);
    if (!entry || !isVisible(id)) return null;

    const status = featureStatus(id);
    const purchasable = PURCHASABLE_STATUSES.includes(status);
    return {
      id: entry.id,
      icon: entry.icon,
      title: t(entry.titleKey),
      description: t(entry.descKey),
      color: entry.iconClass,
      route: entry.route,
      purchasable,
      locked: status !== FEATURE_STATUS.AVAILABLE && !purchasable,
      unavailable: false,
      unavailableReason: "",
    };
  };

  // Uncapped on purpose: pin as many as you like. The strip scrolls sideways
  // rather than growing the page.
  const favouriteTiles = favouriteIds.map(resolveFavourite).filter(Boolean);

  const hasFavourites = favouriteTiles.length > 0;

  // Empty state — the one that matters, because a brand-new user is exactly
  // who this panel exists for. Falls back to their onboarding interests.
  const suggestedTiles = suggestedFeatureIds(user?.interests)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .slice(0, TODAY_SUGGESTION_LIMIT);

  const shownTiles = hasFavourites ? favouriteTiles : suggestedTiles;

  // Same precedence the full grid uses, so a shortcut and its card behave
  // identically for a locked or language-blocked feature.
  const handleShortcut = (tile) => {
    if (tile.unavailable) {
      showAlert("info", tile.unavailableReason);
      return;
    }
    if (tile.purchasable) {
      navigate("/pricing");
      return;
    }
    if (tile.locked) return;
    navigate(tile.route);
  };

  return (
    <>
      {/* Progress */}
      <section>
        <SectionLabel isDarkMode={isDarkMode}>{t("dashboard.your_progress")}</SectionLabel>
        {/* A strip, not a grid — it never wraps to a second line. More stats
            later just extend the rail and it starts scrolling sooner. The
            padding keeps the cards' offset shadows and hover lift off the
            clipped edges, since overflow-x also clips vertically. */}
        <div
          className={`flex gap-3 overflow-x-auto px-2 py-3 snap-x snap-mandatory neo-scrollbar ${
            isDarkMode ? "neo-scrollbar-dark" : ""
          }`}
        >
          {stats.map((s) => (
            <StatCard key={s.label} {...s} isDarkMode={isDarkMode} />
          ))}
        </div>
      </section>

      {/* Pinned or suggested features */}
      <section>
        <SectionLabel isDarkMode={isDarkMode}>
          {hasFavourites ? (
            /* The heart is the same symbol as the toggle that put these here,
               so the heading names the list without needing to explain it. */
            <span className="inline-flex items-center gap-1.5">
              <Heart size={13} className="fill-current text-rose-500" aria-hidden="true" />
              {t("dashboard.today.your_features")}
            </span>
          ) : (
            t("dashboard.today.suggested_features")
          )}
        </SectionLabel>

        {/* A shortcut strip, not a second copy of the feature grid: the group
            sections below already show every card in full.

            One scrolling row rather than a wrapping grid, so pinning a lot of
            features never pushes the sections off the fold. The vertical
            padding is load-bearing: overflow-x:auto also clips vertically, and
            each remove button hangs 8px outside its square. */}
        <div
          className={`flex gap-3 overflow-x-auto px-2 py-3 snap-x snap-mandatory neo-scrollbar ${
            isDarkMode ? "neo-scrollbar-dark" : ""
          }`}
        >
            {shownTiles.length === 0 ? (
              <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {t("dashboard.today.favourites_hint")}
              </p>
            ) : (
              shownTiles.map((tile) => (
                // The size lives on the button, not on this box: Tooltip's own
                // wrapper is `w-full` with no height, so an `h-full` button
                // inside it collapsed to its content and came out 64x36.
                <div key={tile.id} className="relative shrink-0 snap-start">
                  <Tooltip text={tile.description} isDarkMode={isDarkMode}>
                    <button
                      type="button"
                      onClick={() => handleShortcut(tile)}
                      // The title is the accessible name now that the label is
                      // gone from the face of the square.
                      aria-label={tile.title}
                      className={`w-16 h-16 flex items-center justify-center rounded-xl border-4 transition-all active:scale-95 hover:-translate-y-0.5 ${
                        isDarkMode
                          ? "bg-slate-800 border-slate-700 shadow-[4px_4px_0px_0px_#1e293b]"
                          : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
                      } ${tile.locked || tile.unavailable ? "opacity-50" : ""}`}
                    >
                      <tile.icon size={28} className={tile.color} />
                    </button>
                  </Tooltip>

                  {/* Unpin, without a trip to the feature's own page.
                      A sibling of the square rather than a child: the square is
                      itself a <button>, so nesting one inside would be invalid
                      HTML and the click would bubble into "open this feature".

                      Only on real favourites — the same strip shows suggested
                      features before a user has pinned anything, and there is
                      nothing to remove from those. */}
                  {hasFavourites && (
                    <button
                      type="button"
                      onClick={() => toggle(tile.id)}
                      disabled={isPending(tile.id)}
                      aria-label={t("dashboard.today.remove_favourite", { name: tile.title })}
                      title={t("dashboard.today.remove_favourite", { name: tile.title })}
                      className={`absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full border-2 transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isDarkMode
                          ? "bg-slate-900 border-slate-600 text-slate-400 hover:text-rose-400 hover:border-rose-500"
                          : "bg-white border-slate-900 text-slate-500 hover:text-rose-500 hover:border-rose-500"
                      }`}
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                  )}
                </div>
              ))
            )}
        </div>
      </section>
    </>
  );
};

TodayPanel.propTypes = {
  /** Resolved, tier-filtered tiles from useDashboardFeatures. */
  tiles: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default TodayPanel;
