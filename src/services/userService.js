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
// Shared across ALL word-based game features (hangman, scrambled, wordsearch).
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
 * Affects ALL word-based game features — used from global Settings reset.
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
// Word Link seen puzzles — stored on users/{uid}.seenWordLinkPuzzleIds
// Dedicated field so Word Link progress is isolated from word-game seen counts.
// ---------------------------------------------------------------------------

/**
 * Get the list of seen Word Link puzzle IDs for a user.
 * Reads users/{uid}.seenWordLinkPuzzleIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
export const getSeenWordLinkPuzzleIds = async (token, uid) => {
  const profile = await getUserProfile(token, uid);
  return profile?.seenWordLinkPuzzleIds ?? [];
};

/**
 * Append a puzzleId to users/{uid}.seenWordLinkPuzzleIds.
 * Safe to call concurrently — uses a Set to deduplicate.
 * Should be called on both win and lose.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   puzzleId
 * @param {string[]} currentSeenIds  - current value from getSeenWordLinkPuzzleIds() to avoid extra read
 */
export const markWordLinkPuzzleSeen = async (token, uid, puzzleId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, puzzleId])];
  await updateUserProfile(token, uid, { seenWordLinkPuzzleIds: updated });
};

/**
 * Clear all seen Word Link puzzle IDs.
 * Resets users/{uid}.seenWordLinkPuzzleIds to [].
 * Only affects Word Link — does not touch seenConceptIds.
 *
 * @param {string} token
 * @param {string} uid
 */
export const resetSeenWordLinkPuzzles = async (token, uid) => {
  await updateUserProfile(token, uid, {
    seenWordLinkPuzzleIds: [],
    seenWordLinkPuzzlesResetAt: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// Seen exercise IDs — stored on users/{uid}.seenExerciseIds
// Tracks which exam exercises the user has already been shown, split by type.
// Structure: { reading: string[], listening: string[], writing: string[] }
// ---------------------------------------------------------------------------

/**
 * Get the empty template for seenExerciseIds.
 * @returns {{ reading: string[], listening: string[], writing: string[] }}
 */
const emptySeenExerciseIds = () => ({
  reading: [],
  listening: [],
  writing: [],
});

/**
 * Get the list of seen exercise IDs for a user by type.
 * Reads users/{uid}.seenExerciseIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @param {'reading'|'listening'|'writing'} type
 * @returns {Promise<string[]>}
 */
export const getSeenExerciseIds = async (token, uid, type) => {
  const profile = await getUserProfile(token, uid);
  const seen = profile?.seenExerciseIds ?? {};
  return seen?.[type] ?? [];
};

/**
 * Append an exerciseId to the seen list on users/{uid}, split by type.
 * Safe to call concurrently — uses a Set to deduplicate.
 * Should be called after an exercise has been completed/evaluated.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {'reading'|'listening'|'writing'} type
 * @param {string}   exerciseId
 * @param {string[]} currentSeenIds  - current value for this type to avoid extra read
 */
export const markExerciseSeen = async (token, uid, type, exerciseId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, exerciseId])];
  const profile = await getUserProfile(token, uid);
  const seen = { ...emptySeenExerciseIds(), ...(profile?.seenExerciseIds ?? {}) };
  seen[type] = updated;
  await updateUserProfile(token, uid, { seenExerciseIds: seen });
};

/**
 * Clear all seen exercise IDs for a specific type.
 * Resets users/{uid}.seenExerciseIds to [].
 * Allows the user to see previously completed exercises of that type again.
 *
 * @param {string} token
 * @param {string} uid
 * @param {'reading'|'listening'|'writing'} type
 */
export const resetSeenExercises = async (token, uid, type) => {
  const profile = await getUserProfile(token, uid);
  const seen = { ...emptySeenExerciseIds(), ...(profile?.seenExerciseIds ?? {}) };
  seen[type] = [];
  await updateUserProfile(token, uid, {
    seenExerciseIds: seen,
    seenExercisesResetAt: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// Day streak — stored on users/{uid}.dayStreak + users/{uid}.lastStreakDate
// lastStreakDate is stored as a YYYY-MM-DD string (UTC).
// ---------------------------------------------------------------------------

const getTodayUTC = () => new Date().toISOString().slice(0, 10);

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

  if (last === today) return current;

  let newStreak;
  if (last === yesterday) {
    newStreak = current + 1;
  } else {
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
// ---------------------------------------------------------------------------

const PROGRESS_COLLECTION = (uid) => `userGameProgress/${uid}/games`;
const PROGRESS_DOC_ID     = (gameId, learningDialect) => `${gameId}__${learningDialect}`;

/**
 * Get per-game stats for a specific game + dialect.
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
 * Kept for backward compatibility. Redirects to markConceptSeenGlobal().
 */
export const markConceptSeen = async (
  token,
  uid,
  gameId,
  learningDialect,
  conceptId,
  currentProgress
) => {
  const currentSeenIds = await getGlobalSeenIds(token, uid);
  await markConceptSeenGlobal(token, uid, conceptId, currentSeenIds);

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
      if (!r.ok && r.status !== 409) {
        const j = await r.json();
        throw new Error(j?.error || j?.message || 'Failed to create game progress');
      }
    });
  }
};

/**
 * @deprecated — use resetAllSeenWords() instead.
 */
export const resetSeenWords = async (token, uid) => {
  await resetAllSeenWords(token, uid);
};
