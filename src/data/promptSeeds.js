/**
 * promptSeeds.js
 *
 * ┌───────────────────────────────────────────────────────────────────────┐
 * │ TEMPORARY — remove once the prompts have been seeded into Firestore.  │
 * │ Delete this file together with the "Seed new prompts" button in       │
 * │ src/components/admin/PromptsSection.jsx and its handler in            │
 * │ src/pages/AdminPage.jsx.                                              │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * First version of the prompt documents for the Grammar and Story Generator
 * features. The seeder writes any of these whose `id` is not already present
 * in appConfig/config/prompts — it never overwrites an existing document, so
 * templates hand-tuned in the admin editor survive a second click.
 *
 * Shape matches the documents already in that collection (see
 * PromptEditModal's KNOWN_FIELDS): id, name, description, category, status,
 * sourceFile, sourceFunction, variables[], template | variants[], maxTokens,
 * model. The seeder stamps version/createdAt/updatedAt/updatedBy.
 *
 * Every template takes the learning language as a {{targetLang}} variable —
 * nothing here is allowed to assume European Portuguese. pt-PT is seed data,
 * not a hardcoded assumption.
 */

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Shared preamble for the JSON-returning prompts. The services all call
 * parseAIJSON() on the response and pass a responseSchema, so the model is
 * already constrained — this is belt-and-braces for the cases where a
 * schema can't express the requirement.
 */
const JSON_RULES = `Return ONLY valid JSON. No markdown fences, no commentary before or after.`;

export const PROMPT_SEEDS = [
  // ─────────────────────────────────────────────────────────────────────────
  // Grammar — topic content seeding
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "grammar-topic-seed-prompt",
    name: "Grammar — Seed Topic Content",
    description:
      "Generates the explanation, tables and examples for one grammar topic in one locale. Used to fill grammarTopics/{id}/content/{locale} for a language that has no hand-written seed file.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarService.js",
    sourceFunction: "seedTopicContent",
    model: GEMINI_MODEL,
    maxTokens: 4096,
    variables: [
      { name: "targetLang", description: "Learning language being described, e.g. pt-PT" },
      { name: "explanationLang", description: "Language the explanation is written in (the user's interface language)" },
      { name: "topicKey", description: "Language-neutral topic key, e.g. verbs-past-simple" },
      { name: "topicFamily", description: "Topic family, e.g. verbs, pronouns, articles" },
    ],
    template: `You are a linguist writing reference material for a language-learning app.

Describe the grammar topic "{{topicKey}}" (family: {{topicFamily}}) as it works in {{targetLang}}.

Write every explanation in {{explanationLang}}. Write every example sentence in {{targetLang}}, each with its translation into {{explanationLang}}.

Rules:
- Describe {{targetLang}} as it is actually spoken, not a related dialect. If the topic works differently in other dialects of the same language, describe only {{targetLang}}.
- If the topic does not exist in {{targetLang}} (for example a case system the language lacks), say so plainly in "summary" and return empty "tables" and "examples" rather than inventing something.
- Prefer a conjugation/declension table whenever the topic has one. Tables must be rectangular: every row has exactly as many cells as there are headers.
- "pitfalls" are the mistakes learners actually make — especially interference from {{explanationLang}}.

${JSON_RULES}

{
  "title": "short topic title in {{explanationLang}}",
  "summary": "one or two sentences in {{explanationLang}}",
  "explanation": "the full explanation in {{explanationLang}}, plain text with \\n between paragraphs",
  "tables": [
    { "caption": "...", "headers": ["...", "..."], "rows": [["...", "..."], ["...", "..."]] }
  ],
  "examples": [
    { "target": "sentence in {{targetLang}}", "native": "translation in {{explanationLang}}", "note": "optional short note, or empty string" }
  ],
  "pitfalls": ["common learner mistake, in {{explanationLang}}"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Grammar — tip generation ("ask AI for a new tip")
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "grammar-tip-generate-prompt",
    name: "Grammar — Generate New Tip",
    description:
      "Generates one new language-specific tip (pronunciation rule, expression, proverb, tongue twister, mnemonic...) for the learning language, avoiding tips already in the pool.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarService.js",
    sourceFunction: "generateTip",
    model: GEMINI_MODEL,
    maxTokens: 1536,
    variables: [
      { name: "targetLang", description: "Learning language, e.g. pt-PT" },
      { name: "explanationLang", description: "Language the tip body is written in" },
      { name: "category", description: "pronunciation | spelling | expression | proverb | tongue-twister | false-friend | vocabulary | culture | mnemonic" },
      { name: "knownTitles", description: "Comma-separated titles already in the pool — do not repeat these" },
    ],
    template: `You are a native {{targetLang}} teacher adding one new tip to a study collection.

Category: {{category}}
Write the title and body in {{explanationLang}}. Keep every example in {{targetLang}}.

Already in the collection — pick something genuinely different from all of these:
{{knownTitles}}

Rules:
- One tip only. Specific and useful, not a generic platitude ("practise every day" is worthless).
- It must be true of {{targetLang}} specifically. Do not import a rule from a related dialect or language.
- For "pronunciation": state the rule, then give words that demonstrate it, including any exception.
- For "tongue-twister" or "proverb": give the text in {{targetLang}}, a literal translation, and what it actually means or trains.
- For "false-friend": name the word, what learners think it means, and what it really means.

${JSON_RULES}

{
  "title": "short title in {{explanationLang}}",
  "body": "the tip in {{explanationLang}}, 1-4 sentences",
  "examples": [
    { "target": "example in {{targetLang}}", "native": "translation in {{explanationLang}}", "note": "optional short note, or empty string" }
  ]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Grammar — free-text question answering
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "grammar-ask-prompt",
    name: "Grammar — Ask AI a Question",
    description:
      "Answers a learner's free-text grammar question about the learning language, optionally about a passage of text they pasted or extracted from a PDF.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarService.js",
    sourceFunction: "askGrammar",
    model: GEMINI_MODEL,
    maxTokens: 2048,
    variables: [
      { name: "targetLang", description: "Learning language, e.g. pt-PT" },
      { name: "explanationLang", description: "Language the answer is written in" },
      { name: "level", description: "Learner's CEFR level — pitch the answer to it" },
      { name: "question", description: "The learner's question, free text" },
      { name: "userText", description: "Optional pasted/extracted text the question is about; empty when not supplied" },
      { name: "topicKeys", description: "Comma-separated topic keys available in the library, for cross-linking" },
    ],
    template: `You are a patient {{targetLang}} teacher answering one question from a learner at CEFR level {{level}}.

Their question:
{{question}}

Text they provided (may be empty):
{{userText}}

Answer in {{explanationLang}}. Keep every example sentence in {{targetLang}} with a translation.

Rules:
- Answer the question actually asked. Do not deliver a general lesson around it.
- Pitch it at {{level}}: no terminology the learner would not already have met.
- If their text contains a mistake relevant to the question, quote it, correct it, and explain why.
- If the question has no single correct answer (register, regional variation, genuine ambiguity), say so instead of picking one and sounding certain.
- If the question is not about {{targetLang}} grammar or vocabulary, say so briefly and stop.
- "relatedTopicKeys": pick 0-3 from this list, exactly as spelled, or return an empty array. Never invent a key.
  {{topicKeys}}

${JSON_RULES}

{
  "answer": "the answer in {{explanationLang}}, plain text with \\n between paragraphs",
  "examples": [
    { "target": "sentence in {{targetLang}}", "native": "translation in {{explanationLang}}", "note": "optional short note, or empty string" }
  ],
  "relatedTopicKeys": ["topic-key"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Grammar — practice drills (variants mirror exam-reading-prompt)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "grammar-drill-prompt",
    name: "Grammar — Practice Drill",
    description:
      "Generates a practice drill for one grammar topic. Variants are keyed by exercise type and return the same field names as the exam reading prompts, so the existing src/components/exercises/* components render them unchanged.",
    category: "grammar",
    status: "active",
    sourceFile: "src/services/grammarService.js",
    sourceFunction: "getGrammarDrill",
    model: GEMINI_MODEL,
    maxTokens: 3072,
    variables: [
      { name: "targetLang", description: "Learning language the drill is written in" },
      { name: "explanationLang", description: "Language for instructions and explanations" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "topicKey", description: "Grammar topic being drilled, e.g. pronouns-clitic-position" },
      { name: "topicSummary", description: "Short description of the rule, from the topic's content document" },
      { name: "interests", description: "Comma-separated user interests used to theme the sentences; may be empty" },
      { name: "itemCount", description: "How many items to produce" },
    ],
    variants: [
      {
        key: "multiple-choice",
        label: "Multiple Choice",
        template: `Write a {{targetLang}} grammar drill at CEFR level {{level}} practising: {{topicKey}}.
The rule: {{topicSummary}}

Produce {{itemCount}} multiple-choice questions. Each isolates the rule — a learner who knows it gets it right, and a learner who does not cannot guess from context.

Theme the sentences around these interests where it fits naturally, but never at the cost of clarity: {{interests}}

Rules:
- Questions and options in {{targetLang}}. Instructions and explanations in {{explanationLang}}.
- Exactly one option is correct. Distractors must be plausible — the mistakes a real learner makes with this rule, not nonsense.
- "correctAnswer" must be character-for-character identical to one of the options.
- Vocabulary must stay within {{level}}. The difficulty is the grammar, not obscure words.

${JSON_RULES}

{
  "instructions": ["instruction line in {{explanationLang}}"],
  "questions": [
    { "id": "q1", "question": "...", "options": ["...", "...", "..."], "correctAnswer": "...", "explanation": "why, in {{explanationLang}}" }
  ]
}`,
      },
      {
        key: "cloze",
        label: "Cloze (choose the option)",
        template: `Write a {{targetLang}} grammar drill at CEFR level {{level}} practising: {{topicKey}}.
The rule: {{topicSummary}}

Write a short connected passage at {{level}}, themed around these interests where it fits naturally: {{interests}}
Replace {{itemCount}} words with ___ (three underscores), each testing the rule above.

Rules:
- Passage in {{targetLang}}. Instructions in {{explanationLang}}.
- "position" is the 1-based index of the blank in reading order.
- Each blank offers 3-4 options, exactly one correct; "correctAnswer" matches one option exactly.
- The number of ___ in the passage must equal the number of entries in "blanks".

${JSON_RULES}

{
  "passage": "text with ___ blanks",
  "instructions": ["instruction line in {{explanationLang}}"],
  "blanks": [
    { "id": "b1", "position": 1, "options": ["...", "...", "..."], "correctAnswer": "...", "explanation": "why, in {{explanationLang}}" }
  ]
}`,
      },
      {
        key: "fill-blanks",
        label: "Fill Blanks (word bank)",
        template: `Write a {{targetLang}} grammar drill at CEFR level {{level}} practising: {{topicKey}}.
The rule: {{topicSummary}}

Write a short connected passage at {{level}}, themed around these interests where it fits naturally: {{interests}}
Replace {{itemCount}} words with ___ (three underscores) and supply a word bank.

Rules:
- Passage and word bank in {{targetLang}}. Instructions in {{explanationLang}}.
- The word bank holds every correct answer plus 3 extra distractors, shuffled — never in answer order.
- "position" is the 1-based index of the blank in reading order.
- Each correct answer appears in the word bank exactly as written.
- The number of ___ in the passage must equal the number of entries in "blanks".

${JSON_RULES}

{
  "passage": "text with ___ blanks",
  "wordBank": ["...", "...", "..."],
  "instructions": ["instruction line in {{explanationLang}}"],
  "blanks": [
    { "id": "b1", "position": 1, "correctAnswer": "...", "explanation": "why, in {{explanationLang}}" }
  ]
}`,
      },
      {
        key: "true-false",
        label: "True / False",
        template: `Write a {{targetLang}} grammar drill at CEFR level {{level}} practising: {{topicKey}}.
The rule: {{topicSummary}}

Produce {{itemCount}} sentences in {{targetLang}}. The learner marks each as grammatically correct (true) or incorrect (false).

Theme them around these interests where it fits naturally: {{interests}}

Rules:
- Sentences in {{targetLang}}. Instructions and explanations in {{explanationLang}}.
- Mix true and false roughly evenly — never all one way.
- Every false sentence is wrong *because of this rule*, not because of an unrelated slip.
- Each explanation says what is wrong and gives the corrected sentence.

${JSON_RULES}

{
  "instructions": ["instruction line in {{explanationLang}}"],
  "statements": [
    { "id": "s1", "text": "...", "isTrue": true, "explanation": "why, in {{explanationLang}}" }
  ]
}`,
      },
      {
        key: "matching",
        label: "Matching",
        template: `Write a {{targetLang}} grammar drill at CEFR level {{level}} practising: {{topicKey}}.
The rule: {{topicSummary}}

Produce {{itemCount}} pairs the learner must match — for example a sentence opening with its correct continuation, or a form with the context requiring it.

Theme them around these interests where it fits naturally: {{interests}}

Rules:
- Both columns in {{targetLang}}. Instructions in {{explanationLang}}.
- Each item in column A matches exactly one item in column B. No ambiguity — if two pairings are defensible, rewrite.
- "extraItems" are 2-3 plausible column-B distractors matching nothing.

${JSON_RULES}

{
  "instructions": ["instruction line in {{explanationLang}}"],
  "pairs": [
    { "id": "p1", "itemA": "...", "itemB": "..." }
  ],
  "extraItems": ["...", "..."],
  "showExample": false
}`,
      },
      {
        key: "ordering",
        label: "Ordering",
        template: `Write a {{targetLang}} grammar drill at CEFR level {{level}} practising: {{topicKey}}.
The rule: {{topicSummary}}

Produce {{itemCount}} fragments that form one correct {{targetLang}} sentence when put in order — word order is what this rule governs.

Theme it around these interests where it fits naturally: {{interests}}

Rules:
- Fragments in {{targetLang}}. Instructions in {{explanationLang}}.
- "correctPosition" is 1-based and every position from 1 to {{itemCount}} appears exactly once.
- Only one ordering may be grammatical. If the fragments could legitimately be arranged two ways, rewrite them.
- List the fragments shuffled, not already in the correct order.

${JSON_RULES}

{
  "instructions": ["instruction line in {{explanationLang}}"],
  "items": [
    { "id": "i1", "text": "...", "correctPosition": 1 }
  ]
}`,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Stories — generation
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "story-generate-prompt",
    name: "Story — Generate",
    description:
      "Generates a short level-appropriate story in the learning language, themed on the user's interests. Read-and-listen only: no comprehension questions.",
    category: "stories",
    status: "active",
    sourceFile: "src/services/storyService.js",
    sourceFunction: "getStory",
    model: GEMINI_MODEL,
    maxTokens: 3072,
    variables: [
      { name: "targetLang", description: "Language the story is written in, e.g. pt-PT" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "interests", description: "Comma-separated user interests to theme the story; may be empty" },
      { name: "paragraphCount", description: "How many paragraphs to write" },
      { name: "grammarDescription", description: "Level-appropriate grammar and tense guidance" },
      { name: "avoidTitles", description: "Comma-separated titles already in the pool — write something different" },
    ],
    template: `Write an original short story in {{targetLang}} for a learner at CEFR level {{level}}.

Theme it around these interests where it fits naturally: {{interests}}
If that is empty, choose an everyday subject — food, travel, family, work, weather.

Language constraints for {{level}}:
{{grammarDescription}}

Already in the collection — write something clearly different:
{{avoidTitles}}

Rules:
- Exactly {{paragraphCount}} paragraphs, each 2-5 sentences. Each paragraph is one entry in the array, with no blank lines inside it.
- Write in {{targetLang}} as actually spoken. Do not drift into a related dialect: keep the vocabulary, spelling and verb forms consistent with {{targetLang}} throughout.
- It must be a real story — someone wants something and something happens. Not a description, not a list of facts.
- Stay inside the {{level}} constraints. If a word above that level is unavoidable, work its meaning into the surrounding sentence.
- Natural writing, not a grammar exercise in disguise. Do not stuff it with one tense to make a point.
- No headings, no numbering, no markdown. Plain prose.

${JSON_RULES}

{
  "title": "short title in {{targetLang}}",
  "paragraphs": ["paragraph 1", "paragraph 2"]
}`,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Stories — bilingual transcript
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "story-translate-prompt",
    name: "Story — Translate Transcript",
    description:
      "Translates a story's paragraphs into another locale for the side-by-side bilingual reader. The paragraph count must be preserved exactly or the two columns stop lining up.",
    category: "stories",
    status: "active",
    sourceFile: "src/services/storyService.js",
    sourceFunction: "getStoryTranslation",
    model: GEMINI_MODEL,
    maxTokens: 3072,
    variables: [
      { name: "sourceLang", description: "Language the story was written in" },
      { name: "targetLocale", description: "Locale to translate into (the reader's interface language)" },
      { name: "paragraphCount", description: "Exact number of paragraphs that must come back" },
      { name: "title", description: "The story's title in the source language" },
      { name: "paragraphsJson", description: "JSON array of the source paragraphs" },
    ],
    template: `Translate this story from {{sourceLang}} into {{targetLocale}}.

Title: {{title}}

Paragraphs (JSON array):
{{paragraphsJson}}

Rules:
- Return exactly {{paragraphCount}} paragraphs, in the same order. Paragraph N of your output must be the translation of paragraph N of the input — this powers a side-by-side reader, so merging or splitting paragraphs breaks it.
- Translate meaning, not words. The result must read like natural {{targetLocale}}, not a gloss.
- Keep names, numbers and places as they are unless {{targetLocale}} has a genuinely standard form.
- Preserve the register and tone: if the original is casual, the translation is casual.
- Translate the title too.

${JSON_RULES}

{
  "title": "translated title in {{targetLocale}}",
  "paragraphs": ["translated paragraph 1", "translated paragraph 2"]
}`,
  },
];

export default PROMPT_SEEDS;
