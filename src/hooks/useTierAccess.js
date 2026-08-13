import { useAppContext } from "../contexts/AppContext";
import { TIER_LIMITS } from "../config/tierLimits";

/**
 * Hook that provides tier-aware access control and usage information.
 *
 * @returns {{
 *   tier: string,
 *   limits: { aiCallsPerDay: number, label: string, isFree: boolean },
 *   aiCallsRemaining: number,
 *   canUseAI: boolean,
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
  const { user } = useAppContext();

  const tier = user?.subscriptionTier ?? "explorer";
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.explorer;
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

  return {
    tier,
    limits,
    aiCallsRemaining,
    canUseAI: aiCallsRemaining > 0,
    isExplorer,
    isVoyager,
    isMaestro,
    isVip,
    isAdmin,
    hasUnlimitedAI,
    hasActiveSubscription,
  };
};