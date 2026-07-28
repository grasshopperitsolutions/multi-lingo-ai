import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebase';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

// ---------------------------------------------------------------------------
// Helper: resolve a fresh ID token, throwing a clear error if not authed
// ---------------------------------------------------------------------------
async function getToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('[firestoreService] No authenticated user');
  return user.getIdToken();
}

// ---------------------------------------------------------------------------
// Helper: resolve a token for calls that must work for guests too, falling
// back to an anonymous Firebase session when nobody is signed in. Reusable
// by any call site that needs guest-accessible reads (e.g. translations,
// supported-languages lookups) — most call sites should keep using the
// strict getToken() above.
// ---------------------------------------------------------------------------
export async function getTokenOrAnonymous() {
  if (auth?.currentUser) return auth.currentUser.getIdToken();

  // Wait for Firebase to finish restoring any persisted session before
  // assuming there isn't one — otherwise a page refresh for an already
  // logged-in user could race and briefly spin up a throwaway anonymous
  // session before the real one loads.
  await auth?.authStateReady?.();
  if (auth?.currentUser) return auth.currentUser.getIdToken();

  const cred = await signInAnonymously(auth);
  return cred.user.getIdToken();
}

// ---------------------------------------------------------------------------
// getDocument
// GET /api/firestore?collection={path}&id={docId}
//
// Supports both top-level and subcollection paths:
//   getDocument('users', uid)
//   getDocument('gameWords/hangman__es-ES__food/words', wordId)
// ---------------------------------------------------------------------------

/**
 * Fetch a single Firestore document by collection path and document ID.
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {string} id - Document ID.
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreGetOneResult>}
 */
export async function getDocument(collection, id, token) {
  const idToken = token ?? (await getToken());

  const url = new URL(`${PROXY_URL}/api/firestore`);
  url.searchParams.set('collection', collection);
  url.searchParams.set('id', id);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  });

  // Document not found — return null (not an error)
  if (response.status === 404) {
    console.log(`[firestoreService] Document not found — collection: "${collection}", id: "${id}"`);
    return null;
  }

  const json = await response.json();

  if (!response.ok) {
    const msg = json?.error ?? json?.message ?? `getDocument failed (${response.status})`;
    console.error(`[firestoreService] ${msg} — collection: "${collection}", id: "${id}"`);
    throw new Error(`[firestoreService] ${msg}`);
  }

  // API envelope: { success: true, data: { id, data: T, collection } }
  return json.data;
}

// ---------------------------------------------------------------------------
// queryCollection
// GET /api/firestore?collection={path}&filters={field,op,value}[]&orderBy=...&limit=...
//
// Fetches up to `limit` (max 100) documents matching the given field filters.
// Supports subcollection paths.
// ---------------------------------------------------------------------------

/**
 * Run a filtered query against a Firestore collection or subcollection.
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {Record<string, unknown>} [filters={}] - Field equality filters, e.g. { code: 'pt-PT' }.
 *   Internally converted to the API's expected `{ field, op, value }[]` shape, with
 *   `op` defaulting to '==' for every entry.
 * @param {{ orderBy?: string, order?: 'asc'|'desc', limit?: number, startAfter?: string }} [options={}]
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreQueryResult>}
 */
export async function queryCollection(collection, filters = {}, options = {}, token) {
  const idToken = token ?? (await getToken());

  // NOTE: orderBy, order, and limit default to undefined — they are only sent
  // when explicitly provided. Without ordering, Firestore returns documents in
  // document ID order without needing composite indexes, which is faster.
  const { orderBy, order, limit=1000, startAfter } = options;

  // The API expects an array of { field, op, value } filter descriptors under
  // the "filters" query param (see api/firestore.ts). Convert the simple
  // equality-map shape used throughout this codebase into that format.
  const filterArray = Object.entries(filters).map(([field, value]) => ({
    field,
    op: '==',
    value,
  }));

  const url = new URL(`${PROXY_URL}/api/firestore`);
  url.searchParams.set('collection', collection);
  url.searchParams.set('filters', JSON.stringify(filterArray));
  if (orderBy) url.searchParams.set('orderBy', orderBy);
  if (order) url.searchParams.set('order', order);
  if (limit !== undefined) url.searchParams.set('limit', String(limit));
  if (startAfter) url.searchParams.set('startAfter', startAfter);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await response.json();

  if (!response.ok) {
    const msg = json?.error ?? json?.message ?? `queryCollection failed (${response.status})`;
    console.error(`[firestoreService] ${msg} — collection: "${collection}"`);
    throw new Error(`[firestoreService] ${msg}`);
  }

  // API envelope: { success: true, data: FirestoreQueryResult }
  return json.data;
}

// ---------------------------------------------------------------------------
// createDocument
// POST /api/firestore
//
// Creates a new document. Pass `id` to use a specific doc ID, omit for auto-ID.
// Supports subcollection paths.
// ---------------------------------------------------------------------------

/**
 * Create a new Firestore document.
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {Record<string, unknown>} data - Document data.
 * @param {string} [id] - Optional specific document ID. Omit for auto-generated ID.
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreWriteResult>}
 */
export async function createDocument(collection, data, id, token) {
  const idToken = token ?? (await getToken());

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collection, data, ...(id ? { id } : {}) }),
  });

  const json = await response.json();

  if (!response.ok) {
    const msg = json?.error ?? json?.message ?? `createDocument failed (${response.status})`;
    console.error(`[firestoreService] ${msg} — collection: "${collection}"${id ? `, id: "${id}"` : ''}`);
    throw new Error(`[firestoreService] ${msg}`);
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// updateDocument
// PUT /api/firestore
//
// Root-level field replacement. Does NOT deep-merge maps.
// Use patchDocument() for updating individual keys inside a map field.
// ---------------------------------------------------------------------------

/**
 * Update (replace root fields of) an existing Firestore document.
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {string} id - Document ID.
 * @param {Record<string, unknown>} data - Fields to update.
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreMutationResult>}
 */
export async function updateDocument(collection, id, data, token) {
  const idToken = token ?? (await getToken());

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collection, id, data }),
  });

  const json = await response.json();

  if (!response.ok) {
    const msg = json?.error ?? json?.message ?? `updateDocument failed (${response.status})`;
    console.error(`[firestoreService] ${msg} — collection: "${collection}", id: "${id}"`);
    throw new Error(`[firestoreService] ${msg}`);
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// patchDocument
// PATCH /api/firestore
//
// Deep merge update using Firestore dot-notation keys.
// Use this to update a single entry inside a map field without
// overwriting sibling entries.
//
// Example — add a Portuguese hint without touching existing hints:
//   patchDocument(
//     'gameWords/hangman__es-ES__food/words',
//     wordId,
//     { 'hints.pt-BR': 'Uma fruta redonda...' }
//   )
// ---------------------------------------------------------------------------

/**
 * Patch a Firestore document using dot-notation keys (deep merge).
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {string} id - Document ID.
 * @param {Record<string, unknown>} data - Dot-notation field updates.
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreMutationResult>}
 */
export async function patchDocument(collection, id, data, token) {
  const idToken = token ?? (await getToken());

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collection, id, data }),
  });

  const json = await response.json();

  if (!response.ok) {
    const msg = json?.error ?? json?.message ?? `patchDocument failed (${response.status})`;
    console.error(`[firestoreService] ${msg} — collection: "${collection}", id: "${id}"`);
    throw new Error(`[firestoreService] ${msg}`);
  }

  return json.data;
}

// ---------------------------------------------------------------------------
// deleteDocument
// DELETE /api/firestore
// ---------------------------------------------------------------------------

/**
 * Delete a Firestore document.
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {string} id - Document ID.
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreMutationResult>}
 */
export async function deleteDocument(collection, id, token) {
  const idToken = token ?? (await getToken());

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collection, id }),
  });

  const json = await response.json();

  if (!response.ok) {
    const msg = json?.error ?? json?.message ?? `deleteDocument failed (${response.status})`;
    console.error(`[firestoreService] ${msg} — collection: "${collection}", id: "${id}"`);
    throw new Error(`[firestoreService] ${msg}`);
  }

  return json.data;
}
