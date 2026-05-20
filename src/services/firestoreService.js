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
// getDocument
// GET /api/firestore?collection={path}&id={docId}
//
// Supports both top-level and subcollection paths:
//   getDocument('users', uid)
//   getDocument('gameWords/hangman__es-MX__food/words', wordId)
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

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[firestoreService] getDocument failed (${response.status})`
    );
  }

  // API envelope: { success: true, data: { id, data: T, collection } }
  return json.data;
}

// ---------------------------------------------------------------------------
// queryCollection
// GET /api/firestore?collection={path}&query={filters}&orderBy=...&limit=...
//
// Fetches up to `limit` (max 100) documents matching the given field filters.
// Supports subcollection paths.
// ---------------------------------------------------------------------------

/**
 * Run a filtered query against a Firestore collection or subcollection.
 *
 * @param {string} collection - Collection path (slash-separated for subcollections).
 * @param {Record<string, unknown>} [filters={}] - Field equality filters.
 * @param {{ orderBy?: string, order?: 'asc'|'desc', limit?: number, startAfter?: string }} [options={}]
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').FirestoreQueryResult>}
 */
export async function queryCollection(collection, filters = {}, options = {}, token) {
  const idToken = token ?? (await getToken());

  const { orderBy = 'createdAt', order = 'desc', limit = 100, startAfter } = options;

  const url = new URL(`${PROXY_URL}/api/firestore`);
  url.searchParams.set('collection', collection);
  url.searchParams.set('query', JSON.stringify(filters));
  url.searchParams.set('orderBy', orderBy);
  url.searchParams.set('order', order);
  url.searchParams.set('limit', String(limit));
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
    throw new Error(
      json?.error ?? json?.message ?? `[firestoreService] queryCollection failed (${response.status})`
    );
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
    throw new Error(
      json?.error ?? json?.message ?? `[firestoreService] createDocument failed (${response.status})`
    );
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
    throw new Error(
      json?.error ?? json?.message ?? `[firestoreService] updateDocument failed (${response.status})`
    );
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
//     'gameWords/hangman__es-MX__food/words',
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
    throw new Error(
      json?.error ?? json?.message ?? `[firestoreService] patchDocument failed (${response.status})`
    );
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
    throw new Error(
      json?.error ?? json?.message ?? `[firestoreService] deleteDocument failed (${response.status})`
    );
  }

  return json.data;
}
