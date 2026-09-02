/**
 * adminConfigService.js
 *
 * Read-only access to the appConfig/config/* subcollections for the Admin Page.
 * Reuses the generic Firestore proxy wrapper — no admin-specific backend needed.
 */

import { queryCollection } from "./firestoreService";

// ---------------------------------------------------------------------------
// Sections shown on the Admin Page, in display order.
// Add a new entry here whenever a new appConfig/config/* subcollection is
// introduced (e.g. "prompts" once AI prompts move out of source code).
// ---------------------------------------------------------------------------
export const CONFIG_SECTIONS = [
  { id: "locales", label: "Locales", collection: "appConfig/config/locales" },
  { id: "languages", label: "Supported Languages", collection: "appConfig/config/languages" },
  { id: "writingSystems", label: "Writing Systems", collection: "appConfig/config/writingSystems" },
  { id: "prompts", label: "Prompts", collection: "appConfig/config/prompts" },
  { id: "categories", label: "Interest Categories", collection: "appConfig/config/categories" },
  { id: "authProviders", label: "Login Providers", collection: "appConfig/config/authProviders" },
  { id: "features", label: "Features", collection: "appConfig/config/features" },
  { id: "tiers", label: "Tiers & Limits", collection: "appConfig/config/tiersConfig" },
  { id: "users", label: "Users", collection: "Firebase Auth + users/*" },
  // Not a collection — a composer that posts to /api/email. It reuses the
  // users list so an admin can target one person by name.
  { id: "reports", label: "Reports", collection: "appConfig/config/reports" },
  { id: "notifications", label: "Notifications", collection: "POST /api/email" },
];

/**
 * Fetch every document in an appConfig/config/* subcollection.
 * Requires a real signed-in user (no anonymous fallback) — admin-only page.
 *
 * Document shape mirrors whatever the proxy's queryCollection returns
 * elsewhere in the app (see getLanguages()/getWritingSystems() in
 * supportedLanguagesService.js) — flat objects with an "id" field, not
 * wrapped in a separate "data" key.
 *
 * @param {string} collectionPath - e.g. "appConfig/config/languages".
 * @returns {Promise<Array<object>>}
 */
export async function getConfigSectionDocs(collectionPath) {
  const result = await queryCollection(collectionPath, {}, {});
  return result?.documents ?? [];
}
