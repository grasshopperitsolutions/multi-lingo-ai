import { useCallback, useMemo } from "react";
import { useAppContext } from "../contexts/AppContext";
import { TIER_LIMITS } from "../config/tierLimits";

/**
 * Hook that provides tier-aware access control and usage information.
 *
 * Limits and feature access come from Firestore (appConfig/config/tiersConfig,
 * loaded once into AppContext) and fall back to the defaults in
 * src/config/tierLimits.js. Edit them on the Admin page, not here.
 *
 * @returns {{
 *   tier: string,
 *   limits: { aiCallsPerDay: number, label: string, isFree: boolean, features: string[] },
 *   aiCallsRemaining: number,
 *   canUseAI: boolean,
 *   canAccess: (featureKey: string) => boolean,
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
  const { user, tiersConfig } = useAppContext();

  const tier = user?.subscriptionTier ?? "explorer";
  const limits = tiersConfig?.[tier] || TIER_LIMITS[tier] || TIER_LIMITS.explorer;
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

  /**
   * Whether the current tier may use a feature.
   *
   * An allowlist: unknown or ungranted keys are denied, which is what keeps a
   * newly added feature locked until it is deliberately granted. Admin bypasses
   * the list entirely so the admin account can always reach everything.
   *
   * @param {string} featureKey - a key from src/config/features.js
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

  return {
    tier,
    limits,
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
