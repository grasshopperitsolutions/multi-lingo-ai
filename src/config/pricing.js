/**
 * Pricing configuration for display and checkout.
 * Plan names and intervals are sent to the backend which maps them to Stripe price IDs.
 */
export const PRICING = {
  voyager: {
    monthly: { amount: 7.99, interval: 'monthly' },
    yearly: { amount: 79.99, interval: 'yearly' },
  },
  maestro: {
    monthly: { amount: 24.99, interval: 'monthly' },
    yearly: { amount: 249.99, interval: 'yearly' },
  },
};

/**
 * Features available per tier for the pricing page comparison.
 *
 * A row can be in one of three states, which the pricing page renders
 * differently:
 *   value: true / a number   — included (a number also shows the daily cap)
 *   value: false             — not on this plan
 *   comingSoon: true         — will be on this plan, not built yet
 *
 * The coming-soon rows are listed deliberately: those features are advertised
 * as "coming soon" on the dashboard, so hiding them here would make the plans
 * look thinner than they are, while marking them as included would overstate
 * what you get today.
 */

/** Shared by every paid-equivalent tier (maestro, vip, admin). */
const UNLIMITED_FEATURES = [
  { key: 'ai_calls', value: 'Unlimited', raw: Infinity },
  { key: 'grammar', value: true },
  { key: 'stories', value: true },
  { key: 'history_culture', value: true },
  { key: 'translator', value: true },
  { key: 'dictionary', value: true },
  { key: 'challenges', value: true },
  { key: 'full_exam', value: true },
  { key: 'priority_support', value: true },
  { key: 'ai_tutor', comingSoon: true },
  { key: 'voice_practice', comingSoon: true },
];

export const TIER_FEATURES = {
  explorer: [
    { key: 'ai_calls', value: 3, suffix: '/day' },
    { key: 'grammar', value: true },
    { key: 'stories', value: true },
    { key: 'history_culture', value: true },
    { key: 'translator', value: true },
    { key: 'dictionary', value: true },
    { key: 'challenges', value: true },
    { key: 'full_exam', value: false },
    { key: 'priority_support', value: false },
    { key: 'ai_tutor', comingSoon: true },
    { key: 'voice_practice', comingSoon: true },
  ],
  voyager: [
    { key: 'ai_calls', value: 20, suffix: '/day' },
    { key: 'grammar', value: true },
    { key: 'stories', value: true },
    { key: 'history_culture', value: true },
    { key: 'translator', value: true },
    { key: 'dictionary', value: true },
    { key: 'challenges', value: true },
    { key: 'full_exam', value: true },
    { key: 'priority_support', value: false },
    { key: 'ai_tutor', comingSoon: true },
    { key: 'voice_practice', comingSoon: true },
  ],
  maestro: UNLIMITED_FEATURES,
  // ── Hidden tiers: VIP and Admin (same features as Maestro, no payment) ──
  // Not shown on the pricing page — assigned manually via Firestore.
  vip: UNLIMITED_FEATURES,
  admin: UNLIMITED_FEATURES,
};

/**
 * Calculate yearly savings percentage.
 * @param {number} monthlyAmount
 * @param {number} yearlyAmount
 * @returns {number} Percentage saved
 */
export const getYearlySavingsPercent = (monthlyAmount, yearlyAmount) => {
  const monthlyPerYear = monthlyAmount * 12;
  return Math.round((1 - yearlyAmount / monthlyPerYear) * 100);
};