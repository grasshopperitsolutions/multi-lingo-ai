/**
 * tiersConfigService.js
 *
 * Reads/writes per-tier limits and feature access, backing the Tiers section on
 * the Admin page and the gating in useTierAccess.
 *
 * Backed by Firestore appConfig/config/tiersConfig/{tierId} docs, through the
 * same generic Firestore proxy every other config section uses — no new backend
 * endpoint. Falls back to TIER_LIMITS in src/config/tierLimits.js whenever a
 * tier has no document yet, so the app works before the subcollection is seeded.
 *
 * Stored document shape:
 *   {
 *     label:         string,
 *     order:         number,
 *     isFree:        boolean,
 *     hidden:        boolean,     // not shown on the pricing page
 *     aiCallsPerDay: number|null, // null = unlimited
 *     features:      string[]     // allowlist of keys from config/features.js
 *   }
 */

import { queryCollection, createDocument } from './firestoreService';
import { TIER_LIMITS, TIER_IDS } from '../config/tierLimits';
import { FEATURE_KEYS } from '../config/features';

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
  return value === UNLIMITED || value === Infinity || value === null ? null : Number(value);
}

/**
 * Normalise one raw Firestore doc into the in-app tier shape, filling any
 * missing field from the code defaults for that tier.
 */
function normalizeTier(tierId, doc) {
  const fallback = TIER_LIMITS[tierId] ?? TIER_LIMITS.explorer;
  if (!doc) return { id: tierId, ...fallback };

  return {
    id: tierId,
    label: doc.label ?? fallback.label,
    order: typeof doc.order === 'number' ? doc.order : fallback.order,
    isFree: typeof doc.isFree === 'boolean' ? doc.isFree : fallback.isFree,
    hidden: typeof doc.hidden === 'boolean' ? doc.hidden : fallback.hidden,
    aiCallsPerDay: 'aiCallsPerDay' in doc ? fromStored(doc.aiCallsPerDay) : fallback.aiCallsPerDay,
    // Unknown keys are dropped rather than trusted — a feature removed from the
    // registry shouldn't linger as a grant in a stored document.
    features: Array.isArray(doc.features)
      ? doc.features.filter((k) => FEATURE_KEYS.includes(k))
      : fallback.features,
  };
}

/**
 * Fetch every tier's config, merged over the code defaults.
 *
 * Never throws — a failure here would lock every user out of every feature, so
 * it logs and returns the defaults instead.
 *
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<Record<string, object>>} tier id -> tier config
 */
export async function getTiersConfig(token) {
  const defaults = Object.fromEntries(
    TIER_IDS.map((id) => [id, { id, ...TIER_LIMITS[id] }]),
  );

  try {
    const result = await queryCollection(TIERS_CONFIG_COLLECTION, {}, {}, token);
    const docs = result?.documents ?? [];
    if (docs.length === 0) return defaults;

    const merged = { ...defaults };
    for (const doc of docs) {
      if (!doc?.id) continue;
      merged[doc.id] = normalizeTier(doc.id, doc);
    }
    return merged;
  } catch (err) {
    console.error('[tiersConfigService] getTiersConfig failed, using defaults:', err.message);
    return defaults;
  }
}

/**
 * Create or overwrite one tier's config. Admin-only call site.
 *
 * Uses createDocument (upsert via Firestore `.set()`) rather than
 * updateDocument, since the document may not exist yet on first save.
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
    features: (config.features ?? []).filter((k) => FEATURE_KEYS.includes(k)),
    updatedAt: new Date().toISOString(),
  };
  return createDocument(TIERS_CONFIG_COLLECTION, payload, tierId);
}

/**
 * Write the code defaults into Firestore for any tier that has no document.
 * Gives the Admin page a one-click way to populate an empty subcollection.
 *
 * @returns {Promise<string[]>} ids of the tiers that were written
 */
export async function seedMissingTiers() {
  const result = await queryCollection(TIERS_CONFIG_COLLECTION, {}, {});
  const existing = new Set((result?.documents ?? []).map((d) => d.id));
  const missing = TIER_IDS.filter((id) => !existing.has(id));

  for (const id of missing) {
    await saveTierConfig(id, TIER_LIMITS[id]);
  }
  return missing;
}
