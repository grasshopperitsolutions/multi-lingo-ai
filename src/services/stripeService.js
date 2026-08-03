import { apiFetch } from './apiClient';

/**
 * Create a Stripe Checkout Session and redirect the user to it.
 *
 * @param {string} token - Firebase ID token
 * @param {string} plan - Plan key: 'voyager' or 'maestro'
 * @param {'monthly'|'yearly'} interval - Billing interval
 * @returns {Promise<void>} Redirects browser on success
 */
export const createCheckoutSession = async (token, plan, interval) => {
  const data = await apiFetch(
    '/api/stripe',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { action: 'checkout', plan, interval },
    },
    'Failed to create checkout session'
  );

  if (data?.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No checkout URL returned');
  }
};

/**
 * Open the Stripe Customer Portal for billing management.
 *
 * @param {string} token - Firebase ID token
 * @returns {Promise<void>} Redirects browser on success
 */
export const openBillingPortal = async (token) => {
  const data = await apiFetch(
    '/api/stripe',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { action: 'portal' },
    },
    'Failed to open billing portal'
  );

  if (data?.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No portal URL returned');
  }
};
