import { requestUpload, uploadToGcs, deleteAvatarFile } from './storageService';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

// GCS public URL base — used to extract the filePath from a stored photoURL
const GCS_BASE_URL = 'https://storage.googleapis.com/multi-lingo-ai.firebasestorage.app/';

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
 * Extracts the GCS object path from a public GCS URL.
 * Returns null if the URL is not a GCS URL for this bucket
 * (e.g. a Google/social auth photo URL).
 *
 * @param {string|null|undefined} photoURL
 * @returns {string|null}
 */
const extractGcsFilePath = (photoURL) => {
  if (!photoURL || !photoURL.startsWith(GCS_BASE_URL)) return null;
  return photoURL.replace(GCS_BASE_URL, '');
};

/**
 * Upload a new profile image, replacing the existing one.
 *
 * Steps:
 *  1. Read the current photoURL from Firestore to identify the old GCS file.
 *  2. Upload the new file to GCS.
 *  3. Save the new publicUrl to the user's Firestore doc.
 *  4. Fire-and-forget deletion of the old GCS file — does not block return.
 *
 * Falls back gracefully: if reading the old URL or deleting it fails,
 * the upload still completes and the new avatar is saved.
 * Social auth photos (Google, etc.) are never touched — extractGcsFilePath
 * returns null for any URL that doesn't start with the GCS bucket base.
 *
 * @param {string} token - Firebase ID token
 * @param {string} uid   - User UID
 * @param {File}   file  - The image file to upload
 * @returns {Promise<string>} The public URL of the new avatar
 */
export const uploadProfileImage = async (token, uid, file) => {
  // 1. Capture old GCS file path before overwriting photoURL
  let oldFilePath = null;
  try {
    const profile = await getUserProfile(token, uid);
    oldFilePath = extractGcsFilePath(profile?.photoURL);
  } catch (e) {
    console.warn('[uploadProfileImage] Could not read old avatar URL:', e);
  }

  // 2. Upload the new avatar
  const { uploadUrl, publicUrl } = await requestUpload(
    token,
    file.name,
    file.type,
    'avatars',
    { uid },
  );
  await uploadToGcs(uploadUrl, file, file.type, { 'x-goog-acl': 'public-read' });

  // 3. Persist the new URL in Firestore
  await updateUserProfile(token, uid, { photoURL: publicUrl });

  // 4. Fire-and-forget: delete old GCS file in the background.
  // The new avatar is already live at this point — no need to block the caller.
  // Skipped automatically if the old photo was a social auth URL (null path).
  if (oldFilePath) {
    deleteAvatarFile(token, oldFilePath).catch((e) => {
      console.warn('[uploadProfileImage] Old avatar cleanup failed (non-fatal):', e);
    });
  }

  return publicUrl;
};

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
 */

const PROGRESS_COLLECTION = (uid) => `userGameProgress/${uid}/games`;
const PROGRESS_DOC_ID     = (gameId, learningDialect) => `${gameId}__${learningDialect}`;

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

  if (response.status === 404) return null;

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to load game progress');

  return json?.data?.data ?? null;
};

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

/**
 * Reset the seen words list for a given game + dialect.
 * Only clears seenConceptIds — totalPlayed and other fields are preserved.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string} gameId
 * @param {string} learningDialect
 * @returns {Promise<void>}
 */
export const resetSeenWords = async (token, uid, gameId, learningDialect) => {
  const collection = PROGRESS_COLLECTION(uid);
  const id         = PROGRESS_DOC_ID(gameId, learningDialect);
  const now        = new Date().toISOString();

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection,
      id,
      data: {
        seenConceptIds: [],
        updatedAt: now,
      },
    }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to reset seen words');
};
