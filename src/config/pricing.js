/**
 * Pricing configuration for display and checkout.
 * Plan names and intervals are sent to the backend which maps them to Stripe price IDs.
 *
 * These amounts are only what the page shows. What is charged is the Stripe
 * price each plan maps to in the API (STRIPE_PRICE_* env vars), so changing a
 * price takes three steps: a new Price in Stripe, the API's env var pointed at
 * it, and the amount here.
 * Amounts are USD, which is the Stripe account's currency.
 */
export const PRICING = {
  voyager: {
    monthly: { amount: 17.99, interval: 'monthly' },
    yearly: { amount: 179.99, interval: 'yearly' },
  },
  maestro: {
    monthly: { amount: 24.99, interval: 'monthly' },
    yearly: { amount: 249.99, interval: 'yearly' },
  },
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