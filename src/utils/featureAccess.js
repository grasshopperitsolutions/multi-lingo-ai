/**
 * featureAccess.js
 *
 * Resolves what a given tier may do with a given feature, and what the UI
 * should say about it when the answer is "not yet".
 *
 * Kept as a pure function rather than living inside useTierAccess because the
 * pricing page has to answer the same question for tiers other than the
 * viewer's own — one implementation means the dashboard badge and the pricing
 * table can never disagree.
 */

export const FEATURE_STATUS = {
  /** Granted to this tier — usable now. */
  AVAILABLE: 'available',
  /** Built but only granted to VIP, the beta channel. Not purchasable yet. */
  INCOMING: 'incoming',
  /** Granted to nobody but admin — still in development. Not purchasable. */
  COMING_SOON: 'coming_soon',
  /** Sold on a paid plan; this tier has no subscription at all. */
  SUBSCRIBE: 'subscribe',
  /** Sold on a higher paid plan than the one this tier is on. */
  UPGRADE: 'upgrade',
};

/** Statuses that should send the user to the pricing page when clicked. */
export const PURCHASABLE_STATUSES = [FEATURE_STATUS.SUBSCRIBE, FEATURE_STATUS.UPGRADE];

/**
 * The tiers that see features marked `hidden` on their feature document.
 *
 * VIP is the beta channel and admin is unrestricted, so both keep working on a
 * feature that has been withheld from everyone else. Note this is unrelated to
 * a *tier* carrying `hidden` (which keeps VIP and Admin off the pricing table)
 * — same word, different document.
 */
const HIDDEN_FEATURE_TIERS = ['vip', 'admin'];

/**
 * Whether `tierId` is allowed to see features marked hidden.
 *
 * @param {string} tierId
 * @returns {boolean}
 */
export function canSeeHiddenFeatures(tierId) {
  return HIDDEN_FEATURE_TIERS.includes(tierId);
}

/**
 * Whether a feature should be shown to `tierId` at all.
 *
 * This is a visibility question asked *before* the status cascade below: a
 * hidden feature is not "Coming Soon" to an Explorer, it simply does not
 * exist for them — no dashboard tile, no pricing row. Answering it separately
 * is what keeps the two surfaces consistent without either of them having to
 * know why a feature is absent.
 *
 * @param {{hidden?: boolean}} feature - a registry entry from featuresService
 * @param {string} tierId
 * @returns {boolean}
 */
export function isFeatureVisible(feature, tierId) {
  if (!feature?.hidden) return true;
  return canSeeHiddenFeatures(tierId);
}

/** The publicly purchasable plans — the ones a feature can be *sold* on. */
function paidTiers(tiersConfig) {
  return Object.values(tiersConfig ?? {}).filter((t) => !t.isFree && !t.hidden);
}

function grants(tier, featureKey) {
  return Boolean(tier?.features?.includes(featureKey));
}

/**
 * Resolve one feature against one tier.
 *
 * The cascade, in precedence order:
 *   1. admin sees everything.
 *   2. The tier already grants it.
 *   3. Some *purchasable* plan grants it — so it can be bought. A tier with no
 *      subscription is told to subscribe; a paying tier to upgrade. This is
 *      checked before VIP, so a feature on both VIP and a paid plan reads as
 *      buyable rather than as unreleased.
 *   4. Only VIP grants it — released to the beta channel, not on sale yet.
 *   5. Nobody but admin grants it — still being built.
 *
 * @param {string} featureKey
 * @param {string} tierId - The tier being asked about (not necessarily the viewer's).
 * @param {Record<string, object>} tiersConfig - From AppContext.
 * @returns {string} one of FEATURE_STATUS
 */
export function getFeatureStatus(featureKey, tierId, tiersConfig) {
  if (tierId === 'admin') return FEATURE_STATUS.AVAILABLE;

  const tier = tiersConfig?.[tierId];
  if (grants(tier, featureKey)) return FEATURE_STATUS.AVAILABLE;

  if (paidTiers(tiersConfig).some((t) => grants(t, featureKey))) {
    // A free, publicly-visible plan (Explorer) has nothing to upgrade from.
    const isUnsubscribed = tier ? tier.isFree && !tier.hidden : true;
    return isUnsubscribed ? FEATURE_STATUS.SUBSCRIBE : FEATURE_STATUS.UPGRADE;
  }

  if (grants(tiersConfig?.vip, featureKey)) return FEATURE_STATUS.INCOMING;

  return FEATURE_STATUS.COMING_SOON;
}

/**
 * i18n key for the badge shown on a non-available feature.
 * Returns null when the feature is available and needs no badge.
 *
 * @param {string} status - one of FEATURE_STATUS
 * @returns {{key: string, fallback: string}|null}
 */
export function getStatusBadge(status) {
  switch (status) {
    case FEATURE_STATUS.COMING_SOON:
      return { key: 'features.coming_soon', fallback: 'Coming Soon' };
    case FEATURE_STATUS.INCOMING:
      return { key: 'features.incoming', fallback: 'Incoming' };
    case FEATURE_STATUS.SUBSCRIBE:
      return { key: 'features.subscribe', fallback: 'Subscribe' };
    case FEATURE_STATUS.UPGRADE:
      return { key: 'features.upgrade', fallback: 'Upgrade' };
    default:
      return null;
  }
}
