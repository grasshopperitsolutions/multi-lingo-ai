/**
 * Pricing configuration for display and checkout.
 * Plan names and intervals are sent to the backend which maps them to Stripe price IDs.
 */
export const PRICING = {
  voyager: {
    monthly: { amount: 4.99, interval: 'monthly' },
    yearly: { amount: 49.99, interval: 'yearly' },
  },
  maestro: {
    monthly: { amount: 14.99, interval: 'monthly' },
    yearly: { amount: 149.99, interval: 'yearly' },
  },
};

/**
 * Features available per tier for the pricing page comparison.
 */
export const TIER_FEATURES = {
  explorer: [
    { key: 'ai_calls', value: 3, suffix: '/day' },
    { key: 'translator', value: true },
    { key: 'dictionary', value: true },
    { key: 'challenges', value: true },
    { key: 'full_exam', value: false },
    { key: 'priority_support', value: false },
  ],
  voyager: [
    { key: 'ai_calls', value: 20, suffix: '/day' },
    { key: 'translator', value: true },
    { key: 'dictionary', value: true },
    { key: 'challenges', value: true },
    { key: 'full_exam', value: true },
    { key: 'priority_support', value: false },
  ],
  maestro: [
    { key: 'ai_calls', value: 'Unlimited', raw: Infinity },
    { key: 'translator', value: true },
    { key: 'dictionary', value: true },
    { key: 'challenges', value: true },
    { key: 'full_exam', value: true },
    { key: 'priority_support', value: true },
  ],
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