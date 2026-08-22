/**
 * featuresService.js
 *
 * Reads/writes the registry of gateable features, backing the Features section
 * on the Admin page, the checkboxes in the tier editor, and the plan comparison
 * on the pricing page.
 *
 * Backed by Firestore appConfig/config/features/{featureKey} docs, the same
 * shape as languages and categories. Guest-readable via getTokenOrAnonymous()
 * so the public pricing page can render without a sign-in.
 *
 * The document **id is the feature key** and is structural: components ask for
 * it by string literal (`canAccess("full_exam")`, dashboard tile ids), so it
 * can be created but never renamed. `label` and `order` are presentational and
 * editable from the Admin page.
 *
 * Stored document shape:
 *   {
 *     label:    string,  // admin-facing name, and the fallback shown if
 *                        // labelKey has no translation
 *     labelKey: string,  // i18n key for the user-facing name, e.g.
 *                        // "dashboard.translator" — reuses wording the app
 *                        // already has translated
 *     order:    number,  // sort order in the admin list and pricing rows
 *     hidden:   boolean  // keep the feature out of the dashboard and pricing
 *                        // for tiers below VIP — see
 *                        // utils/featureAccess.isFeatureVisible
 *   }
 *
 * `hidden` is a launch switch, not a tier grant. A feature still under test is
 * marked hidden so it vanishes from the dashboard and the pricing table for
 * everyone below VIP, while VIP and admin keep using it. That is deliberately
 * stronger than leaving it granted-to-nobody: that state still advertises the
 * feature as "Coming Soon", which is the wrong answer when the goal is to ship
 * with a smaller surface than the code actually contains.
 */

import { queryCollection, createDocument, getTokenOrAnonymous } from './firestoreService';

export const FEATURES_COLLECTION = 'appConfig/config/features';

/**
 * Fetch the feature registry, sorted by `order`.
 *
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<Array<{id: string, label: string, labelKey: string, order: number, hidden: boolean}>>}
 */
export async function getFeatures(token) {
  const authToken = token ?? (await getTokenOrAnonymous());
  const result = await queryCollection(FEATURES_COLLECTION, {}, {}, authToken);

  return (result?.documents ?? [])
    .map((doc) => ({
      id: doc.id,
      label: doc.label ?? doc.id,
      labelKey: doc.labelKey ?? '',
      order: Number(doc.order) || 0,
      // Absent means visible: every feature that predates this field keeps
      // showing, so adding it changed nothing until an admin ticks a box.
      hidden: doc.hidden === true,
    }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/**
 * Create or overwrite one feature. Admin-only call site.
 *
 * @param {string} featureKey - Document id; structural, so never rename an
 *   existing one — components reference it by literal.
 * @param {{label: string, labelKey?: string, order?: number, hidden?: boolean}} data
 * @returns {Promise<object>}
 */
export async function saveFeature(featureKey, data) {
  return createDocument(
    FEATURES_COLLECTION,
    {
      label: data.label ?? featureKey,
      labelKey: data.labelKey ?? '',
      order: Number(data.order) || 0,
      hidden: data.hidden === true,
      updatedAt: new Date().toISOString(),
    },
    featureKey,
  );
}
