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
 * What a plan includes that isn't a feature in Admin › Features: an
 * entitlement enforced somewhere else, with nothing in the registry to grant
 * or gate. Shown first on the plan's card, right under the AI calls, since
 * they're promises about the plan rather than tools in it.
 *
 * Listed once, on the plan that adds it: the cards build on each other
 * ("everything in Voyager, plus"), so a perk here is not repeated on the
 * plans above.
 */
export const PLAN_PERKS = {
  voyager: [
    // True while prompts carry an `explorerModel` (Admin › Prompts): Explorer
    // runs those on the cheaper model, and every paid plan on the prompt's
    // main one. Read-aloud is the clearest case (3.8 Flash Lite TTS for
    // Explorer). If every explorerModel is ever cleared, this line stops
    // being true and should go.
    { id: 'advanced_models', labelKey: 'pricing.features.advanced_models' },
  ],
  maestro: [
    // A promise kept by hand: nothing in the app orders support by plan.
    { id: 'priority_support', labelKey: 'pricing.features.priority_support' },
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