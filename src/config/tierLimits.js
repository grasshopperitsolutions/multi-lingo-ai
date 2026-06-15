/**
 * tierLimits.js
 * Single source of truth for tier metadata on the frontend.
 * Backend (api/ask-ai.ts) enforces limits server-side — this is UI only.
 *
 * @typedef {'explorer' | 'voyager' | 'maestro'} SubscriptionTier
 */

export const TIER_LIMITS = {
  explorer: {
    label: 'Explorer',
    isFree: true,
    aiCallsPerDay: 3,
    lockedFeatures: ['fullExam'],
  },
  voyager: {
    label: 'Voyager',
    isFree: false,
    aiCallsPerDay: 20,
    lockedFeatures: [],
  },
  maestro: {
    label: 'Maestro',
    isFree: false,
    aiCallsPerDay: Infinity,
    lockedFeatures: [],
  },
};

export const TIER_PRICING = {
  explorer: {
    monthlyPriceId: null,
    yearlyPriceId: null,
    monthlyDisplay: '$0',
    yearlyDisplay: '$0',
    yearlyMonthlyEquiv: '$0',
    yearSavings: null,
    trialDays: null,
  },
  voyager: {
    monthlyPriceId: 'price_voyager_monthly',  // TODO: replace with real Stripe Price ID
    yearlyPriceId: 'price_voyager_yearly',    // TODO: replace with real Stripe Price ID
    monthlyDisplay: '$4.99',
    yearlyDisplay: '$49.99',
    yearlyMonthlyEquiv: '$4.17',
    yearSavings: '$9.89',
    trialDays: 7,
  },
  maestro: {
    monthlyPriceId: 'price_1ThaaaCaGweFOm0bJ515upDL',
    yearlyPriceId: 'price_1ThaauCaGweFOm0b3mmPsWkQ',
    monthlyDisplay: '$14.99',
    yearlyDisplay: '$149.99',
    yearlyMonthlyEquiv: '$12.50',
    yearSavings: '$29.89',
    trialDays: 7,
  },
};

/**
 * Returns whether a given feature is accessible for a given tier.
 * @param {SubscriptionTier} tier
 * @param {string} featureKey - e.g. 'fullExam'
 * @returns {boolean}
 */
export const canAccessFeature = (tier, featureKey) => {
  const tierData = TIER_LIMITS[tier] ?? TIER_LIMITS.explorer;
  return !tierData.lockedFeatures.includes(featureKey);
};
