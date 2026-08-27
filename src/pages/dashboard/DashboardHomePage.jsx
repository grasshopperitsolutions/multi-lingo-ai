import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useDashboardFeatures } from "../../hooks/useDashboardFeatures";
import {
  DASHBOARD_GROUPS,
  DASHBOARD_GROUP_IDS,
  FALLBACK_GROUP_ID,
  isGroupId,
} from "../../config/dashboardGroups";
import DashboardFeatureGrid from "../../components/DashboardFeatureGrid";
import TodayPanel from "./TodayPanel";

// ── DashboardHomePage ────────────────────────────────────────────────────────
// One page, top to bottom: progress and pinned features first, then every
// group as its own section of feature cards.
//
// The grouping from config/dashboardGroups.js is what survived; the two ways of
// *presenting* it did not. The tab bar and the 3D book shelf are both still in
// the tree (components/books/*, DashboardTabs, useDashboardPresentation) but
// nothing renders them — the shelf is parked for a future revisit, not deleted.
const DashboardHomePage = () => {
  const { isDarkMode, user } = useAppContext();
  const { t } = useTranslation();
  const { tiles, isReady } = useDashboardFeatures();

  const groups = useMemo(
    () =>
      DASHBOARD_GROUPS
        // Today is the panel at the top of the page, not a group of cards.
        .filter((group) => group.id !== DASHBOARD_GROUP_IDS.TODAY)
        .map((group) => ({
          id: group.id,
          label: t(group.labelKey),
          description: t(group.descriptionKey),
          tiles: tiles.filter(
            (tile) => (isGroupId(tile.group) ? tile.group : FALLBACK_GROUP_ID) === group.id,
          ),
        }))
        // A group with nothing visible in it is dropped rather than left as an
        // empty heading.
        .filter((group) => group.tiles.length > 0),
    [tiles, t],
  );

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

      <TodayPanel tiles={tiles} />

      {isReady &&
        groups.map((group) => (
          <section key={group.id}>
            <h2
              className={`text-xs font-black uppercase tracking-widest ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {group.label}
            </h2>
            <p
              className={`mt-1 mb-4 text-sm font-bold ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {group.description}
            </p>
            <DashboardFeatureGrid tiles={group.tiles} />
          </section>
        ))}
    </>
  );
};

export default DashboardHomePage;
