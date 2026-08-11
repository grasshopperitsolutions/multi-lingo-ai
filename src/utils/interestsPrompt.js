/**
 * interestsPrompt.js
 *
 * Turns a user's saved interests into text an AI prompt can use.
 *
 * `user.interests` holds category *slugs* (the document IDs of
 * appConfig/config/categories — see categoriesService.js), e.g. ["food",
 * "football"]. Those slugs are internal identifiers, so they are resolved to
 * the human-readable `label` before being handed to a model: a prompt reading
 * "themed around food, football" produces better output than one reading
 * "themed around food, football" only by accident of the slug being a word.
 *
 * Both helpers return "" when there is nothing to say. Callers pass the result
 * straight into renderTemplate() — an empty string leaves the prompt reading
 * exactly as it did before interests existed, so a user with no interests set
 * gets today's behaviour rather than a dangling "themed around: ".
 */

/**
 * Resolve interest slugs to their category labels.
 *
 * @param {string[]} [interests] - Category slugs from `user.interests`.
 * @param {Array<{id: string, label?: string}>} [categories] - Categories from AppContext.
 * @returns {string[]} Labels, in the order the interests were given.
 */
function resolveLabels(interests, categories) {
  if (!Array.isArray(interests) || interests.length === 0) return [];

  const labelBySlug = new Map(
    (Array.isArray(categories) ? categories : []).map((c) => [c.id, c.label])
  );

  return interests
    // Fall back to the slug itself when a category has been deleted from
    // appConfig but is still referenced by a profile — a stale slug is a
    // usable prompt hint, and dropping it silently would be worse.
    .map((slug) => labelBySlug.get(slug) || slug)
    .map((label) => String(label).trim())
    .filter(Boolean);
}

/**
 * Build a comma-separated list of the user's interests for a {{interests}}
 * placeholder.
 *
 * @param {string[]} [interests]
 * @param {Array<{id: string, label?: string}>} [categories]
 * @returns {string} e.g. "Food, Football, Travel", or "" when there are none.
 */
export function buildInterestsLine(interests, categories) {
  return resolveLabels(interests, categories).join(", ");
}

/**
 * Pick a single interest, for prompts that theme one piece of content around
 * one subject rather than listing them all — notably the `{{topicLine}}` slot
 * that getReadingPrompt()/getWritingPrompt() already render.
 *
 * Random rather than first, so a user with several interests doesn't get every
 * exercise about the same one.
 *
 * @param {string[]} [interests]
 * @param {Array<{id: string, label?: string}>} [categories]
 * @returns {string} One label, or "" when there are none.
 */
export function pickInterestTopic(interests, categories) {
  const labels = resolveLabels(interests, categories);
  if (labels.length === 0) return "";
  return labels[Math.floor(Math.random() * labels.length)];
}
