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
  // ── Hidden tier: VIP (like Maestro but no payment required) ──────────
  // VIP users get unlimited AI calls and all features without subscription checks.
  // This tier is NOT shown on the pricing page — assigned manually via Firestore.
  vip: {
    aiCallsPerDay: Infinity,
    label: 'VIP',
    isFree: true,        // No payment needed
  },
  // ── Hidden tier: Admin (future admin panel access) ───────────────────
  // Admin users get unlimited everything + future admin panel access.
  // This tier is NOT shown on the pricing page — assigned manually via Firestore.
  admin: {
    aiCallsPerDay: Infinity,
    label: 'Admin',
    isFree: true,        // No payment needed
  },
};