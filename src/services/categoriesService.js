/**
 * categoriesService.js
 *
 * Manages the interest categories shown during onboarding and in Settings.
 * Backed by Firestore appConfig/config/categories/{id} docs — the document
 * ID is the category's slug (e.g. "food"), matching the values already
 * stored in each user's `interests` array.
 */

import {
  queryCollection,
  createDocument,
  updateDocument,
  deleteDocument,
  getTokenOrAnonymous,
} from "./firestoreService";

export const CATEGORIES_COLLECTION = "appConfig/config/categories";

/**
 * Fetch all interest categories, sorted by `order` then `label`.
 *
 * @param {string} [token] - Optional Firebase ID token. Falls back to an
 *   anonymous session for guests, matching getLanguages()/getWritingSystems().
 * @returns {Promise<Array<{id:string, label:string, order?:number}>>}
 */
export async function getCategories(token) {
  const authToken = token ?? (await getTokenOrAnonymous());
  const result = await queryCollection(CATEGORIES_COLLECTION, {}, {}, authToken);
  const docs = result?.documents ?? [];
  return [...docs].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    return orderDiff !== 0 ? orderDiff : String(a.label ?? a.id).localeCompare(String(b.label ?? b.id));
  });
}

/**
 * Create a new interest category. Admin-only call site.
 *
 * @param {string} id - Slug used as the document ID and stored on user profiles (e.g. "food").
 * @param {{label: string, order?: number}} data
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<object>}
 */
export async function createCategory(id, data, token) {
  return createDocument(CATEGORIES_COLLECTION, data, id, token);
}

/**
 * Update an existing interest category's label/order. Admin-only call site.
 * The document ID (slug) is immutable — it's referenced by existing user
 * profiles, so renaming it would silently orphan their saved interests.
 *
 * @param {string} id
 * @param {{label?: string, order?: number}} data
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<object>}
 */
export async function updateCategory(id, data, token) {
  return updateDocument(CATEGORIES_COLLECTION, id, data, token);
}

/**
 * Delete an interest category. Admin-only call site.
 *
 * @param {string} id
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<object>}
 */
export async function deleteCategory(id, token) {
  return deleteDocument(CATEGORIES_COLLECTION, id, token);
}
