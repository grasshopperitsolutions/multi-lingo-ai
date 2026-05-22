import { requestUpload, uploadToGcs } from './storageService';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} UserGameProgress
 * @property {string}   gameId            - e.g. 'hangman'
 * @property {string}   learningDialect   - BCP-47, e.g. 'pt-PT'
 * @property {string[]} seenConceptIds    - conceptId refs from wordPool
 * @property {number}   totalPlayed
 * @property {string}   lastPlayedAt      - ISO timestamp
 */

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

/**
 * Fetch the user's Firestore profile.
 *
 * @param {string} token - Firebase ID token
 * @param {string} uid
 * @returns {Promise<Record<string, unknown>>} Flat document fields
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
  return json?.data?.data ?? {};
};

/**
 * Update the user's Firestore profile (partial update).
 *
 * @param {string} token
 * @param {string} uid
 * @param {Record<string, unknown>} data
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
 *   1. POST /api/storage  → get a signed upload URL + publicUrl
 *   2. PUT signed URL     → upload raw file bytes to GCS
 *   3. PUT /api/firestore → persist photoURL on the user document
 *
 * @param {string} token
 * @param {string} uid
 * @param {File}   file
 * @returns {Promise<string>} Public URL of the uploaded avatar
 */
export const uploadProfileImage = async (token, uid, file) => {
  const { uploadUrl, publicUrl } = await requestUpload(
    token,
    file.name,
    file.type,
    'avatars',
    { uid },
  );
  await uploadToGcs(uploadUrl, file, file.type);
  await updateUserProfile(token, uid, { photoURL: publicUrl });
  return publicUrl;
};

/**
 * Permanently delete the authenticated user's account.
 *
 * @param {string} token
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

// ---------------------------------------------------------------------------
// Game progress
// ---------------------------------------------------------------------------

/**
 * Collection path:  userGameProgress/{uid}/games
 * Document ID:      {gameId}__{learningDialect}   e.g. hangman__pt-PT
 *
 * seenConceptIds tracks conceptId references from the shared wordPool
 * collection. Progress is scoped per game + dialect so that Hangman and
 * Crosswords (for example) each track their own seen words independently,
 * even though they draw from the same wordPool.
 */

const PROGRESS_COLLECTION = (uid) => `userGameProgress/${uid}/games`;
const PROGRESS_DOC_ID     = (gameId, learningDialect) => `${gameId}__${learningDialect}`;

/**
 * Fetch the game progress document for a given user + game + dialect.
 * Returns null (never throws) when the document doesn't exist yet —
 * first-time players simply have no progress record.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string} gameId
 * @param {string} learningDialect
 * @returns {Promise<UserGameProgress | null>}
 */
export const getUserGameProgress = async (token, uid, gameId, learningDialect) => {
  const collection = PROGRESS_COLLECTION(uid);
  const id         = PROGRESS_DOC_ID(gameId, learningDialect);

  const response = await fetch(
    `${PROXY_URL}/api/firestore?collection=${encodeURIComponent(collection)}&id=${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  // 404 = first play, no progress yet — return null instead of throwing
  if (response.status === 404) return null;

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to load game progress');

  return json?.data?.data ?? null;
};

/**
 * Mark a concept as seen and increment the play counter.
 * Creates the progress document on first play; patches it on subsequent plays.
 *
 * @param {string}               token
 * @param {string}               uid
 * @param {string}               gameId
 * @param {string}               learningDialect
 * @param {string}               conceptId       - wordPool document ID
 * @param {UserGameProgress|null} currentProgress - pass result of getUserGameProgress()
 * @returns {Promise<void>}
 */
export const markConceptSeen = async (
  token,
  uid,
  gameId,
  learningDialect,
  conceptId,
  currentProgress
) => {
  const collection = PROGRESS_COLLECTION(uid);
  const id         = PROGRESS_DOC_ID(gameId, learningDialect);
  const now        = new Date().toISOString();

  if (!currentProgress) {
    // First play — create the document
    await fetch(`${PROXY_URL}/api/firestore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection,
        id,
        data: {
          gameId,
          learningDialect,
          seenConceptIds: [conceptId],
          totalPlayed: 1,
          lastPlayedAt: now,
        },
      }),
    }).then(async (r) => {
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j?.error || j?.message || 'Failed to create game progress');
      }
    });
  } else {
    // Subsequent play — merge conceptId into the seen list
    const updatedSeenIds = [...new Set([...(currentProgress.seenConceptIds ?? []), conceptId])];
    await fetch(`${PROXY_URL}/api/firestore`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        collection,
        id,
        data: {
          seenConceptIds: updatedSeenIds,
          totalPlayed: (currentProgress.totalPlayed ?? 0) + 1,
          lastPlayedAt: now,
        },
      }),
    }).then(async (r) => {
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j?.error || j?.message || 'Failed to update game progress');
      }
    });
  }
};
