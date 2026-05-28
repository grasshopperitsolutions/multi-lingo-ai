import { requestUpload, uploadToGcs, deleteByPrefix } from './storageService';
import { storagePaths } from '../config/storagePaths';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} UserGameProgress
 * @property {string}   gameId            - e.g. 'hangman'
 * @property {string}   learningDialect   - BCP-47, e.g. 'pt-PT'
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
 * Upload a new profile image, replacing the existing one.
 *
 * Steps:
 *  1. Wipe ALL files under the user's avatar folder — must complete before
 *     the upload to avoid the new file being caught by the prefix wipe.
 *  2. Upload the new file to GCS.
 *  3. Save the new publicUrl to the user's Firestore doc.
 *
 * The wipe is non-fatal: if it fails (e.g. folder already empty, transient
 * network error), the upload proceeds anyway.
 *
 * Social auth photos (Google, etc.) are never touched — they live outside
 * our GCS bucket entirely.
 *
 * @param {string} token - Firebase ID token
 * @param {string} uid   - User UID
 * @param {File}   file  - The image file to upload
 * @returns {Promise<string>} The public URL of the new avatar
 */
export const uploadProfileImage = async (token, uid, file) => {
  try {
    await deleteByPrefix(token, storagePaths.avatarFolder(uid));
  } catch (e) {
    console.warn('[uploadProfileImage] Avatar prefix clear failed (non-fatal):', e);
  }

  const { uploadUrl, publicUrl } = await requestUpload(
    token,
    file.name,
    file.type,
    'avatars',
    { uid },
  );
  await uploadToGcs(uploadUrl, file, file.type, { 'x-goog-acl': 'public-read' });

  await updateUserProfile(token, uid, { photoURL: publicUrl });

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
// Global seen words — stored on users/{uid}.seenConceptIds
// Shared across ALL app features (games, challenges, etc.)
// ---------------------------------------------------------------------------

/**
 * Get the global list of seen concept IDs for a user.
 * Reads users/{uid}.seenConceptIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
export const getGlobalSeenIds = async (token, uid) => {
  const profile = await getUserProfile(token, uid);
  return profile?.seenConceptIds ?? [];
};

/**
 * Append a conceptId to the global seen list on users/{uid}.
 * Safe to call concurrently — uses a Set to deduplicate.
 * Should only be called on a correct answer / successful word completion.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   conceptId
 * @param {string[]} currentSeenIds  - current value from getGlobalSeenIds() to avoid extra read
 */
export const markConceptSeenGlobal = async (token, uid, conceptId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, conceptId])];
  await updateUserProfile(token, uid, { seenConceptIds: updated });
};

/**
 * Clear all seen concept IDs globally.
 * Resets users/{uid}.seenConceptIds to [].
 * Affects ALL features — used from global Settings reset.
 *
 * @param {string} token
 * @param {string} uid
 */
export const resetAllSeenWords = async (token, uid) => {
  await updateUserProfile(token, uid, {
    seenConceptIds: [],
    seenWordsResetAt: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// Day streak — stored on users/{uid}.dayStreak + users/{uid}.lastStreakDate
// lastStreakDate is stored as a YYYY-MM-DD string (UTC).
// ---------------------------------------------------------------------------

/**
 * Returns today's date as a YYYY-MM-DD string in UTC.
 * @returns {string}
 */
const getTodayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * Returns yesterday's date as a YYYY-MM-DD string in UTC.
 * @returns {string}
 */
const getYesterdayUTC = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Update the user's day streak based on their last active date.
 *
 * Rules:
 *  - Same day as lastStreakDate  → no-op (already counted today)
 *  - lastStreakDate was yesterday → increment streak by 1
 *  - lastStreakDate is older or missing → reset streak to 1
 *
 * Writes { dayStreak, lastStreakDate } to users/{uid} and returns the
 * updated streak value so the caller can update context immediately
 * without an extra read.
 *
 * @param {string}      token
 * @param {string}      uid
 * @param {object}      profile  - the already-fetched Firestore profile object
 * @returns {Promise<number>}    - the new (or unchanged) streak value
 */
export const updateDayStreak = async (token, uid, profile) => {
  const today     = getTodayUTC();
  const yesterday = getYesterdayUTC();
  const last      = profile?.lastStreakDate ?? null;
  const current   = profile?.dayStreak ?? 0;

  // Already updated today — return existing value without writing
  if (last === today) return current;

  let newStreak;
  if (last === yesterday) {
    // Consecutive day — keep the streak going
    newStreak = current + 1;
  } else {
    // First ever login, or streak broken — start fresh
    newStreak = 1;
  }

  await updateUserProfile(token, uid, {
    dayStreak: newStreak,
    lastStreakDate: today,
  });

  return newStreak;
};

// ---------------------------------------------------------------------------
// Game progress — userGameProgress/{uid}/games/{gameId}__{learningDialect}
// Stores per-game stats ONLY: totalPlayed, lastPlayedAt, etc.
// seenConceptIds is NO LONGER stored here — see getGlobalSeenIds above.
// ---------------------------------------------------------------------------

const PROGRESS_COLLECTION = (uid) => `userGameProgress/${uid}/games`;
const PROGRESS_DOC_ID     = (gameId, learningDialect) => `${gameId}__${learningDialect}`;

/**
 * Get per-game stats for a specific game + dialect.
 * Used by the sidebar to show totalPlayed, lastPlayedAt, etc.
 * Does NOT return seenConceptIds — use getGlobalSeenIds() for that.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string} gameId
 * @param {string} learningDialect
 * @returns {Promise<UserGameProgress|null>}
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

  if (response.status === 404) return null;

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error || json?.message || 'Failed to load game progress');

  return json?.data?.data ?? null;
};

/**
 * Record a play attempt (correct or incorrect).
 * Increments totalPlayed and sets lastPlayedAt.
 * Does NOT touch seenConceptIds — call markConceptSeenGlobal() for that.
 * Should be called on every answer submission (win or lose).
 *
 * @param {string}             token
 * @param {string}             uid
 * @param {string}             gameId
 * @param {string}             learningDialect
 * @param {UserGameProgress|null} currentProgress
 */
export const recordPlay = async (
  token,
  uid,
  gameId,
  learningDialect,
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
          totalPlayed: (currentProgress.totalPlayed ?? 0) + 1,
          lastPlayedAt: now,
        },
      }),
    }).then(async (r) => {
      if (!r.ok) {
        const j = await r.json();
        throw new Error(j?.error || j?.message || 'Failed to record play');
      }
    });
  }
};

/**
 * @deprecated — seenConceptIds is no longer stored per-game.
 * This function is kept for backward compatibility only.
 * Use markConceptSeenGlobal() instead.
 *
 * If the game progress doc does not yet exist, it will be created
 * (without seenConceptIds) so that recordPlay() has a doc to update.
 */
export const markConceptSeen = async (
  token,
  uid,
  gameId,
  learningDialect,
  conceptId,
  currentProgress
) => {
  // Redirect to the global implementation
  const currentSeenIds = await getGlobalSeenIds(token, uid);
  await markConceptSeenGlobal(token, uid, conceptId, currentSeenIds);

  // If there's no game progress doc yet, create a minimal one so stats work
  if (!currentProgress) {
    const collection = PROGRESS_COLLECTION(uid);
    const id         = PROGRESS_DOC_ID(gameId, learningDialect);
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
          totalPlayed: 0,
          lastPlayedAt: new Date().toISOString(),
        },
      }),
    }).then(async (r) => {
      // 409 Conflict = doc already exists, safe to ignore
      if (!r.ok && r.status !== 409) {
        const j = await r.json();
        throw new Error(j?.error || j?.message || 'Failed to create game progress');
      }
    });
  }
};

/**
 * @deprecated — use resetAllSeenWords() instead.
 * Kept for backward compatibility. Redirects to the global reset.
 */
export const resetSeenWords = async (token, uid) => {
  await resetAllSeenWords(token, uid);
};
