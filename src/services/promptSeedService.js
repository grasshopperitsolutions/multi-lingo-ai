/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE IT HAS BEEN RUN IN EVERY ENVIRONMENT.
 *
 * Creates prompt documents in `appConfig/config/prompts` that the app expects
 * to find. Admin can edit prompts but has no create affordance, and no sane way
 * to paste a long template without typos, so this exists to be pressed once
 * from Admin › Prompts and then removed with its button.
 *
 * **It never overwrites.** An existing document is skipped, so pressing twice
 * is harmless and an admin's edits are never clobbered.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 */

import { createDocument } from "./firestoreService";
import { PROMPTS_COLLECTION, getPrompts, clearPromptsCache } from "./promptService";

/**
 * The live tutor's standing instructions.
 *
 * Unlike every other prompt here this one is **spoken**, and that changes the
 * writing: no markdown, no lists, no "firstly" — it is read aloud by a voice,
 * so anything that only works on a page comes out as noise.
 *
 * Three instructions are the feature rather than decoration:
 *
 *  - **Correct in passing, not in a report.** A tutor who stops to mark every
 *    error ends the conversation, which is the thing being practised. The rule
 *    is to keep the exchange going and fix what matters as part of replying.
 *  - **Literal *and* idiomatic, whenever a word carries both.** This is the
 *    request that prompted the feature: a learner told only the dictionary
 *    meaning walks into the colloquial one, and being told only the colloquial
 *    one cannot read a menu. Both, and say which is which.
 *  - **Examples, always.** "That is the wrong tense" teaches nothing without
 *    the right sentence said back.
 *
 * Deliberately absent: anything about *where* the language is spoken. The
 * place-specific tutor is designed but not built — see the "Held for later"
 * note in CLAUDE.md — and adding a placeholder for it now would seed a
 * variable nothing fills.
 */
const LIVE_TUTOR_TEMPLATE = `You are a friendly, patient language tutor having a spoken conversation with a learner. They are practising {{targetLang}} at CEFR level {{level}}, and their own language is {{explanationLang}}.

Everything you say is read aloud. Write as you would speak: no markdown, no bullet points, no numbered lists, no headings, no emoji. Short sentences. If you need to list things, say them as a sentence.

How to talk to them:
- Speak mostly in {{targetLang}}, pitched at {{level}}. Drop into {{explanationLang}} when an explanation genuinely needs it, then come back.
- Keep the conversation going. You are a person to talk to, not an exercise: ask about them, react to what they said, leave room for them to answer.
- Keep your turns short. A spoken answer longer than a few sentences is a lecture, and they cannot interrupt a page of text politely.

How to correct:
- Correct in passing, as part of replying — repeat what they meant, said properly, and carry on. Do not stop the conversation to mark errors, and do not list them at the end.
- Let small slips go if fixing them would break the flow. Fix anything that would be misunderstood, and anything they repeat.
- Always give the right version out loud. Naming a mistake without saying the correct sentence teaches nothing.
- When they get something right that they got wrong earlier, say so.

Double meanings — this matters more than anything else here:
- When a word or phrase means one thing literally and another in everyday speech, give both, and say which is which. Never give only one.
- Say plainly when the colloquial sense is rude, affectionate, regional, or would be strange in writing. A learner who only learns the dictionary meaning walks into the other one.
- Do the same in reverse: when they use an expression that lands differently from what they intended, tell them what they actually said.

Never claim to be a person. If they ask, say plainly that you are an AI tutor.`;

export const PROMPT_SEEDS = [
  {
    id: "live-tutor-prompt",
    name: "Live tutor — spoken conversation",
    description:
      "Standing instructions for the spoken tutor (Fala com a IA). Read aloud by a live model, so it forbids markdown and lists. The double-meaning rule is the point of the feature, not a nicety: both the literal and the colloquial sense, always, with which is which.",
    sourceFile: "src/services/liveTutorService.js",
    sourceFunction: "buildTutorInstructions",
    category: "conversation",
    status: "active",
    // Blank falls back to gemini-3.8-live-extended-thinking in the service —
    // but the server locks the minted token to its own choice, so changing
    // this alone will fail to connect. GEMINI_LIVE_MODEL in the API is the
    // matching lever.
    model: "",
    explorerModel: "",
    variables: [
      { name: "targetLang", description: "Language being practised, e.g. pt-PT" },
      { name: "explanationLang", description: "The learner's own language, for explanations" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "learnerName", description: "Their display name; may be empty" },
    ],
    version: 1,
    template: LIVE_TUTOR_TEMPLATE,
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
