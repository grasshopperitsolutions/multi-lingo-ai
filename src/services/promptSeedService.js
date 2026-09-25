/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE IT HAS BEEN RUN IN EVERY ENVIRONMENT.
 *
 * Creates `exam-adapt-prompt` in `appConfig/config/prompts`, used by
 * examExerciseService to port an exam exercise to a sibling dialect. Admin can
 * edit prompts but has no create affordance, so this exists to be pressed
 * once from Admin › Prompts and then removed with its button.
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

const EXAM_ADAPT_TEMPLATE = `Adapt an exam exercise written in {{sourceDialect}} for learners of {{targetDialect}}.

Exercise type: {{type}}
Exercise (JSON):
{{exerciseJson}}

First decide whether it can be adapted. If what the exercise tests is itself one of the differences between {{sourceDialect}} and {{targetDialect}}, so the adapted answers would teach something else, it cannot: return {"portable": false, "reason": "..."}.

Otherwise rewrite it as a native speaker of {{targetDialect}} would write it:
- Keep the same JSON keys and structure, the same ids, the same number of items in every list, in the same order.
- Change vocabulary, spelling, forms of address, verb forms and everyday references to those of {{targetDialect}}.
- Keep every true/false value, number and position exactly as it is, and keep every answer pointing at the same meaning. When an answer quotes the text, quote the adapted text.
- Every "correctAnswer" that must match one of the "options", or a word in the "wordBank", still matches it exactly.
- Keep the level, the length and the tone.
- Leave empty strings empty.

Return JSON only: {"portable": true, "exercise": { ...the adapted exercise... }} or {"portable": false, "reason": "..."}.`;

export const PROMPT_SEEDS = [
  {
    id: "exam-adapt-prompt",
    name: "Exam — Adapt to another dialect",
    description:
      "Ports a pooled exam exercise (reading, listening or writing) to a sibling dialect of the same language, or reports that it cannot be ported. The code rejects any answer that changes the exercise's keys, ids, list lengths, true/false values or numbers, or leaves a correctAnswer outside its options.",
    category: "exam",
    status: "active",
    sourceFile: "src/services/examExerciseService.js",
    sourceFunction: "_adaptExercise",
    model: "gemini-3.5-flash-lite",
    explorerModel: "",
    maxTokens: 6144,
    version: 1,
    variables: [
      { name: "sourceDialect", description: "Dialect the exercise was written in, e.g. pt-PT" },
      { name: "targetDialect", description: "Dialect to adapt it to, e.g. pt-BR" },
      { name: "type", description: "reading | listening | writing" },
      { name: "exerciseJson", description: "The exercise content as JSON" },
    ],
    template: EXAM_ADAPT_TEMPLATE,
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
