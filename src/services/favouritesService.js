/**
 * favouritesService.js
 *
 * User favourites — the "hearted" items a user wants to come back to,
 * stored per kind on their own `users/{uid}` document.
 *
 * Relationship to the "seen ids" logic in userService
 * ---------------------------------------------------
 * Both keep an array of ids on the user's profile document and both go through
 * the same `/api/firestore` PUT, but they are not the same thing and must not
 * share fields:
 *
 *   - "seen" is append-only progress tracking. Items go in and only ever come
 *     out via a wholesale reset ("reset all exercises"). Nothing removes a
 *     single id, because un-seeing one item is meaningless.
 *   - "favourites" is a user-curated list. Items must go in AND out one at a
 *     time, because the heart is a toggle — that is the whole reason this
 *     lives in its own service rather than growing more `mark*Seen` helpers.
 *
 * Storage
 * -------
 * One array field per kind on `users/{uid}`, named by FAVOURITE_FIELDS below
 * (e.g. `favGrammarTipIds`). Separate fields rather than one map so a kind can
 * be read without pulling the others, matching how the seen-id fields are laid
 * out.
 *
 * Concurrency
 * -----------
 * Same trade-off the seen-id helpers make: the whole array is written back,
 * so two writes racing on different devices can lose one change. Acceptable
 * for a favourites list; if it ever stops being, this is the place that would
 * move to an arrayUnion/arrayRemove on the proxy.
 *
 * Adding a new kind
 * -----------------
 * Add one entry to FAVOURITE_FIELDS. Nothing else in this file changes, and
 * the field is created lazily on first write — no migration, no seeding.
 *
 * Usage:
 *   import { FAVOURITE_KINDS, toggleFavourite, isFavourite } from './favouritesService';
 *
 *   const ids = getFavouriteIds(user, FAVOURITE_KINDS.GRAMMAR_TIP);
 *   const next = await toggleFavourite({
 *     token: user.token, uid: user.uid,
 *     kind: FAVOURITE_KINDS.GRAMMAR_TIP, id: tip.id, currentIds: ids,
 *   });
 */

import { getUserProfile, updateUserProfile } from './userService';

// ---------------------------------------------------------------------------
// Kinds
// ---------------------------------------------------------------------------

/**
 * The things a user can favourite. Values are stable string keys — they index
 * FAVOURITE_FIELDS, so renaming one orphans the stored data.
 */
export const FAVOURITE_KINDS = {
  GRAMMAR_TIP: 'grammarTip',
  STORY: 'story',
  WORD: 'word',
};

/**
 * Kind → the field it occupies on `users/{uid}`.
 *
 * The `fav` prefix keeps these visually distinct from the `seen*` fields in
 * the same document, which are a different mechanism (see the header).
 */
const FAVOURITE_FIELDS = {
  [FAVOURITE_KINDS.GRAMMAR_TIP]: 'favGrammarTipIds',
  [FAVOURITE_KINDS.STORY]:       'favStoryIds',
  [FAVOURITE_KINDS.WORD]:        'favWordIds',
};

function fieldFor(kind) {
  const field = FAVOURITE_FIELDS[kind];
  if (!field) throw new Error(`[favouritesService] Unknown favourite kind: ${kind}`);
  return field;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read one kind's favourites straight off an already-loaded user object.
 *
 * Synchronous and network-free: AppContext already holds the profile, so a
 * component rendering hearts should use this rather than re-fetching. Returns
 * a new array each call, so never mutate the result expecting it to stick.
 *
 * @param {Object} user - the user object from AppContext
 * @param {string} kind - one of FAVOURITE_KINDS
 * @returns {string[]}
 */
export function getFavouriteIds(user, kind) {
  const value = user?.[fieldFor(kind)];
  return Array.isArray(value) ? value : [];
}

/**
 * Whether `id` is currently favourited, from an already-loaded user object.
 *
 * @param {Object} user
 * @param {string} kind - one of FAVOURITE_KINDS
 * @param {string} id
 * @returns {boolean}
 */
export function isFavourite(user, kind, id) {
  return getFavouriteIds(user, kind).includes(id);
}

/**
 * Fetch one kind's favourites from Firestore.
 *
 * Only needed when there is no loaded profile to read from — prefer
 * getFavouriteIds(user, kind), which costs nothing.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string} kind - one of FAVOURITE_KINDS
 * @returns {Promise<string[]>}
 */
export async function fetchFavouriteIds(token, uid, kind) {
  const field = fieldFor(kind);
  const profile = await getUserProfile(token, uid);
  const value = profile?.[field];
  return Array.isArray(value) ? value : [];
}

/**
 * Add `id` to a kind's favourites. Idempotent.
 *
 * @param {Object}   params
 * @param {string}   params.token
 * @param {string}   params.uid
 * @param {string}   params.kind       - one of FAVOURITE_KINDS
 * @param {string}   params.id
 * @param {string[]} params.currentIds - current value, to avoid an extra read
 * @returns {Promise<string[]>} the new list
 */
export async function addFavourite({ token, uid, kind, id, currentIds = [] }) {
  const field = fieldFor(kind);
  if (!id) throw new Error('[favouritesService] id is required');

  const updated = [...new Set([...currentIds, id])];
  await updateUserProfile(token, uid, { [field]: updated });
  return updated;
}

/**
 * Remove `id` from a kind's favourites. Idempotent.
 *
 * This is the half the seen-id helpers deliberately don't have — un-favouriting
 * one item has to work without clearing the rest.
 *
 * @param {Object}   params
 * @param {string}   params.token
 * @param {string}   params.uid
 * @param {string}   params.kind       - one of FAVOURITE_KINDS
 * @param {string}   params.id
 * @param {string[]} params.currentIds - current value, to avoid an extra read
 * @returns {Promise<string[]>} the new list
 */
export async function removeFavourite({ token, uid, kind, id, currentIds = [] }) {
  const field = fieldFor(kind);
  if (!id) throw new Error('[favouritesService] id is required');

  const updated = currentIds.filter((existing) => existing !== id);
  await updateUserProfile(token, uid, { [field]: updated });
  return updated;
}

/**
 * Flip `id`'s favourite state — what the heart button calls.
 *
 * @param {Object}   params
 * @param {string}   params.token
 * @param {string}   params.uid
 * @param {string}   params.kind       - one of FAVOURITE_KINDS
 * @param {string}   params.id
 * @param {string[]} params.currentIds - current value, to avoid an extra read
 * @returns {Promise<{ids: string[], isFavourite: boolean}>} the new list and resulting state
 */
export async function toggleFavourite({ token, uid, kind, id, currentIds = [] }) {
  const willRemove = currentIds.includes(id);
  const ids = willRemove
    ? await removeFavourite({ token, uid, kind, id, currentIds })
    : await addFavourite({ token, uid, kind, id, currentIds });

  return { ids, isFavourite: !willRemove };
}

/**
 * The profile field a kind is stored in.
 *
 * Exported so a caller updating AppContext's user object after a toggle can
 * write the same field this service does, instead of hardcoding the name.
 *
 * @param {string} kind - one of FAVOURITE_KINDS
 * @returns {string}
 */
export function favouriteFieldFor(kind) {
  return fieldFor(kind);
}
