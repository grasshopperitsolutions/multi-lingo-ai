/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE THE PROMPT EXISTS IN EVERY ENVIRONMENT.
 *
 * The photo capture needs one prompt document in `appConfig/config/prompts`.
 * The Admin panel can edit prompts but has no create affordance, so this
 * exists to create it once, from the Admin page, and then be removed along
 * with the button that calls it.
 *
 * It is not a permissions workaround: that collection is already
 * `{read: 'public', write: 'admin'}` and an admin POST already works. The only
 * thing missing is a button.
 *
 * It never overwrites. A document that already exists is skipped, so running
 * it twice is harmless and an admin's edits to the template are never
 * clobbered by a second press.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 */

import { createDocument } from "./firestoreService";
import { PROMPTS_COLLECTION, getPrompts, clearPromptsCache } from "./promptService";

export const PHOTO_PROMPT_SEEDS = [
  {
    id: "photo-notes-extract-prompt",
    name: "Personal — read a photo of my notes",
    description:
      "Reads a photo of the student's own notes or homework and proposes what to file into the personal dashboard: a note, questions for the tutor, mistakes, phrases and words. Output is reviewed and edited by the student before anything is saved.",
    sourceFile: "src/services/photoCaptureService.js",
    sourceFunction: "analysePhoto",
    category: "personal",
    status: "active",
    model: "",
    version: 1,
    maxTokens: 4096,
    variables: ["learningLang", "interfaceLang"],
    template: `You are looking at a photograph taken by someone who is practising {{learningLang}}. The photograph shows their own material: a page of their notebook, an exercise they did, homework a teacher corrected, or notes they took in a lesson.

Your job is to read what is on the page and sort it into the places this person keeps their material. Everything you return is shown to them for review and editing before anything is saved, so it is better to propose something imperfect and specific than to propose nothing.

Write your own words — the summary, the note, the questions, the explanations — in {{interfaceLang}}. Keep the material itself in the language it was written in.

Return these, and nothing else:

summary
One sentence saying what this page appears to be. This is the first thing the person reads, so it should let them confirm you looked at the right photograph.

note
The content of the page, rewritten as a clean, readable note they would want to keep. Preserve the structure that is there — headings, groups, numbered items — as plain lines. This is the whole page's content, not a description of it. If the page is only a vocabulary list with nothing worth keeping as prose, leave this empty rather than restating the list you are about to return as words.

questions
Things this person should ask their teacher, drawn from what is actually on the page: a rule that is written down incompletely, an exception that is noted but not explained, a correction whose reason is not given, two forms used inconsistently. Each one must be answerable by a teacher looking at this page. Do not invent generic study questions. Return an empty list if the page raises none.

mistakes
Errors **this person made**, which means one of these is visible on the page: something crossed out and rewritten, a teacher's correction, a mark against an answer, or an answer that is plainly wrong in an exercise they filled in.
- said: what they originally wrote, exactly as written
- correction: the correct form
- why: a short explanation of the rule behind it, if the page shows enough for you to be sure
This is the section most easily invented. If the page is clean notes with no visible errors or corrections, return an empty list. Never list something as a mistake because you would have phrased it differently.

phrases
Whole expressions worth keeping: idioms, set phrases, useful sentences, collocations. Not single words.
- phrase: the expression in {{learningLang}}
- translation: what it means, in {{interfaceLang}}
- note: when or with whom it is used, if that is not obvious

words
Individual words worth collecting, as plain strings in {{learningLang}}, in the form a dictionary would list them. Choose the ones that carry the page: the vocabulary being studied, not every word that appears on it.

Rules that apply throughout:

- Read only what is on the page. Do not add vocabulary, examples or corrections that are not there because they would fit the topic.
- Where the handwriting is genuinely unreadable, leave that item out. A wrong guess costs this person more than a missing one, because they will file it and study it.
- Prefer fewer, better items in every list. A page yielding six well-chosen words is more useful than one yielding thirty.
- If the same thing belongs in two places, put it in the more specific one: an expression goes in phrases rather than words, a corrected error goes in mistakes rather than notes.
- If the photograph is not of language-practice material at all, return the summary saying so and leave every list empty.`,
  },
];

/**
 * Creates any seed document that does not already exist.
 *
 * @param {string} token - admin ID token
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
export async function seedPhotoPrompts(token) {
  const existing = await getPrompts({ forceRefresh: true });
  const existingIds = new Set(existing.map((prompt) => prompt.id));

  const created = [];
  const skipped = [];

  for (const seed of PHOTO_PROMPT_SEEDS) {
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
