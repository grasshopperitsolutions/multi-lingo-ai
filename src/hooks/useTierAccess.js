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

  const hasActiveSubscription =
    tier !== "explorer" &&
    (user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing");

  return {
    tier,
    limits,
    aiCallsRemaining,
    canUseAI: aiCallsRemaining > 0,
    isExplorer,
    isVoyager,
    isMaestro,
    hasActiveSubscription,
  };
};