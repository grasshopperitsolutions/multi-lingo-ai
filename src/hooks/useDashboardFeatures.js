import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "./useTierAccess";
import { DASHBOARD_FEATURES } from "../config/dashboardFeatures";
import { FEATURE_STATUS, PURCHASABLE_STATUSES, getStatusBadge } from "../utils/featureAccess";

/**
 * useDashboardFeatures
 *
 * Resolves every dashboard tile against the current tier and learning language
 * exactly once, so the tab bar, the per-tab grid and the Today panel all agree
 * about what is visible, locked or unavailable without recomputing the cascade
 * three times.
 *
 * Tiles that are `hidden` for this tier are dropped outright — for them the
 * feature does not exist, so they must not be counted by the tab bar either.
 * Locked-but-purchasable tiles are kept: the dashboard doubles as the upsell
 * surface, and those route to /pricing rather than to the feature.
 *
 * @returns {{ tiles: object[], isReady: boolean }} `tiles` is empty until the
 *   tier config and feature registry have loaded.
 */
export function useDashboardFeatures() {
  const { user, supportedLanguages } = useAppContext();
  const { featureStatus, isVisible, isReady } = useTierAccess();
  const { t } = useTranslation();

  const tiles = useMemo(() => {
    if (!isReady) return [];

    return DASHBOARD_FEATURES.filter((feature) => isVisible(feature.id)).map((feature) => {
      // A language block ("exam training isn't offered for your dialect") is a
      // different thing from a tier block and outranks it — paying would not
      // fix it, so the tile must not advertise an upgrade.
      const unavailable = Boolean(
        feature.isUnavailable?.({ user, supportedLanguages: supportedLanguages ?? [] }),
      );
      const status = featureStatus(feature.id);
      const badge = getStatusBadge(status);

      return {
        ...feature,
        title: t(feature.titleKey),
        description: t(feature.descKey),
        status,
        unavailable,
        unavailableReason: feature.unavailableReasonKey ? t(feature.unavailableReasonKey) : "",
        statusBadgeLabel: unavailable ? undefined : badge && t(badge.key, badge.fallback),
        // Purchasable tiles stay clickable so they can route to pricing;
        // unreleased ones are inert.
        purchasable: PURCHASABLE_STATUSES.includes(status),
        locked:
          !unavailable &&
          status !== FEATURE_STATUS.AVAILABLE &&
          !PURCHASABLE_STATUSES.includes(status),
      };
    });
  }, [isReady, isVisible, featureStatus, user, supportedLanguages, t]);

  return { tiles, isReady };
}
