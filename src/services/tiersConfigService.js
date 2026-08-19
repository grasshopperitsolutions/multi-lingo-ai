/**
 * tiersConfigService.js
 *
 * Reads/writes per-tier limits and feature access, backing the Tiers section on
 * the Admin page and the gating in useTierAccess.
 *
 * Backed by Firestore appConfig/config/tiersConfig/{tierId} docs, through the
 * same generic Firestore proxy every other config section uses — no new backend
 * endpoint. Guest-readable via getTokenOrAnonymous() so the public pricing page
 * can render the plan comparison without a sign-in.
 *
 * This config is required, not advisory: a read failure propagates so
 * AppContext can route to /app-unavailable, rather than guessing at limits and
 * silently granting or denying the wrong features.
 *
 * Stored document shape (always written whole by saveTierConfig):
 *   {
 *     label:         string,
 *     order:         number,
 *     isFree:        boolean,
 *     hidden:        boolean,     // not shown on the pricing page
 *     aiCallsPerDay: number|null, // null = unlimited
 *     features:      string[]     // allowlist of feature keys (see featuresService)
 *   }
 */

import { queryCollection, createDocument, getTokenOrAnonymous } from './firestoreService';

export const TIERS_CONFIG_COLLECTION = 'appConfig/config/tiersConfig';

/**
 * Firestore has no Infinity. `null` is the stored form of "unlimited"; the app
 * works in Infinity so existing comparisons (`=== Infinity`, `Math.max`) keep
 * behaving as they always have.
 */
export const UNLIMITED = Infinity;

function fromStored(value) {
  if (value === null || value === undefined || value === '') return UNLIMITED;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : UNLIMITED;
}

function toStored(value) {
  return value === UNLIMITED || value === null ? null : Number(value);
}

/**
 * Fetch every tier's config, keyed by tier id.
 *
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<Record<string, object>>} tier id -> tier config
 */
export async function getTiersConfig(token) {
  const authToken = token ?? (await getTokenOrAnonymous());
  const result = await queryCollection(TIERS_CONFIG_COLLECTION, {}, {}, authToken);
  const docs = result?.documents ?? [];

  return Object.fromEntries(
    docs.map((doc) => [
      doc.id,
      {
        id: doc.id,
        label: doc.label ?? doc.id,
        order: Number(doc.order) || 0,
        isFree: Boolean(doc.isFree),
        hidden: Boolean(doc.hidden),
        aiCallsPerDay: fromStored(doc.aiCallsPerDay),
        features: Array.isArray(doc.features) ? doc.features : [],
      },
    ]),
  );
}

/**
 * Create or overwrite one tier's config. Admin-only call site.
 *
 * Uses createDocument (upsert via Firestore `.set()`) rather than
 * updateDocument, so a tier added later doesn't need a separate create step.
 *
 * @param {string} tierId
 * @param {object} config - { label, order, isFree, hidden, aiCallsPerDay, features }
 * @returns {Promise<object>}
 */
export async function saveTierConfig(tierId, config) {
  const payload = {
    label: config.label ?? tierId,
    order: Number(config.order) || 0,
    isFree: Boolean(config.isFree),
    hidden: Boolean(config.hidden),
    aiCallsPerDay: toStored(config.aiCallsPerDay),
    features: config.features ?? [],
    updatedAt: new Date().toISOString(),
  };
  return createDocument(TIERS_CONFIG_COLLECTION, payload, tierId);
}
