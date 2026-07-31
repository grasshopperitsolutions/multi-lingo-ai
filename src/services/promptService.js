/**
 * promptService.js
 *
 * Reads AI prompt templates from appConfig/config/prompts and lets the Admin
 * Page edit them. Every AI-calling service in the app fetches its prompt text
 * through getPrompt()/renderTemplate() here instead of hardcoding strings —
 * the only thing that stays in each service is the *derivation* of variables
 * (grammar rules, level-based word counts, label lookups, etc.).
 *
 * Placeholder syntax inside a template is "{{variableName}}", substituted by
 * renderTemplate(). A placeholder with no matching key in `variables` is left
 * untouched — this is intentional: some translation prompts contain literal
 * "{{placeholders}}" text describing i18next-style interpolation, not a
 * variable of this templating system.
 */

import { queryCollection, updateDocument } from "./firestoreService";

export const PROMPTS_COLLECTION = "appConfig/config/prompts";

// In-memory, whole-list cache for the lifetime of the tab. getPrompt() always
// resolves the full list first and finds its match in memory — cheaper than a
// separate Firestore query per lookup, and every consumer ends up sharing one
// fetch instead of N.
let _cache = null;

/**
 * Fetch every prompt document from appConfig/config/prompts.
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function getPrompts({ forceRefresh = false } = {}) {
  if (_cache && !forceRefresh) return _cache;
  const result = await queryCollection(PROMPTS_COLLECTION, {}, {});
  _cache = result?.documents ?? [];
  return _cache;
}

/** Drop the in-memory cache so the next getPrompts() call refetches. */
export function clearPromptsCache() {
  _cache = null;
}

/**
 * Get a single prompt document by ID. Resolves the (cached) full list and
 * finds the match in memory rather than querying Firestore per-ID.
 *
 * @param {string} id
 * @returns {Promise<object>} The prompt document (has `template` or `variants`).
 */
export async function getPrompt(id) {
  const prompts = await getPrompts();
  const prompt = prompts.find((p) => p.id === id);
  if (!prompt) {
    throw new Error(`[promptService] Prompt "${id}" not found in ${PROMPTS_COLLECTION}`);
  }
  return prompt;
}

/**
 * Replace "{{key}}" placeholders in `template` with values from `variables`.
 * Keys not present in `variables` are left as-is.
 *
 * @param {string} template
 * @param {Record<string, unknown>} [variables]
 * @returns {string}
 */
export function renderTemplate(template, variables = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match
  ));
}

/**
 * Update fields on an existing prompt document, stamping version/updatedAt/updatedBy.
 * Clears the in-memory cache so subsequent getPrompt()/getPrompts() calls see the edit.
 *
 * @param {string} id - Prompt document ID.
 * @param {object} patch - Fields to update (e.g. name, description, category, status, template, variants).
 * @param {{ updatedBy: string, previousVersion?: number }} meta
 * @returns {Promise<object>}
 */
export async function updatePrompt(id, patch, { updatedBy, previousVersion = 1 }) {
  const data = {
    ...patch,
    version: previousVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  const result = await updateDocument(PROMPTS_COLLECTION, id, data);
  clearPromptsCache();
  return result;
}
