/**
 * promptSeeds.js
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY — remove once these prompts are in Firestore.               │
 * │ Delete this file together with PromptSeedSection.jsx and its handler  │
 * │ in src/pages/AdminPage.jsx.                                           │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * New prompt documents for appConfig/config/prompts. That collection is
 * admin-write only and the admin panel intentionally only *edits* prompts, so
 * new ones arrive through a throwaway seeder like this one and are fine-tuned
 * in the editor afterwards.
 *
 * Shape matches the existing documents — PromptsSection searches `name`, `id`,
 * `category`, `status`, `description`, `sourceFile` and `sourceFunction`.
 */

export const PROMPT_SEEDS = [
  {
    id: 'history-culture-generate-prompt',
    name: 'History & Culture — generate fact',
    description:
      'Writes a short history/culture piece about the country behind the language being learned. Written in the reader\'s interface language, not the target language.',
    category: 'history-culture',
    status: 'active',
    model: 'gemini-3.5-flash-lite',
    maxTokens: 2048,
    sourceFile: 'src/services/historyCultureService.js',
    sourceFunction: '_generateFact',
    // The response shape is enforced by responseSchema on the API call, so this
    // template carries no JSON envelope instructions — only the things a schema
    // can't express: subject, tone, factual standards and which language to
    // write in. "No markdown" stays because it constrains the prose *inside*
    // each string, which the schema doesn't govern.
    template: `Write a short, genuinely interesting piece about the history or culture of the country where {{targetLang}} is spoken.

Write it in {{explanationLang}}, title included. The reader is a language learner, but this is about the culture, not a language lesson.

Subject to cover: {{subject}}
If that is empty, pick something specific and worth knowing — a tradition, a historical turning point, a regional custom, a food, a festival, an art form. Prefer the concrete and surprising over the general.

Already in the collection — write about something clearly different:
{{avoidTitles}}

Rules:
- Aim for {{paragraphCount}} paragraphs of 2-4 sentences each, with no blank lines inside a paragraph.
- Be specific and factual. Names, dates and places where they help. No invented facts — if you are unsure of a detail, leave it out rather than guessing.
- Write about the country where {{targetLang}} is actually spoken. Do not drift to a different country that shares the language.
- Plain prose for a curious adult. No headings, no numbering, no markdown, no "Did you know".
- Keep any {{targetLang}} terms you mention in {{targetLang}}, with a short gloss in {{explanationLang}} the first time.`,
  },
  {
    id: 'history-culture-translate-prompt',
    name: 'History & Culture — translate fact',
    description:
      'Translates a cached history/culture piece into another interface language, preserving paragraph alignment.',
    category: 'history-culture',
    status: 'active',
    model: 'gemini-3.5-flash-lite',
    maxTokens: 2048,
    sourceFile: 'src/services/historyCultureService.js',
    sourceFunction: '_translateFact',
    // Shape enforced by responseSchema — including the exact paragraph count,
    // via minItems/maxItems. What stays here is the alignment *semantics*: the
    // schema can guarantee N paragraphs come back, but not that paragraph N is
    // a translation of paragraph N, which is what the side-by-side reader needs.
    template: `Translate this history and culture piece from {{sourceLang}} into {{targetLocale}}.

Title: {{title}}

Paragraphs (JSON array):
{{paragraphsJson}}

Rules:
- Return the {{paragraphCount}} paragraphs in the same order. Paragraph N of your output must be the translation of paragraph N of the input — merging or splitting paragraphs breaks the side-by-side reader.
- Translate meaning, not words. The result must read like natural {{targetLocale}}, not a gloss.
- Keep names, dates, places and cultural terms as they are unless {{targetLocale}} has a genuinely standard form.
- Do not add, remove or "improve" any facts.
- Translate the title too.`,
  },
];

export default PROMPT_SEEDS;
