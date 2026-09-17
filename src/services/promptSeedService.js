/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE THE PROMPT EXISTS IN EVERY ENVIRONMENT.
 *
 * Creates prompt documents in `appConfig/config/prompts` that the app expects
 * to find. The Admin panel can edit prompts but has no create affordance, so
 * this exists to create them once, from the Admin page, and then be removed
 * along with the button that calls it.
 *
 * It is not a permissions workaround: that collection is already
 * `{read: 'public', write: 'admin'}` and an admin POST already works. The only
 * thing missing is a button.
 *
 * It never overwrites. A document that already exists is skipped, so running
 * it twice is harmless and an admin's edits to a template are never clobbered
 * by a second press — which is also why the photo-capture seed could simply be
 * removed from this list once it had been run, rather than needing any state.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 */

import { createDocument } from "./firestoreService";
import { PROMPTS_COLLECTION, getPrompts, clearPromptsCache } from "./promptService";

export const PROMPT_SEEDS = [
  {
    id: "tutor-link-validate-prompt",
    name: "Tutors — validate a profile link",
    description:
      "Decides whether a link a tutor wants to show on their public profile is acceptable. Only runs for hosts config/tutorPlatforms.js does not already recognise, and only when the tutor presses Validate.",
    sourceFile: "src/services/tutorUrlValidation.js",
    sourceFunction: "validateUrlWithAi",
    category: "tutors",
    status: "active",
    // Blank on purpose: the service falls back to the provider default, and
    // an admin can pin a model here — or a cheaper one for Explorer via
    // explorerModel — without touching the code.
    model: "",
    explorerModel: "",
    maxTokens: 512,
    variables: ["url"],
    version: 1,
    // The wording this shipped with, moved verbatim so seeding changes
    // nothing. It is deliberately not built from locale strings: this is a
    // machine-to-machine instruction rather than user-facing copy, and
    // translating it would change the model's behaviour per language.
    template: `You are validating a link a language tutor wants to show on their public profile.

URL: {{url}}

Decide whether this looks like a legitimate destination for a tutor to share:
a personal or professional website, a social or video profile, a booking or
scheduling page, a language-learning marketplace, a map location, or a payment
or newsletter page. Tutors may link to any platform.

Reject only if the URL looks like malware, adult content, a phishing or
credential-harvesting page, or is plainly unrelated to teaching or contacting
a person.

Reply with JSON only, no markdown fence: {"ok": true|false, "platform": "<short name or empty>", "reason": "<one short sentence>"}`,
  },
];

/**
 * Creates any seed document that does not already exist.
 *
 * @param {string} token - admin ID token
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
export async function seedPrompts(token) {
  const existing = await getPrompts({ forceRefresh: true });
  const existingIds = new Set(existing.map((prompt) => prompt.id));

  const created = [];
  const skipped = [];

  for (const seed of PROMPT_SEEDS) {
    if (existingIds.has(seed.id)) {
      skipped.push(seed.id);
      continue;
    }
    const { id, ...data } = seed;
    await createDocument(PROMPTS_COLLECTION, data, id, token);
    created.push(id);
  }

  if (created.length > 0) clearPromptsCache();
  return { created, skipped };
}
