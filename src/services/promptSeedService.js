/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE IT HAS BEEN RUN IN EVERY ENVIRONMENT.
 *
 * Creates the Grammar Practice prompt documents in `appConfig/config/prompts`.
 * Admin can edit prompts but has no create affordance, so this exists to be
 * pressed once from Admin › Prompts and then removed with its button.
 *
 * **It never overwrites.** An existing document is skipped, so pressing twice
 * is harmless and an admin's edits are never clobbered.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 *   4. delete the old `grammar-drill-prompt` document in Firestore (nothing
 *      reads it; grammar-practice-prompt replaces it)
 *
 * Every template takes the practised dialect as {{targetLang}}. Nothing here
 * may assume Portuguese. The shared blocks are pasted into each variant rather
 * than injected through a variable, because variables carry values and the
 * sentences have to stay editable in the admin editor.
 */

import { createDocument } from "./firestoreService";
import { PROMPTS_COLLECTION, getPrompts, clearPromptsCache } from "./promptService";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

const TOPIC_BLOCK = `Topic: {{topic}}
If the topic is "open", choose one grammar point that suits {{level}} and is worth practising in {{targetLang}}. Prefer a point that is not already common here: {{commonTopics}}
Name the topic with one of these keys when one fits: {{knownTopics}}
Only when none fits, make up a short new key in English.
Return the key as "topicKey", its broad family (verbs, pronouns, articles, nouns, adjectives, prepositions, word-order, numbers...) as "family", the specific point drilled, in English, as "focus", and the same point in {{explanationLang}} as "focusLabel".`;

const SHARED_RULES = `Rules for every item:
- Write the items in {{targetLang}} exactly as it is spoken there. A form that is right only in another variety of the same language is wrong here: do not use it and do not accept it.
- Each item tests the chosen point and nothing else. Vocabulary stays inside {{level}}; the difficulty is the grammar, not the words.
- "answers" lists every form a teacher in {{targetLang}} would accept for that item, including alternatives such as formal and informal address, or simple and compound forms of a tense when both are correct. Never list a form you would mark wrong.
- The cue never contains the answer, and no item can be answered by copying another item. No two items may share the same sentence frame.
- Each item has an "explanation" in {{explanationLang}}: one or two sentences saying why the answer is right and naming the rule.
- "instructions", "focusLabel", "cueLabel", "source", "constraint" and "explanation" are in {{explanationLang}}. Everything else the learner reads is in {{targetLang}}.
- Theme the sentences around these interests where it fits naturally, never at the cost of clarity: {{interests}}
- Do not reuse or rephrase any of these existing items: {{avoid}}`;

const HEAD = `Write a {{targetLang}} grammar exercise at CEFR level {{level}}.

${TOPIC_BLOCK}`;

const TOP_FIELDS = `"topicKey": "...", "family": "...", "focus": "...", "focusLabel": "...",
  "instructions": "one line in {{explanationLang}}",`;

/** Build one variant: the type-specific task, the shared rules, and the JSON shape. */
const variant = (key, label, task, shape) => ({
  key,
  label,
  template: `${HEAD}

${task}

${SHARED_RULES}

Return JSON only, in exactly this shape:
${shape}`,
});

const PRACTICE_VARIANTS = [
  variant("choose-option", "Choose the option", `Type: choose-option. Write {{itemCount}} sentences, each with one gap (___). Give 3 or 4 options for each gap: exactly one is correct, and the others are the mistakes learners really make with this point (wrong tense, wrong person, wrong agreement, a form from another variety of the language).`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "prompt": "sentence with ___", "options": ["...", "...", "..."], "answers": ["the correct option, copied exactly"], "explanation": "..." }
  ]
}`),

  variant("multi-select", "Tick every match", `Type: multi-select. Write {{itemCount}} items. Each item gives a short sentence in {{explanationLang}} as the source, and 4 sentences in {{targetLang}}. At least two of the four must be correct ways to say the source, and at least one must be wrong because of the chosen point.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "source": "sentence in {{explanationLang}}", "options": ["...", "...", "...", "..."], "answers": ["every correct option, copied exactly"], "explanation": "..." }
  ]
}`),

  variant("judge-correct", "Correct or not", `Type: judge-correct. Write {{itemCount}} sentences. Roughly half are correct and half contain one mistake with the chosen point, and nothing else wrong. The learner decides whether each is correct and fixes the wrong ones. For a wrong sentence, "answers" holds the corrected sentence(s); for a correct one, "answers" is empty.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "prompt": "the sentence", "isCorrect": false, "answers": ["the corrected sentence"], "explanation": "..." }
  ]
}`),

  variant("classify", "Classify", `Type: classify. Choose 3 to 6 labels that name the categories being contrasted, written as grammar terms in {{targetLang}} (for example tense or mood names). Then write {{itemCount}} sentences, each belonging to exactly one label. Mark the words that decide the label with [[double brackets]].`, `{
  ${TOP_FIELDS}
  "labels": ["...", "...", "..."],
  "items": [
    { "id": "i1", "prompt": "sentence with [[the deciding words]]", "answers": ["one label, copied exactly"], "explanation": "..." }
  ]
}`),

  variant("word-order", "Put in order", `Type: word-order. Write {{itemCount}} items. Each item is one correct sentence split into 3 to 7 fragments, listed in a shuffled order that is not already correct. Word order must be what the chosen point governs. "answers" holds every grammatical ordering as a full sentence; if more than two orderings work, rewrite the item.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "fragments": ["...", "...", "..."], "answers": ["the full sentence in the correct order"], "explanation": "..." }
  ]
}`),

  variant("conjugate", "Conjugate", `Type: conjugate. Write {{itemCount}} sentences, each with one gap (___) where a verb belongs. For each sentence, give the verb in the infinitive as the cue. When the context alone does not fix the tense or mood, name it as the cue label; otherwise leave the cue label empty. The learner types the conjugated form.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "prompt": "sentence with ___", "cue": "infinitive", "cueLabel": "tense or mood, or empty", "answers": ["..."], "explanation": "..." }
  ]
}`),

  variant("conjugate-contrast", "Contrast pairs", `Type: conjugate-contrast. Write groups of 2 or 3 sentences that share one verb, {{itemCount}} sentences in total. Inside a group, the context (time expressions, frequency, the rest of the sentence) and nothing else decides which tense or mood each sentence needs, and the sentences need different forms. Each sentence has one gap (___) and the shared infinitive as its cue. Give every sentence of a group the same "groupId".`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "groupId": "g1", "prompt": "sentence with ___", "cue": "infinitive", "answers": ["..."], "explanation": "..." }
  ]
}`),

  variant("gap-by-cue", "Fill from a cue", `Type: gap-by-cue. Write {{itemCount}} sentences, each with one gap (___). The cue label tells the learner what the gap needs without giving it away: the possessor, the article type and number, a number written in digits, where the speaker and listener are, or the person a pronoun refers to. The learner types the missing word or words.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "prompt": "sentence with ___", "cueLabel": "the cue, in {{explanationLang}}", "answers": ["..."], "explanation": "..." }
  ]
}`),

  variant("inflect", "Change the form", `Type: inflect. Write {{itemCount}} items. Each gives a word or short phrase in {{targetLang}} as the prompt and says, as the cue label, which form the learner must produce (for example feminine, plural, gerund, participle, the adjective of a noun). The learner types that form.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "prompt": "word or phrase", "cueLabel": "the form wanted, in {{explanationLang}}", "answers": ["..."], "explanation": "..." }
  ]
}`),

  variant("fill-from-bank", "Word bank", `Type: fill-from-bank. Write one short connected passage at {{level}} with {{itemCount}} gaps (___), each testing the chosen point. The word bank holds every correct answer plus 3 extra distractors, in a shuffled order that is not the answer order. Each item is one gap: "position" is its 1-based place in reading order. The number of ___ in the passage must equal the number of items.`, `{
  ${TOP_FIELDS}
  "passage": "text with ___ gaps",
  "wordBank": ["...", "...", "..."],
  "items": [
    { "id": "i1", "position": 1, "answers": ["the word from the bank, copied exactly"], "explanation": "..." }
  ]
}`),

  variant("transform", "Rewrite (open answer)", `Type: transform. Write {{itemCount}} sentences and one operation that applies to all of them (for example: make it negative, make it passive, replace the marked words with a pronoun, put it into reported speech). Wrap the part the learner must change in [[double brackets]]. The learner rewrites the whole sentence.`, `{
  ${TOP_FIELDS}
  "operation": "short label for the operation, in {{explanationLang}}",
  "items": [
    { "id": "i1", "prompt": "sentence with [[the part to change]]", "answers": ["full rewritten sentence", "..."], "explanation": "..." }
  ]
}`),

  variant("build-sentence", "Build a sentence (open answer)", `Type: build-sentence. Write {{itemCount}} items. Each gives 2 to 5 parts in {{targetLang}} (words, or a short relation such as "A > B" for a comparison) that the learner must turn into one correct sentence using the chosen point.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "parts": ["...", "..."], "answers": ["every acceptable full sentence"], "explanation": "..." }
  ]
}`),

  variant("translate", "Translate (open answer)", `Type: translate. Write {{itemCount}} short sentences in {{explanationLang}} as the source. Each one can only be translated correctly into {{targetLang}} by using the chosen point. "answers" holds every acceptable translation.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "source": "sentence in {{explanationLang}}", "answers": ["every acceptable translation"], "explanation": "..." }
  ]
}`),

  variant("open-completion", "Complete freely (open answer)", `Type: open-completion. Write {{itemCount}} sentence openings in {{targetLang}}. For each, the constraint says which grammar the learner's ending must use. There is no single right answer: give 2 or 3 sample endings as "sampleAnswers", which are shown after marking and never used as a key.`, `{
  ${TOP_FIELDS}
  "items": [
    { "id": "i1", "prompt": "sentence opening...", "constraint": "what the ending must use, in {{explanationLang}}", "sampleAnswers": ["full sentence", "full sentence"], "explanation": "what a correct ending needs" }
  ]
}`),
];

const GLOSS_TEMPLATE = `Translate the learner-facing text of a grammar exercise from {{sourceLang}} into {{targetLocale}}.

The exercise practises {{targetLang}}. Only the fields below are in the learner's own language; everything else about the exercise stays as it is.

Fields (JSON):
{{fieldsJson}}

Rules:
- Return exactly the same keys and the same structure, with every string translated into {{targetLocale}}.
- Words or sentences in {{targetLang}} that appear inside an explanation are examples: copy them unchanged.
- Grammar terms use the names a teacher in {{targetLocale}} would use.
- Keep it short and plain; do not add anything.

Return JSON only, in exactly the same shape as the input.`;

const CHECK_TEMPLATE = `You are marking one answer in a {{targetLang}} grammar exercise at CEFR level {{level}}.

Task: {{task}}
Item: {{item}}
Answers already accepted: {{acceptedAnswers}}
The learner wrote: {{learnerAnswer}}

Decide whether the learner's answer is correct {{targetLang}} that does what the task asks. A different wording is fine if it is grammatical in {{targetLang}}, keeps the meaning and uses the point being practised. A form that is right only in another variety of the language is wrong here. Ignore capitalisation and final punctuation.

Return JSON only:
{
  "acceptable": true or false,
  "correctedAnswer": "the learner's answer corrected, or the same answer if it is right",
  "explanation": "one or two sentences in {{explanationLang}}: what is right or wrong and why"
}`;

const ADAPT_TEMPLATE = `Adapt a grammar exercise written in {{sourceDialect}} for learners of {{targetDialect}}.

Exercise (JSON):
{{exerciseJson}}

First decide whether it can be adapted. If the point being practised is itself one of the differences between {{sourceDialect}} and {{targetDialect}} (so the answers would teach something else), it cannot: return {"portable": false, "reason": "..."}.

Otherwise return the same exercise rewritten for {{targetDialect}}:
- Same keys, same item ids, same point, same difficulty.
- Vocabulary, spelling, forms of address and verb forms as they are in {{targetDialect}}.
- Work every "answers" list out again for {{targetDialect}}; do not copy them. Include every form a teacher in {{targetDialect}} would accept, and nothing that is right only in {{sourceDialect}}.
- Leave explanations, instructions and labels in the language they are written in.

Return JSON only: {"portable": true, "exercise": { ...the adapted exercise... }} or {"portable": false, "reason": "..."}.`;

const COMMON_VARIABLES = [
  { name: "targetLang", description: "Dialect being practised, e.g. pt-PT" },
  { name: "explanationLang", description: "The learner's interface language" },
  { name: "level", description: "CEFR level: A1-C2" },
];

export const PROMPT_SEEDS = [
  {
    id: "grammar-practice-prompt",
    name: "Grammar Practice — Generate exercise",
    description:
      "Writes one grammar practice exercise of N items in one dialect, with the answer key and explanations, and names its topic. One variant per exercise type. The learner-language fields (instructions, focusLabel, cueLabel, source, constraint, explanation) are split off into the gloss by the service.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarPracticeService.js",
    sourceFunction: "getPracticeExercise",
    model: GEMINI_MODEL,
    explorerModel: "",
    maxTokens: 4096,
    version: 1,
    variables: [
      ...COMMON_VARIABLES,
      { name: "topic", description: 'Topic key the learner picked, or "open" for Surprise me' },
      { name: "knownTopics", description: "Topic keys already known for this dialect, comma-separated" },
      { name: "commonTopics", description: "Topics this pool cell already has most of; may be (none)" },
      { name: "itemCount", description: "How many items to write" },
      { name: "interests", description: "Comma-separated learner interests; may be empty" },
      { name: "avoid", description: "Prompts of items already in this pool cell; may be (none)" },
    ],
    variants: PRACTICE_VARIANTS,
  },
  {
    id: "grammar-practice-gloss-prompt",
    name: "Grammar Practice — Translate learner text",
    description:
      "Translates the learner-facing fields of an exercise (instructions, cue labels, explanations, translate sources) into another reader language. The answer key is never sent.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarPracticeService.js",
    sourceFunction: "getGloss",
    model: GEMINI_MODEL,
    explorerModel: "",
    maxTokens: 3072,
    version: 1,
    variables: [
      { name: "targetLang", description: "Dialect the exercise practises" },
      { name: "sourceLang", description: "Language the fields are written in now" },
      { name: "targetLocale", description: "Language to translate the fields into" },
      { name: "fieldsJson", description: "The learner-language fields as JSON" },
    ],
    template: GLOSS_TEMPLATE,
  },
  {
    id: "grammar-practice-check-prompt",
    name: "Grammar Practice — Check an open answer",
    description:
      'Marks one typed sentence in the open-answer types (transform, build-sentence, translate, open-completion). Runs on "Ask AI to check" and for every open-completion answer. Maestro and up only.',
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarPracticeService.js",
    sourceFunction: "checkOpenAnswer",
    model: GEMINI_MODEL,
    explorerModel: "",
    maxTokens: 1024,
    version: 1,
    variables: [
      ...COMMON_VARIABLES,
      { name: "task", description: "What the learner was asked to do" },
      { name: "item", description: "The item as the learner saw it" },
      { name: "acceptedAnswers", description: "Answers already accepted, or sample answers" },
      { name: "learnerAnswer", description: "What the learner typed" },
    ],
    template: CHECK_TEMPLATE,
  },
  {
    id: "grammar-practice-adapt-prompt",
    name: "Grammar Practice — Adapt to another dialect",
    description:
      "Ports an exercise to a sibling dialect of the same language, working the answers out again, or reports that it cannot be ported. Not called yet: this is for the dialect rollout.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarPracticeService.js",
    sourceFunction: "(not wired yet)",
    model: GEMINI_MODEL,
    explorerModel: "",
    maxTokens: 4096,
    version: 1,
    variables: [
      { name: "sourceDialect", description: "Dialect the exercise was written in" },
      { name: "targetDialect", description: "Dialect to adapt it to" },
      { name: "exerciseJson", description: "The exercise content as JSON" },
    ],
    template: ADAPT_TEMPLATE,
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
