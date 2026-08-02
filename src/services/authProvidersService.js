/**
 * authProvidersService.js
 *
 * Reads/writes which social sign-in providers are enabled, backing the
 * grey-out state on LoginPage and the toggle switches on the Admin page.
 * Backed by Firestore appConfig/config/authProviders/{providerId} docs.
 *
 * Falls back to these defaults (matching what api/auth.ts actually
 * implements today) whenever a provider has no doc yet, so LoginPage
 * never breaks before an admin has touched a toggle.
 */
import { queryCollection, createDocument } from "./firestoreService";

export const AUTH_PROVIDERS_COLLECTION = "appConfig/config/authProviders";

export const AUTH_PROVIDER_IDS = ["google", "apple", "facebook", "twitter"];

const DEFAULT_PROVIDER_STATE = {
  google: true,
  apple: false,
  facebook: false,
  twitter: false,
};

/**
 * Fetch enabled/disabled state for every social sign-in provider.
 *
 * @param {string} [token] - Optional pre-fetched Firebase ID token. LoginPage
 *   (a pre-auth page) should pass the result of getTokenOrAnonymous().
 * @returns {Promise<Record<string, boolean>>} provider id -> enabled
 */
export async function getAuthProviders(token) {
  try {
    const result = await queryCollection(AUTH_PROVIDERS_COLLECTION, {}, {}, token);
    const docs = result?.documents ?? [];
    const overrides = Object.fromEntries(docs.map((doc) => [doc.id, Boolean(doc.enabled)]));
    return { ...DEFAULT_PROVIDER_STATE, ...overrides };
  } catch (err) {
    console.error("[authProvidersService] getAuthProviders failed, using defaults:", err.message);
    return { ...DEFAULT_PROVIDER_STATE };
  }
}

/**
 * Enable/disable a single provider. Admin-only call site.
 * Uses createDocument (upsert via Firestore `.set()`) rather than
 * updateDocument, since the doc may not exist yet on the first toggle.
 *
 * @param {string} providerId - one of AUTH_PROVIDER_IDS
 * @param {boolean} enabled
 * @returns {Promise<object>}
 */
export async function setAuthProviderEnabled(providerId, enabled) {
  return createDocument(AUTH_PROVIDERS_COLLECTION, { enabled }, providerId);
}
