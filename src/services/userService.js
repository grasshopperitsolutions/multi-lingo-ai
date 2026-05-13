const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Fetch the user's Firestore profile.
 * @param {string} token - Firebase ID token
 * @param {string} uid - User UID
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async (token, uid) => {
  const response = await fetch(
    `${PROXY_URL}/api/firestore?collection=users&id=${uid}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Failed to load profile');
  }

  return json?.data || {};
};

/**
 * Update the user's Firestore profile.
 * Only fields passed in `data` are updated (partial update).
 * @param {string} token - Firebase ID token
 * @param {string} uid - User UID
 * @param {Object} data - Fields to update: { displayName?, interfaceLang?, theme? }
 * @returns {Promise<Object>} API response
 */
export const updateUserProfile = async (token, uid, data) => {
  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: 'users',
      id: uid,
      data,
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Failed to save settings');
  }

  return json;
};
