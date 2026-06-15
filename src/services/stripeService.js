/**
 * stripeService.js
 *
 * Frontend service for Stripe checkout and billing portal actions.
 * All calls go through the backend proxy at /api/stripe to keep
 * the Stripe secret key server-side only.
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Create a Stripe Checkout session and redirect the user to Stripe.
 * The backend handles customer creation and associates the Firebase UID.
 *
 * @param {string} token   - Firebase ID token (Bearer auth)
 * @param {string} priceId - Stripe Price ID for the chosen plan/interval
 * @returns {Promise<void>} Redirects on success; throws on error
 */
export const createCheckoutSession = async (token, priceId) => {
  const response = await fetch(`${PROXY_URL}/api/stripe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'checkout', priceId }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Failed to create checkout session');
  }
  if (!json?.data?.url) {
    throw new Error('No checkout URL returned from server');
  }

  window.location.href = json.data.url;
};

/**
 * Open the Stripe Billing Portal for the authenticated user.
 * Allows them to manage subscription, update payment method, view invoices.
 *
 * @param {string} token - Firebase ID token (Bearer auth)
 * @returns {Promise<void>} Redirects on success; throws on error
 */
export const openBillingPortal = async (token) => {
  const response = await fetch(`${PROXY_URL}/api/stripe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'portal' }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Failed to open billing portal');
  }
  if (!json?.data?.url) {
    throw new Error('No portal URL returned from server');
  }

  window.location.href = json.data.url;
};
