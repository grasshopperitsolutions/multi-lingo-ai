import { requestUpload, uploadToGcs } from './storageService';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Fetch the user's Firestore profile.
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
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to load profile');
  return json?.data || {};
};

/**
 * Update the user's Firestore profile.
 * Only fields passed in `data` are updated (partial update).
 */
export const updateUserProfile = async (token, uid, data) => {
  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collection: 'users', id: uid, data }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to save settings');
  return json;
};

/**
 * Upload a profile image for the authenticated user.
 *
 * Flow:
 *   1. POST /api/storage  → get a signed upload URL + publicUrl  (via storageService.requestUpload)
 *   2. PUT signed URL     → upload raw file bytes to GCS          (via storageService.uploadToGcs)
 *   3. PUT /api/firestore → persist photoURL on the user document
 *
 * @param {string} token - Firebase ID token
 * @param {string} uid   - User UID
 * @param {File}   file  - The image File object from <input type="file">
 * @returns {Promise<string>} The public URL of the uploaded avatar
 */
export const uploadProfileImage = async (token, uid, file) => {
  // Step 1 — request a signed upload URL
  const { uploadUrl, publicUrl } = await requestUpload(
    token,
    file.name,
    file.type,
    'avatars',
    { uid },
  );

  // Step 2 — stream file bytes directly to GCS (no API involvement)
  await uploadToGcs(uploadUrl, file, file.type);

  // Step 3 — persist the public URL in Firestore
  await updateUserProfile(token, uid, { photoURL: publicUrl });

  return publicUrl;
};

/**
 * Permanently delete the authenticated user's account.
 * The API removes: Firestore user doc + sub-collections, Storage files, Firebase Auth account.
 *
 * DELETE /api/auth
 *
 * @param {string} token - Firebase ID token
 * @returns {Promise<{ message: string, uid: string }>}
 */
export const deleteAccount = async (token) => {
  const response = await fetch(`${PROXY_URL}/api/auth`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to delete account');
  return json;
};
