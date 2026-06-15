/**
 * useTierAccess.js
 *
 * Custom hook that exposes the current user's subscription tier,
 * daily AI usage, and feature access checks.
 *
 * Consumes tier data already loaded into AppContext by loadUserProfile.
 * Zero extra Firestore reads — all data comes from the existing user state.
 *
 * Usage:
 *   const { tier, aiCallsRemaining, canUseAI, canAccess } = useTierAccess();
 *   if (!canAccess('fullExam')) { ... show upgrade prompt ... }
 *
 * @typedef {Object} TierAccess
 * @property {'explorer'|'voyager'|'maestro'} tier - Current subscription tier
 * @property {Object}  limits                      - TIER_LIMITS entry for current tier
 * @property {number}  aiCallsToday                - AI calls made today (from Firestore)
 * @property {number}  aiCallsRemaining            - Remaining calls (Infinity for maestro)
 * @property {boolean} canUseAI                    - Whether user can make an AI call now
 * @property {boolean} isFreeTier                  - Shorthand: tier === 'explorer'
 * @property {boolean} isPaidTier                  - Shorthand: tier !== 'explorer'
 * @property {Function} canAccess                  - (featureKey: string) => boolean
 */

import { useAppContext } from '../contexts/AppContext';
import { TIER_LIMITS, canAccessFeature } from '../config/tierLimits';

const useTierAccess = () => {
  const { user } = useAppContext();

  const tier = user?.subscriptionTier ?? 'explorer';
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.explorer;
  const aiCallsToday = user?.aiCallsToday ?? 0;
  const aiCallsRemaining =
    limits.aiCallsPerDay === Infinity
      ? Infinity
      : Math.max(0, limits.aiCallsPerDay - aiCallsToday);

  return {
    tier,
    limits,
    aiCallsToday,
    aiCallsRemaining,
    canUseAI: aiCallsRemaining > 0,
    isFreeTier: tier === 'explorer',
    isPaidTier: tier !== 'explorer',
    canAccess: (featureKey) => canAccessFeature(tier, featureKey),
  };
};

export default useTierAccess;
