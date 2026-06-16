/**
 * Tier limits configuration for frontend display and enforcement.
 * These match the backend-enforced limits and are used for UI display only.
 */
export const TIER_LIMITS = {
  explorer: {
    aiCallsPerDay: 3,
    label: 'Explorer',
    isFree: true,
  },
  voyager: {
    aiCallsPerDay: 20,
    label: 'Voyager',
    isFree: false,
  },
  maestro: {
    aiCallsPerDay: Infinity,
    label: 'Maestro',
    isFree: false,
  },
};