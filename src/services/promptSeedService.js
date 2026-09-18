/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE IT HAS BEEN RUN IN EVERY ENVIRONMENT.
 *
 * Writes prompt documents in `appConfig/config/prompts` that the app expects to
 * find. The Admin panel can edit prompts but has no create affordance, and no
 * way to paste a forty-line template without typos, so this exists to be run
 * once from the Admin page and then removed along with the button that calls it.
 *
 * It is not a permissions workaround: that collection is already
 * `{read: 'public', write: 'admin'}` and an admin POST already works. The only
 * thing missing is a button.
 *
 * **Two different operations, and the second one is destructive.**
 *
 *   PROMPT_SEEDS            — create only. An id that already exists is
 *                             skipped, so a second press never clobbers an
 *                             admin's edits and running it twice is harmless.
 *   PROMPT_TEMPLATE_UPDATES — overwrite. This is the only way to change a
 *                             template that already exists, and it does exactly
 *                             what that means: any edit made in Admin to the
 *                             named prompt is replaced. It is here because the
 *                             code now passes a variable the stored template
 *                             has no placeholder for, so the two have to move
 *                             together. A template that already matches is left
 *                             alone, so this is also safe to press twice.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 */

import { createDocument } from "./firestoreService";
import {
  PROMPTS_COLLECTION,
  getPrompts,
  clearPromptsCache,
  updatePrompt,
} from "./promptService";

/**
 * Practice Text.
 *
 * Deliberately the opposite instruction to the Tale Creator's, which is the
 * argument for it being its own prompt rather than a variant: that one says
 * "natural writing, not a grammar exercise in disguise — do not stuff it with
 * one tense to make a point", and this one asks for exactly that stuffing. One
 * template cannot hold both without one of them being a lie.
 *
 * `{{focus}}` is free text the learner typed, so the template has to cope with
 * a tense ("pretérito imperfeito"), a category ("verbs of movement"), a vague
 * ask ("past tenses") or a list of words. That is why it is told to interpret
 * it rather than obey it literally, and to say what it understood in
 * `focusNote` — so a misread is visible to the reader instead of silent.
 */
const GRAMMAR_TEXT_TEMPLATE = `Write a short practice text in {{targetLang}} for a learner at CEFR level {{level}}.

What the learner asked to practise, in their own words: {{focus}}

Work out what they mean and build the text around it. They may name a tense, a kind of word, a construction, a topic of vocabulary, or something vague. If it is ambiguous, choose the reading a language teacher would and say which you chose in "focusNote". If it names something that is not a feature of {{targetLang}}, write about the nearest thing that is and say so there too.

Words the reader is practising and asked to meet again: {{requiredWords}}
If that line reads "(none)", ignore it completely.

Language constraints for {{level}}:
{{grammarDescription}}

Rules:
- Exactly {{paragraphCount}} paragraphs, each 2-5 sentences. Each paragraph is one entry in the array, with no blank lines inside it.
- Write in {{targetLang}} as actually spoken. Do not drift into a related dialect: keep the vocabulary, spelling and verb forms consistent with {{targetLang}} throughout.
- **This one is meant to be a drill.** Use what they asked to practise heavily and repeatedly — far more often than ordinary writing would. That is the whole point of the text.
- It must still read as connected prose about something, not as a list of example sentences. A thin thread of a situation is enough; it does not need a plot.
- Stay inside the {{level}} constraints for everything *except* the focus. The focus may sit above their level — that is why they asked for it — but nothing else should add difficulty on top of it.
- Every word listed above must appear at least once, in whatever form the sentence needs.
- No headings, no numbering, no markdown, and never mark the focus in the prose itself with asterisks, capitals or brackets. Finding it is the exercise.
- "focusNote" is one or two sentences in {{explanationLang}}, telling the reader what to look for before they read. Name the thing in {{targetLang}} but explain it in {{explanationLang}}.
- "highlights" lists up to {{maxHighlights}} short extracts from the text you just wrote — the actual words or phrases that demonstrate the focus, copied character-for-character from the paragraphs above. Not explanations, not invented examples. Leave it empty rather than listing anything that is not in the text.`;

/** New documents. Never overwrites — see the file header. */
export const PROMPT_SEEDS = [
  {
    id: "grammar-text-generate-prompt",
    name: "Grammar — Practice Text",
    description:
      "Writes a short passage built around whatever the learner typed they want to practise — a tense, a construction, some vocabulary — plus any words from their bank. Not pooled: every request generates.",
    sourceFile: "src/services/grammarTextService.js",
    sourceFunction: "generatePracticeText",
    category: "grammar",
    status: "active",
    // Blank on purpose: the service falls back to its own constant, and an
    // admin can pin a model here — or a cheaper one for the free tier via
    // explorerModel — without touching the code.
    model: "",
    explorerModel: "",
    maxTokens: 2048,
    variables: [
      { name: "targetLang", description: "Language the passage is written in, e.g. pt-PT" },
      { name: "explanationLang", description: "Language the focus note is written in — the reader's interface language" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "focus", description: "What the learner typed they want to practise. Free text." },
      { name: "requiredWords", description: "Words from the reader's bank that must appear; '(none)' when there are none" },
      { name: "grammarDescription", description: "Level-appropriate grammar and tense guidance" },
      { name: "paragraphCount", description: "How many paragraphs to write" },
      { name: "maxHighlights", description: "Cap on the extracts listed back to the reader" },
    ],
    version: 1,
    template: GRAMMAR_TEXT_TEMPLATE,
  },
];

/**
 * The Tale Creator's template, rewritten for `{{theme}}`.
 *
 * `{{theme}}` arrives as an instruction, not as the picker's id — see
 * `config/storyThemes.js`. Blank is impossible: an untouched picker sends
 * "(any)", so the template always has something to read.
 *
 * Four things here are deliberate and would be easy to "tidy" away:
 *
 *  - **Theme and subject are separate questions.** The theme is the world; the
 *    interests (or a written description) are what happens in it. Collapsing
 *    them means a reader who likes football and picked Fantasy gets a match
 *    report or a dragon, never a dragon that plays football.
 *  - **The title rule earns its place.** The title is the one line shown
 *    translated before anyone reads a word, so it is what decides whether the
 *    tale gets read at all.
 *  - **Repetition is prescribed at A1/A2 and not above.** Meeting a word three
 *    times is what makes it stick at the bottom of the scale and what makes
 *    prose tiresome at the top.
 *  - **Dialogue punctuation is named.** Left unsaid, the model reaches for
 *    English quotation marks in a language that prints a travessão, and the
 *    learner reads a page of punctuation their own books do not use.
 */
const STORY_GENERATE_TEMPLATE = `Write an original short tale in {{targetLang}} for a learner at CEFR level {{level}}.

The world it is set in: {{theme}}
That decides the setting, the characters and the mood — not the plot. If it reads "(any)", choose whatever suits the subject below.

Subject to work in where it fits naturally: {{interests}}
If that is empty, choose something ordinary — food, travel, family, work, weather. The world above still applies either way: the subject happens inside it, it does not replace it.

Words the reader is practising and asked to meet again: {{requiredWords}}
If that line reads "(none)", ignore it completely.

Language constraints for {{level}}:
{{grammarDescription}}

Already in the collection — write something clearly different:
{{avoidTitles}}

Rules:
- Exactly {{paragraphCount}} paragraphs, each 2-5 sentences. Each paragraph is one entry in the array, with no blank lines inside it.
- Write in {{targetLang}} as actually spoken. Do not drift into a related dialect: keep the vocabulary, spelling and verb forms consistent with {{targetLang}} throughout.
- Names of people and places belong to where {{targetLang}} is spoken, unless the world above puts the tale somewhere else entirely.
- It must be a real tale — someone wants something and something happens. Not a description, not a list of facts.
- The first paragraph establishes who and where. The last one ends it: something is resolved, decided or changed. Never stop mid-scene.
- Stay inside the {{level}} constraints. If a word above that level is unavoidable, work its meaning into the surrounding sentence.
- At A1 and A2, reuse the same core words and structures on purpose — meeting a word three times is what makes it stick. From B1 upwards, vary them instead.
- Dialogue is welcome. Punctuate it the way {{targetLang}} does in print, not the way English does.
- Natural writing, not a grammar exercise in disguise. Do not stuff it with one tense to make a point.
- Every word listed above must appear at least once, in whatever form the sentence needs (conjugated, plural, capitalised). Build the tale so they belong in it — do not line them up in one sentence, and do not bend the plot to fit them.
- The title is concrete and belongs to this tale: a detail out of it, never "The Great Adventure". Six words at most. It is shown translated before anyone reads a line, so it has to be worth opening.
- No headings, no numbering, no markdown. Plain prose.`;

/** Existing documents whose template is replaced. Destructive — see the header. */
export const PROMPT_TEMPLATE_UPDATES = [
  {
    id: "story-generate-prompt",
    name: "Tale Creator — Generate",
    description:
      "Generates a short level-appropriate tale in the learning language, in the world the reader picked and themed on their interests. Read-and-listen only: no comprehension questions.",
    template: STORY_GENERATE_TEMPLATE,
    variables: [
      { name: "targetLang", description: "Language the tale is written in, e.g. pt-PT" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "theme", description: "The world to set it in, as an instruction; '(any)' when the reader did not choose" },
      { name: "interests", description: "Comma-separated user interests to theme the tale; may be empty" },
      { name: "requiredWords", description: "Words from the reader's word bank that must appear; '(none)' when there are none" },
      { name: "paragraphCount", description: "How many paragraphs to write" },
      { name: "grammarDescription", description: "Level-appropriate grammar and tense guidance" },
      { name: "avoidTitles", description: "Comma-separated titles already in the pool — write something different" },
    ],
  },
];

/**
 * Creates any seed document that does not already exist, then applies the
 * template overwrites.
 *
 * @param {string} token - admin ID token
 * @param {string} uid - admin uid, stamped as `updatedBy` on an overwrite
 * @returns {Promise<{created: string[], skipped: string[], updated: string[], unchanged: string[]}>}
 */
export async function seedPrompts(token, uid) {
  const existing = await getPrompts({ forceRefresh: true });
  const existingById = new Map(existing.map((prompt) => [prompt.id, prompt]));

  const created = [];
  const skipped = [];

  for (const seed of PROMPT_SEEDS) {
    if (existingById.has(seed.id)) {
      skipped.push(seed.id);
      continue;
    }
    const { id, ...data } = seed;
    await createDocument(PROMPTS_COLLECTION, data, id, token);
    created.push(id);
  }

  const updated = [];
  const unchanged = [];

  for (const update of PROMPT_TEMPLATE_UPDATES) {
    const current = existingById.get(update.id);
    // A missing document is reported as unchanged rather than created: this
    // list exists to *replace* wording, and quietly creating one here would
    // hide a renamed or deleted prompt behind a success message.
    if (!current) {
      unchanged.push(`${update.id} (not found)`);
      continue;
    }
    if (current.template === update.template) {
      unchanged.push(update.id);
      continue;
    }
    const { id, ...patch } = update;
    await updatePrompt(id, patch, { updatedBy: uid, previousVersion: current.version ?? 1 });
    updated.push(id);
  }

  if (created.length > 0) clearPromptsCache();
  return { created, skipped, updated, unchanged };
}
