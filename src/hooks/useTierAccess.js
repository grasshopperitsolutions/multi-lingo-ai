import { useCallback, useMemo } from "react";
import { useAppContext } from "../contexts/AppContext";
import { BOOTSTRAP_TIER } from "../config/tierLimits";
import {
  getFeatureStatus,
  canSeeHiddenFeatures,
  FEATURE_STATUS,
  PURCHASABLE_STATUSES,
} from "../utils/featureAccess";

/**
 * Hook that provides tier-aware access control and usage information.
 *
 * Limits and feature access come from Firestore (appConfig/config/tiersConfig,
 * loaded once into AppContext) and are edited on the Admin page, not here. The
 * config is required — AppContext routes to /app-unavailable if it can't load —
 * so the only time it is absent is the first render, reported as isReady:false.
 *
 * @returns {{
 *   tier: string,
 *   limits: { aiCallsPerDay: number, label: string, isFree: boolean, features: string[] },
 *   isReady: boolean,
 *   aiCallsRemaining: number,
 *   canUseAI: boolean,
 *   canAccess: (featureKey: string) => boolean,
 *   isVisible: (featureKey: string) => boolean,
 *   features: string[],
 *   isExplorer: boolean,
 *   isVoyager: boolean,
 *   isMaestro: boolean,
 *   isVip: boolean,
 *   isAdmin: boolean,
 *   hasUnlimitedAI: boolean,
 *   hasActiveSubscription: boolean,
 * }}
 */
export const useTierAccess = () => {
  const { user, tiersConfig, features: featureRegistry } = useAppContext();

  // Both the tier config and the feature registry are needed before any gating
  // answer means anything.
  const isReady = Boolean(tiersConfig && featureRegistry);
  const tier = user?.subscriptionTier ?? "explorer";
  // A tier id with no document (a legacy or mistyped value on a profile) falls
  // back to the configured Explorer tier rather than to anything in code.
  const limits = tiersConfig?.[tier] ?? tiersConfig?.explorer ?? BOOTSTRAP_TIER;

  const callsToday = user?.aiCallsToday ?? 0;
  const aiCallsRemaining =
    limits.aiCallsPerDay === Infinity
      ? Infinity
      : Math.max(0, limits.aiCallsPerDay - callsToday);

  const isExplorer = tier === "explorer";
  const isVoyager = tier === "voyager";
  const isMaestro = tier === "maestro";
  const isVip = tier === "vip";
  const isAdmin = tier === "admin";

  // Gates features that let a user aim an AI call at whatever they type
  // (custom story topics, specific history questions) rather than drawing from
  // the shared cache. Derived from the daily limit rather than listing tiers,
  // so a new unlimited tier is covered automatically.
  const hasUnlimitedAI = limits.aiCallsPerDay === Infinity;

  // VIP and Admin bypass payment checks entirely
  const hasActiveSubscription =
    isVip || isAdmin ||
    (tier !== "explorer" &&
      (user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing"));

  const features = useMemo(() => limits.features ?? [], [limits.features]);
  const featureSet = useMemo(() => new Set(features), [features]);

  // Feature keys withheld from this tier by the `hidden` flag on their
  // registry document. Empty for VIP and admin, who see everything.
  const hiddenFeatureSet = useMemo(() => {
    if (canSeeHiddenFeatures(tier)) return new Set();
    return new Set(
      (featureRegistry ?? []).filter((f) => f.hidden).map((f) => f.id),
    );
  }, [featureRegistry, tier]);

  /**
   * Whether a feature should be listed for this tier.
   *
   * Callers listing features (dashboard tiles, pricing rows) filter on this
   * *before* asking for a status — a hidden feature has no badge, it is simply
   * absent. Unknown keys are visible, so a tile with no registry document
   * behaves exactly as it did before the flag existed.
   *
   * Visibility only. It deliberately does not affect canAccess: a hidden
   * feature stays reachable by direct URL for anyone whose tier grants it.
   *
   * @param {string} featureKey
   * @returns {boolean}
   */
  const isVisible = useCallback(
    (featureKey) => !hiddenFeatureSet.has(featureKey),
    [hiddenFeatureSet],
  );

  /**
   * Whether the current tier may use a feature.
   *
   * An allowlist: unknown or ungranted keys are denied, which is what keeps a
   * newly added feature locked until it is deliberately granted. Admin bypasses
   * the list entirely so the admin account can always reach everything.
   *
   * Returns false until isReady — callers that render lists should wait on
   * isReady rather than treat "not yet loaded" as "denied".
   *
   * @param {string} featureKey - a key from appConfig/config/features
   * @returns {boolean}
   */
  const canAccess = useCallback(
    (featureKey) => {
      if (isAdmin) return true;
      if (!featureKey) return true;
      return featureSet.has(featureKey);
    },
    [isAdmin, featureSet],
  );

  /**
   * What the UI should say about a feature this tier doesn't have — one of
   * FEATURE_STATUS. Shared with the pricing page so the badge on a dashboard
   * tile and the mark on a plan card are always derived the same way.
   *
   * @param {string} featureKey
   * @returns {string}
   */
  const featureStatus = useCallback(
    (featureKey) => {
      if (isAdmin) return FEATURE_STATUS.AVAILABLE;
      return getFeatureStatus(featureKey, tier, tiersConfig);
    },
    [isAdmin, tier, tiersConfig],
  );

  /** Whether a locked feature can be bought, i.e. clicking should go to pricing. */
  const isPurchasable = useCallback(
    (featureKey) => PURCHASABLE_STATUSES.includes(featureStatus(featureKey)),
    [featureStatus],
  );

  return {
    tier,
    limits,
    isReady,
    featureStatus,
    isPurchasable,
    isVisible,
    featureRegistry: featureRegistry ?? [],
    aiCallsRemaining,
    canUseAI: aiCallsRemaining > 0,
    canAccess,
    features,
    isExplorer,
    isVoyager,
    isMaestro,
    isVip,
    isAdmin,
    hasUnlimitedAI,
    hasActiveSubscription,
  };
};
