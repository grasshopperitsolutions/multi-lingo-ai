import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useDashboardFeatures } from "../../hooks/useDashboardFeatures";
import {
  DASHBOARD_GROUPS,
  DASHBOARD_GROUP_IDS,
  DEFAULT_GROUP_ID,
  FALLBACK_GROUP_ID,
  isGroupId,
} from "../../config/dashboardGroups";
import DashboardTabs from "../../components/DashboardTabs";
import DashboardFeatureGrid from "../../components/DashboardFeatureGrid";
import TodayPanel from "./TodayPanel";

/** Where the last-viewed tab is remembered, so returning from a feature page
 *  lands back on the tab it was opened from. Session-scoped on purpose: it is
 *  navigation state, not a preference worth persisting to the profile. */
const TAB_STORAGE_KEY = "multilingo.dashboardTab";

function readStoredTab() {
  try {
    const stored = window.sessionStorage.getItem(TAB_STORAGE_KEY);
    return isGroupId(stored) ? stored : null;
  } catch {
    // Private mode / storage disabled — fall through to the default tab.
    return null;
  }
}

function storeTab(groupId) {
  try {
    window.sessionStorage.setItem(TAB_STORAGE_KEY, groupId);
  } catch {
    // Not being able to remember the tab is not worth surfacing.
  }
}

// ── DashboardHomePage ────────────────────────────────────────────────────────
// The tab shell. Owns which tab is active and renders exactly one panel; the
// tiles themselves are resolved once by useDashboardFeatures and handed down,
// so the tab bar's counters and the grid can never disagree.
const DashboardHomePage = () => {
  const { isDarkMode, user } = useAppContext();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tiles, isReady } = useDashboardFeatures();

  // URL wins, then the tab this session was last on, then Today. The URL is
  // not rewritten on mount — a bare /dashboard stays bare, so the restored tab
  // never turns into a shareable link the user did not ask for.
  const requestedTab = searchParams.get("tab");
  const activeId = isGroupId(requestedTab)
    ? requestedTab
    : readStoredTab() ?? DEFAULT_GROUP_ID;

  const handleSelect = useCallback(
    (groupId) => {
      storeTab(groupId);
      // replace: true — Back should leave the dashboard, not walk back through
      // every tab the user glanced at.
      setSearchParams({ tab: groupId }, { replace: true });
    },
    [setSearchParams],
  );

  const tabs = useMemo(() => {
    return DASHBOARD_GROUPS.map((group) => {
      const groupTiles =
        group.id === DASHBOARD_GROUP_IDS.TODAY
          ? []
          : tiles.filter(
              (tile) => (isGroupId(tile.group) ? tile.group : FALLBACK_GROUP_ID) === group.id,
            );

      return {
        id: group.id,
        icon: group.icon,
        label: t(group.labelKey),
        tiles: groupTiles,
        // Tiles the user cannot open yet — the upsell the tab bar keeps
        // advertising now that the grid is split.
        lockedCount: groupTiles.filter((tile) => tile.locked || tile.purchasable).length,
      };
      // A tab with nothing visible in it is dropped entirely rather than
      // opening onto an empty grid.
    }).filter((tab) => tab.id === DASHBOARD_GROUP_IDS.TODAY || tab.tiles.length > 0);
  }, [tiles, t]);

  // If the active tab vanished (every tile in it hidden for this tier, or a
  // stale ?tab= from an older build), fall back rather than render nothing.
  const resolvedId = tabs.some((tab) => tab.id === activeId) ? activeId : DEFAULT_GROUP_ID;
  const activeTab = tabs.find((tab) => tab.id === resolvedId);

  const isPaidTier = user?.subscriptionTier === "voyager" || user?.subscriptionTier === "maestro";
  const isCanceling = isPaidTier && Boolean(user?.cancelAtPeriodEnd);

  return (
    <>
      {/* Cancellation-scheduled notice — persists on every dashboard visit
          until the period actually ends, not just right after canceling. Sits
          above the tabs so it is seen whichever tab is open. */}
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

      <DashboardTabs
        tabs={tabs}
        activeId={resolvedId}
        onSelect={handleSelect}
        isDarkMode={isDarkMode}
        ariaLabel={t("dashboard.what_you_can_do")}
      />

      <div
        role="tabpanel"
        id={`dashboard-panel-${resolvedId}`}
        aria-labelledby={`dashboard-tab-${resolvedId}`}
        className="space-y-10"
      >
        {resolvedId === DASHBOARD_GROUP_IDS.TODAY ? (
          <TodayPanel tiles={tiles} />
        ) : (
          isReady && <DashboardFeatureGrid tiles={activeTab?.tiles ?? []} />
        )}
      </div>
    </>
  );
};

export default DashboardHomePage;
