const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Create a Stripe Checkout Session and redirect the user to it.
 *
 * @param {string} token - Firebase ID token
 * @param {string} plan - Plan key: 'voyager' or 'maestro'
 * @param {'monthly'|'yearly'} interval - Billing interval
 * @returns {Promise<void>} Redirects browser on success
 */
export const createCheckoutSession = async (token, plan, interval) => {
  const response = await fetch(`${PROXY_URL}/api/stripe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'checkout',
      plan,
      interval,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Failed to create checkout session');
  }

  if (json?.url) {
    window.location.href = json.url;
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
  const response = await fetch(`${PROXY_URL}/api/stripe`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'portal',
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Failed to open billing portal');
  }

  if (json?.url) {
    window.location.href = json.url;
  } else {
    throw new Error('No portal URL returned');
  }
};