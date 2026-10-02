import { requestUpload, uploadToGcs, deleteByPrefix } from './storageService';
import { queryCollection } from './firestoreService';
import { storagePaths } from '../config/storagePaths';
import { localToday, nextPracticeState } from '../utils/practiceDays';

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
  if (!response.ok) {
    const error = new Error(json?.error || json?.message || 'Failed to load profile');
    // Carried so callers can tell "no profile document yet" (404, expected on
    // a brand-new account) apart from a genuine failure. Every existing
    // caller ignores it and keeps the previous throw-on-error behaviour.
    error.status = response.status;
    throw error;
  }
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
 * Set a user's subscriptionTier — the field that doubles as their role
 * (explorer/voyager/maestro/vip/admin, configured in
 * appConfig/config/tiersConfig). Setting it on
 * someone else's uid is admin-only (enforced by updateUserProfile's backend
 * call); setting your own is blocked server-side regardless of role.
 *
 * @param {string} token
 * @param {string} uid
 * @param {'explorer'|'voyager'|'maestro'|'vip'|'admin'} subscriptionTier
 */
export const setUserTier = async (token, uid, subscriptionTier) => {
  return updateUserProfile(token, uid, { subscriptionTier });
};

/**
 * Fetch every user profile — admin-only (the backend requires the caller's
 * own subscriptionTier to be 'admin' before running a query across the
 * whole `users` collection). Powers the admin Users panel's list.
 *
 * @param {string} token - Firebase ID token of an admin user
 * @returns {Promise<Array<object>>} Each entry has `uid` plus its Firestore fields
 */
export const listAllUserProfiles = async (token) => {
  const result = await queryCollection('users', {}, { limit: 1000 }, token);
  const documents = result?.documents ?? [];
  return documents.map(({ id, ...rest }) => ({ uid: id, ...rest }));
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

/**
 * Delete an account. Omit `targetUid` to delete your own account (the
 * normal self-service flow). Pass `targetUid` to delete *another* user's
 * account instead — the backend requires the caller to be an admin in
 * that case. Powers both the account-settings delete button and the
 * admin Users panel's delete action.
 *
 * @param {string} token
 * @param {string} [targetUid]
 */
export const deleteAccount = async (token, targetUid) => {
  const response = await fetch(`${PROXY_URL}/api/auth`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(targetUid ? { body: JSON.stringify({ uid: targetUid }) } : {}),
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
 * Append several conceptIds to the global seen list in one write.
 *
 * For the picture games, where one tap can mark a word and a round marks a
 * handful: the same list and the same rule as markConceptSeenGlobal (call it
 * only for words the player got right), written once rather than once each.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string[]} conceptIds
 * @param {string[]} currentSeenIds  - current value from getGlobalSeenIds()
 */
export const markConceptsSeenGlobal = async (token, uid, conceptIds, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, ...conceptIds])];
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
// Word Ladder seen puzzles — stored on users/{uid}.seenWordLadderPuzzleIds
// Dedicated field so Word Ladder progress is isolated from other game seen counts.
// ---------------------------------------------------------------------------

/**
 * Get the list of seen Word Ladder puzzle IDs for a user.
 * Reads users/{uid}.seenWordLadderPuzzleIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
export const getSeenWordLadderPuzzleIds = async (token, uid) => {
  const profile = await getUserProfile(token, uid);
  return profile?.seenWordLadderPuzzleIds ?? [];
};

/**
 * Append a puzzleId to users/{uid}.seenWordLadderPuzzleIds.
 * Safe to call concurrently — uses a Set to deduplicate.
 * Should be called on both win and lose.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   puzzleId
 * @param {string[]} currentSeenIds  - current value from getSeenWordLadderPuzzleIds() to avoid extra read
 */
export const markWordLadderPuzzleSeen = async (token, uid, puzzleId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, puzzleId])];
  await updateUserProfile(token, uid, { seenWordLadderPuzzleIds: updated });
};

/**
 * Clear all seen Word Ladder puzzle IDs.
 * Resets users/{uid}.seenWordLadderPuzzleIds to [].
 * Only affects Word Ladder — does not touch seenConceptIds or seenWordLinkPuzzleIds.
 *
 * @param {string} token
 * @param {string} uid
 */
export const resetSeenWordLadderPuzzles = async (token, uid) => {
  await updateUserProfile(token, uid, {
    seenWordLadderPuzzleIds: [],
    seenWordLadderPuzzlesResetAt: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// Story Generator seen stories — stored on users/{uid}.seenStoryIds
// Dedicated field, matching seenConceptIds / seenWordLadderPuzzleIds, rather
// than a key inside seenExerciseIds: a story isn't an exam exercise, and
// keeping it separate means resetting exam progress can't wipe reading history.
// ---------------------------------------------------------------------------

/**
 * Get the list of seen story IDs for a user.
 * Reads users/{uid}.seenStoryIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
export const getSeenStoryIds = async (token, uid) => {
  const profile = await getUserProfile(token, uid);
  return profile?.seenStoryIds ?? [];
};

/**
 * Append a storyId to users/{uid}.seenStoryIds.
 * Safe to call concurrently — uses a Set to deduplicate.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   storyId
 * @param {string[]} currentSeenIds - current value, passed in to avoid an extra read
 */
export const markStorySeen = async (token, uid, storyId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, storyId])];
  await updateUserProfile(token, uid, { seenStoryIds: updated });
};

/**
 * Append a passage id to users/{uid}.seenPassageIds.
 *
 * Append-only progress tracking, like every other `seen*` field: it stops the
 * shared pronunciation pool handing out a passage somebody has already read
 * aloud. There is deliberately no "remove one" — un-seeing a single passage is
 * meaningless. This tracks the *text*, never a recording of it.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   passageId
 * @param {string[]} [currentSeenIds] - current value, passed in to avoid an extra read
 */
export const markPassageSeen = async (token, uid, passageId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, passageId])];
  await updateUserProfile(token, uid, { seenPassageIds: updated });
};

/**
 * Clear all seen story IDs.
 * Resets users/{uid}.seenStoryIds to [].
 * Only affects the Story Generator — does not touch any other seen-tracking field.
 *
 * @param {string} token
 * @param {string} uid
 */
export const resetSeenStories = async (token, uid) => {
  await updateUserProfile(token, uid, {
    seenStoryIds: [],
    seenStoriesResetAt: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// History & Culture seen facts — stored on users/{uid}.seenHistoryFactsIds
// Dedicated field, matching seenConceptIds / seenWordLadderPuzzleIds, rather
// than a key inside seenExerciseIds: a history fact isn't an exam exercise,
// and keeping it separate means resetting exam progress can't wipe it.
// ---------------------------------------------------------------------------

/**
 * Get the list of seen History & Culture fact IDs for a user.
 * Reads users/{uid}.seenHistoryFactsIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
export const getSeenHistoryFactsIds = async (token, uid) => {
  const profile = await getUserProfile(token, uid);
  return profile?.seenHistoryFactsIds ?? [];
};

/**
 * Append a factId to users/{uid}.seenHistoryFactsIds.
 * Safe to call concurrently — uses a Set to deduplicate.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   factId
 * @param {string[]} currentSeenIds - current value, passed in to avoid an extra read
 */
export const markHistoryFactSeen = async (token, uid, factId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, factId])];
  await updateUserProfile(token, uid, { seenHistoryFactsIds: updated });
};

/**
 * Clear all seen History & Culture fact IDs.
 * Resets users/{uid}.seenHistoryFactsIds to [].
 * Only affects History & Culture — does not touch any other seen-tracking field.
 *
 * @param {string} token
 * @param {string} uid
 */
export const resetSeenHistoryFacts = async (token, uid) => {
  await updateUserProfile(token, uid, {
    seenHistoryFactsIds: [],
    seenHistoryFactsResetAt: new Date().toISOString(),
  });
};

// ---------------------------------------------------------------------------
// Picture games: seen scenes — stored on users/{uid}.seenSceneIds
// Dedicated field, like seenStoryIds and seenHistoryFactsIds. A scene is shared
// by every language (the words to find in it are translated per player), so
// this is one list, not one per practice language.
// ---------------------------------------------------------------------------

/**
 * Get the list of scene IDs this user has already described.
 * Reads users/{uid}.seenSceneIds — returns [] if not yet set.
 *
 * @param {string} token
 * @param {string} uid
 * @returns {Promise<string[]>}
 */
export const getSeenSceneIds = async (token, uid) => {
  const profile = await getUserProfile(token, uid);
  return profile?.seenSceneIds ?? [];
};

/**
 * Append a sceneId to users/{uid}.seenSceneIds.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   sceneId
 * @param {string[]} currentSeenIds - current value, passed in to avoid an extra read
 */
export const markSceneSeen = async (token, uid, sceneId, currentSeenIds = []) => {
  const updated = [...new Set([...currentSeenIds, sceneId])];
  await updateUserProfile(token, uid, { seenSceneIds: updated });
};

/**
 * Clear all seen scene IDs. Only affects "Descreve a imagem".
 *
 * @param {string} token
 * @param {string} uid
 */
export const resetSeenScenes = async (token, uid) => {
  await updateUserProfile(token, uid, {
    seenSceneIds: [],
    seenScenesResetAt: new Date().toISOString(),
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
  grammar: [],
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
 * Mark several exercises seen across multiple types in a single profile write.
 *
 * A Full Exam pulls a dozen exercises at once. Calling markExerciseSeen for
 * each would be a dozen profile reads and a dozen writes; this merges them all
 * into one read/write pair using the same endpoints.
 *
 * @param {string} token
 * @param {string} uid
 * @param {Object<string, string[]>} idsByType - e.g. { reading: ['a','b'], listening: ['c'] }
 * @returns {Promise<Object>} The merged seenExerciseIds map that was written
 */
export const markExercisesSeen = async (token, uid, idsByType = {}) => {
  const entries = Object.entries(idsByType).filter(([, ids]) => ids?.length);
  if (entries.length === 0) return null;

  const profile = await getUserProfile(token, uid);
  const seen = { ...emptySeenExerciseIds(), ...(profile?.seenExerciseIds ?? {}) };
  for (const [type, ids] of entries) {
    seen[type] = [...new Set([...(seen[type] ?? []), ...ids])];
  }
  await updateUserProfile(token, uid, { seenExerciseIds: seen });
  return seen;
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
// Practice days — users/{uid}.practiceDates, .practiceMonths, .practiceDaysSeed
// and .lastPracticeDate. Opening the app signed in is a practice day, once a
// day, in the device's own calendar. Nothing resets; see utils/practiceDays.
// ---------------------------------------------------------------------------

/**
 * Record today as a practice day. A no-op when it already is one.
 *
 * Written through the ordinary profile PUT, like the streak it replaced: a
 * field-level update, no new endpoint. `practiceMonths` goes as a whole map
 * (never a dotted path), the way favourites write whole arrays.
 *
 * @param {string} token
 * @param {string} uid
 * @param {object} profile  the already-fetched Firestore profile
 * @returns {Promise<{practiceDates: string[], practiceMonths: object, practiceDaysSeed: number|null, lastPracticeDate: string|null}>}
 *   the current values, whether or not they just changed
 */
export const recordPracticeDay = async (token, uid, profile) => {
  const next = nextPracticeState(profile, localToday());

  if (!next) {
    return {
      practiceDates: profile?.practiceDates ?? [],
      practiceMonths: profile?.practiceMonths ?? {},
      practiceDaysSeed: profile?.practiceDaysSeed ?? null,
      lastPracticeDate: profile?.lastPracticeDate ?? null,
    };
  }

  await updateUserProfile(token, uid, next);

  return {
    practiceDates: next.practiceDates,
    practiceMonths: next.practiceMonths,
    practiceDaysSeed: next.practiceDaysSeed ?? profile?.practiceDaysSeed ?? null,
    lastPracticeDate: next.lastPracticeDate,
  };
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

// ---------------------------------------------------------------------------
// A Caderneta — the picture games' sticker album
//
// Per player and per practice language, beside the challenge progress: the same
// `userGameProgress/{uid}/games/{gameId}__{dialect}` document the challenges
// keep their play count in, with the list of collected concept ids on it.
// A sticker is a *concept*, not a word in one language, but the album is filed
// by practice language because that is what the player is practising when they
// earn it: a new language starts with an empty album.
// ---------------------------------------------------------------------------

const ALBUM_GAME_ID = 'picture_album';

/**
 * The concept ids this player has collected for a practice language.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string} learningDialect
 * @returns {Promise<string[]>}
 */
export const getAlbumStickers = async (token, uid, learningDialect) => {
  const progress = await getUserGameProgress(token, uid, ALBUM_GAME_ID, learningDialect);
  return Array.isArray(progress?.stickerConceptIds) ? progress.stickerConceptIds : [];
};

/**
 * Save the whole sticker list. A whole-array write, the way favourites are
 * written: a sticker is only ever added, and two devices racing can lose one,
 * which is an accepted trade-off for an album.
 *
 * POST with an explicit id is a safe upsert here: the proxy merges it onto an
 * existing document, so this works on a player's first sticker (no document
 * yet) and on every one after, and leaves `totalPlayed` alone.
 *
 * @param {string}   token
 * @param {string}   uid
 * @param {string}   learningDialect
 * @param {string[]} conceptIds
 */
export const saveAlbumStickers = async (token, uid, learningDialect, conceptIds) => {
  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: PROGRESS_COLLECTION(uid),
      id: PROGRESS_DOC_ID(ALBUM_GAME_ID, learningDialect),
      data: {
        gameId: ALBUM_GAME_ID,
        learningDialect,
        stickerConceptIds: [...new Set(conceptIds)],
        lastPlayedAt: new Date().toISOString(),
      },
    }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.error || json?.message || 'Failed to save the album');
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
