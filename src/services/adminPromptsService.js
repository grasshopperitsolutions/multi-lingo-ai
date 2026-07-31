/**
 * adminPromptsService.js
 *
 * Phase 1 of moving AI prompts out of source code: read/write access to
 * appConfig/config/prompts, plus a one-time "seed defaults" migration that
 * copies every prompt currently hardcoded in the various *Service.js files
 * into Firestore so the Admin Page can show and edit them.
 *
 * Nothing here changes runtime AI behavior yet — the actual call sites
 * (examPromptTemplates.js, translationService.js, etc.) still build prompts
 * from their own hardcoded strings. That switch-over is Phase 2.
 *
 * Placeholder syntax used inside `template`/`variants[].template` below is
 * "{{variableName}}" — documentation-only for now, matching the syntax
 * Phase 2's interpolation helper will implement.
 */

import { queryCollection, createDocument, updateDocument } from "./firestoreService";

export const PROMPTS_COLLECTION = "appConfig/config/prompts";

// ---------------------------------------------------------------------------
// Default prompt dataset — one entry per logical prompt, copied verbatim
// (with ${...} interpolation swapped for {{...}} placeholders) from:
//   - src/services/examPromptTemplates.js
//   - src/services/examWritingExerciseService.js
//   - src/services/translationService.js
//   - src/services/supportedLanguagesService.js
//   - src/services/translatorService.js
//   - src/services/dictionaryService.js
//   - src/services/wordLadderService.js
//   - src/services/wordLinkService.js
//   - src/services/getWordService.js
//   - src/services/getTtsService.js
//   - src/components/exercises/ImageMultipleChoiceExercise.jsx
// ---------------------------------------------------------------------------

const READING_PREAMBLE = `You are a Portuguese language examiner creating a READING exercise for CEFR level {{level}} in {{targetLang}}.

LEVEL {{level}} CONSTRAINTS:
{{grammarDescription}}
The reading passage should be approximately {{passageLength}} words.
{{topicLine}}
`;

const READING_RULES_FOOTER = `
Rules:
- All text must be in {{targetLang}}.
- Do NOT include any text outside the JSON object.
- The vocabulary array should contain 2-4 difficult words with their definitions in {{targetLang}}.`;

function readingVariant(body) {
  return `${READING_PREAMBLE}\n${body}\n${READING_RULES_FOOTER}`;
}

export const DEFAULT_PROMPTS = [
  // ── Exams ──────────────────────────────────────────────────────────────
  {
    id: "exam-reading-prompt",
    name: "Exam Reading Prompt",
    description: "Builds the AI prompt for generating reading-comprehension exam exercises (passage + questions) for a given CEFR level and exercise type. Has 8 variants, one per exercise type.",
    category: "exams",
    status: "active",
    sourceFile: "src/services/examPromptTemplates.js",
    sourceFunction: "getReadingPrompt",
    variables: [
      { name: "level", description: "CEFR level (A1-C2)" },
      { name: "targetLang", description: "Target language name" },
      { name: "grammarDescription", description: "Level-appropriate grammar constraints (computed in code from level)" },
      { name: "passageLength", description: "Target passage word count (computed in code from level)" },
      { name: "topicLine", description: "Optional 'Topic: ...' line, blank when no topic given" },
      { name: "questionCount", description: "Number of questions/items to generate" },
      { name: "examPhrasing", description: "Official exam instruction phrasing (computed in code from type + level)" },
      { name: "extraItems", description: "Matching-variant only: number of distractor items in column B" },
    ],
    variants: [
      { key: "multiple-choice", label: "Multiple Choice", template: readingVariant(`Exercise type: Multiple choice comprehension questions.
Create a reading passage and {{questionCount}} multiple-choice questions.
Each question must have 3-4 options (A/B/C or A/B/C/D).
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "multiple-choice",
  "text": "<passage in {{targetLang}}>",
  "instructions": ["{{examPhrasing}}"],
  "vocabulary": [
    { "word": "<difficult word>", "definition": "<simple explanation in {{targetLang}}>" }
  ],
  "questions": [
    { "id": "r1", "text": "<question>", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A. ..." }
  ]
}`) },
      { key: "true-false", label: "True/False", template: readingVariant(`Exercise type: True/False statements about the text.
Create a reading passage and {{questionCount}} statements.
Some statements should be true (V) and some false (F), based on the text.
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "true-false",
  "text": "<passage in {{targetLang}}>",
  "instructions": ["{{examPhrasing}}"],
  "vocabulary": [
    { "word": "<difficult word>", "definition": "<simple explanation>" }
  ],
  "statements": [
    { "id": "tf1", "text": "<statement>", "isTrue": true }
  ],
  "questions": [
    { "id": "r1", "text": "<statement>", "options": ["Verdadeiro", "Falso"], "correctAnswer": "Verdadeiro" }
  ]
}`) },
      { key: "best-title", label: "Best Title", template: readingVariant(`Exercise type: Select the best title for the text.
Create a reading passage and {{questionCount}} title options.
Only one title should be correct/appropriate.
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "best-title",
  "text": "<passage in {{targetLang}}>",
  "instructions": ["{{examPhrasing}}"],
  "vocabulary": [
    { "word": "<word>", "definition": "<definition>" }
  ],
  "titles": [
    { "id": "t1", "text": "<title 1>", "isCorrect": true },
    { "id": "t2", "text": "<title 2>", "isCorrect": false }
  ],
  "questions": [
    { "id": "r1", "text": "Qual é o melhor título para o texto?", "options": ["<title 1>", "<title 2>", "<title 3>", "<title 4>"], "correctAnswer": "<title 1>" }
  ]
}`) },
      { key: "ordering", label: "Ordering", template: readingVariant(`Exercise type: Paragraph/sentence ordering.
Create {{questionCount}} paragraphs or sentences that form a coherent text when ordered correctly.
Each item should be a complete sentence (10-40 words).
CRITICAL: Do NOT include ordinal markers (first, second, then, finally...) inside the item text that would give away the correct position.
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "ordering",
  "instructions": ["{{examPhrasing}}"],
  "items": [
    { "id": "o1", "text": "<paragraph text>", "correctPosition": 1 }
  ]
}`) },
      { key: "cloze-options", label: "Cloze (Options)", template: readingVariant(`Exercise type: Cloze with A/B/C/D options for each gap.
Create a short passage in {{targetLang}} with {{questionCount}} gaps.
In the passage, mark each gap with ___ (triple underscore).
Each gap must have 3-4 options (A/B/C/D).
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "cloze-options",
  "instructions": ["{{examPhrasing}}"],
  "passage": "<the passage in {{targetLang}} with ___ marking each gap>",
  "blanks": [
    { "id": "c1", "position": 1, "options": ["opção A", "opção B", "opção C", "opção D"], "correctAnswer": "opção A" }
  ]
}`) },
      { key: "matching", label: "Matching", template: readingVariant(`Exercise type: Column A → Column B matching.
Create {{questionCount}} pairs of related items and {{extraItems}} extra items for column B (distractors).
Official phrasing: "{{examPhrasing}}"
Há {{extraItems}} opções a mais na coluna B.

Return ONLY a valid JSON object:
{
  "type": "matching",
  "instructions": ["{{examPhrasing}}"],
  "pairs": [
    { "id": "m1", "itemA": "<column A text>", "itemB": "<column B correct match>" }
  ],
  "extraItems": ["<distractor 1>", "<distractor 2>"],
  "showExample": true,
  "example": { "itemA": "<sample column A>", "itemB": "<sample column B match>" }
}`) },
      { key: "fill-blanks", label: "Fill in the Blanks", template: readingVariant(`Exercise type: Fill in the blanks from a word bank.
Create a short passage in {{targetLang}} with {{questionCount}} gaps.
In the passage, mark each gap with ___ (triple underscore).
Provide a word bank with the correct answers plus 3-5 extra distractor words.
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "fill-blanks",
  "instructions": ["{{examPhrasing}}"],
  "passage": "<the passage in {{targetLang}} with ___ marking each gap>",
  "wordBank": ["<correct word 1>", "<correct word 2>", "<distractor 1>", "<distractor 2>", ...],
  "blanks": [
    { "id": "fb1", "position": 1, "correctAnswer": "<correct word>" }
  ]
}`) },
      { key: "notice-sign", label: "Notice/Sign", template: readingVariant(`Exercise type: Reading public notices and signs.
Create {{questionCount}} realistic notices or signs that might appear in public places (schools, offices, streets, shops).
For each notice, write a comprehension question with 3-4 multiple choice options.
Official phrasing: "{{examPhrasing}}"

Return ONLY a valid JSON object:
{
  "type": "notice-sign",
  "instructions": ["{{examPhrasing}}"],
  "notices": [
    { "id": "n1", "text": "<notice/sign text>", "question": "<comprehension question>", "options": ["A. ...", "B. ...", "C. ...", "D. ..."], "correctAnswer": "A. ..." }
  ]
}`) },
    ],
  },

  {
    id: "exam-listening-prompt",
    name: "Exam Listening Prompt",
    description: "Builds the AI prompt for generating listening-comprehension exam exercises (transcript + questions) for a given CEFR level, audio format, and question type.",
    category: "exams",
    status: "active",
    sourceFile: "src/services/examPromptTemplates.js",
    sourceFunction: "getListeningPrompt",
    variables: [
      { name: "targetLang", description: "Target language name" },
      { name: "level", description: "CEFR level (A1-C2)" },
      { name: "audioFormatLabel", description: "Human description of the audio format (computed in code, e.g. 'a natural dialogue between two people')" },
      { name: "listeningTypeLabel", description: "Human label for the question type (computed in code, e.g. 'multiple choice')" },
      { name: "questionCount", description: "Number of items to generate (computed in code from level)" },
      { name: "toneDescription", description: "Delivery tone description for TTS (computed in code from audioFormat)" },
      { name: "duration", description: "Target audio duration in seconds (computed in code from level)" },
      { name: "listeningFieldList", description: "Extra JSON fields to request, varies by question type (questions / statements+questions / passage+wordBank+blanks)" },
    ],
    template: `Generate a listening comprehension exercise in {{targetLang}} for CEFR level {{level}}.
CRITICAL: All text content must be written entirely in {{targetLang}}.

Audio format: {{audioFormatLabel}}.
Exercise type: {{listeningTypeLabel}}.
Create {{questionCount}} items based on the transcript the student will hear.

The "transcript" is the full script the student will listen to via TTS.
The "tone" describes how the TTS should deliver the audio.
Return a JSON object with:
  - "transcript": the full audio script in {{targetLang}}
  - "tone": "{{toneDescription}}"
  - "duration": {{duration}}
  - "instructions": array of strings
{{listeningFieldList}}

Return ONLY valid JSON. No markdown, no explanation.`,
  },

  {
    id: "exam-writing-prompt",
    name: "Exam Writing Prompt",
    description: "Builds the AI prompt for generating a writing exam exercise (scenario + instructions) for a given CEFR level and text type.",
    category: "exams",
    status: "active",
    sourceFile: "src/services/examPromptTemplates.js",
    sourceFunction: "getWritingPrompt",
    variables: [
      { name: "level", description: "CEFR level (A1-C2)" },
      { name: "targetLang", description: "Target language name" },
      { name: "grammarDescription", description: "Level-appropriate grammar constraints (computed in code from level)" },
      { name: "textTypeLabel", description: "Human label for the text type (computed in code, e.g. 'an email')" },
      { name: "minWords", description: "Minimum word count (computed in code from level)" },
      { name: "maxWords", description: "Maximum word count (computed in code from level)" },
      { name: "topicLine", description: "Optional 'Topic: ...' line, blank when no topic given" },
    ],
    template: `You are a Portuguese language examiner creating a WRITING exercise for CEFR level {{level}} in {{targetLang}}.
The exercise must be in European Portuguese (pt-PT).

LEVEL {{level}} CONSTRAINTS:
{{grammarDescription}}

Text type: {{textTypeLabel}}.
The student must write between {{minWords}} and {{maxWords}} words.
{{topicLine}}

Return ONLY a valid JSON object:
{
  "type": "writing",
  "prompt": "<the scenario/context in {{targetLang}}>",
  "instructions": ["<instruction 1>", "<instruction 2>", ...],
  "minWords": {{minWords}},
  "maxWords": {{maxWords}}
}

Rules:
- The prompt and instructions must be in European Portuguese (pt-PT).
- Include 3-5 bullet-point instructions guiding what to include.
- Make the scenario realistic and age-appropriate.
- Do NOT include any text outside the JSON object.`,
  },

  {
    id: "exam-oral-prompt",
    name: "Exam Oral Expression Prompt",
    description: "Builds the AI prompt for generating an oral expression exam exercise (task + follow-up questions). Not currently called by any UI — getOralPrompt() has no call sites yet.",
    category: "exams",
    status: "unused",
    sourceFile: "src/services/examPromptTemplates.js",
    sourceFunction: "getOralPrompt",
    variables: [
      { name: "level", description: "CEFR level (A1-C2)" },
      { name: "targetLang", description: "Target language name" },
      { name: "grammarDescription", description: "Level-appropriate grammar constraints (computed in code from level)" },
      { name: "prepTimeMinutes", description: "Preparation time in minutes (computed in code from level)" },
      { name: "speakingTimeMinutes", description: "Speaking time in minutes (computed in code from level)" },
      { name: "oralTypeLabel", description: "Human label for the oral exercise type (computed in code, e.g. 'a guided conversation with the examiner')" },
      { name: "oralType", description: "Raw oral exercise type key, e.g. 'conversation'" },
    ],
    template: `You are a Portuguese language examiner creating an ORAL EXPRESSION exercise for CEFR level {{level}} in {{targetLang}}.

LEVEL {{level}} CONSTRAINTS:
{{grammarDescription}}
Preparation time: {{prepTimeMinutes}} minutes.
Speaking time: {{speakingTimeMinutes}} minutes.

Exercise type: {{oralTypeLabel}}.

Return ONLY a valid JSON object:
{
  "type": "oral",
  "oralType": "{{oralType}}",
  "prompt": "<the task description in {{targetLang}}>",
  "instructions": ["<instruction 1>", "<instruction 2>", ...],
  "prepTimeMinutes": {{prepTimeMinutes}},
  "speakingTimeMinutes": {{speakingTimeMinutes}},
  "topics": ["<topic 1>", "<topic 2>"],
  "followUpQuestions": ["<question 1>", "<question 2>", "<question 3>"]
}

Rules:
- All text must be in {{targetLang}}.
- The prompt should clearly describe the task.
- Include 2-4 follow-up questions the examiner can ask.
- Do NOT include any text outside the JSON object.`,
  },

  {
    id: "exam-writing-evaluation-prompt",
    name: "Exam Writing Evaluation Prompt",
    description: "Builds the AI prompt used to grade a student's writing exercise submission against 5 CEFR-based criteria (theme/coherence, structure, morphology/syntax, vocabulary, spelling).",
    category: "exams",
    status: "active",
    sourceFile: "src/services/examWritingExerciseService.js",
    sourceFunction: "evaluateWriting",
    variables: [
      { name: "level", description: "CEFR level (A1-C2)" },
      { name: "targetLang", description: "Target language name" },
      { name: "exercisePrompt", description: "The original writing exercise prompt/scenario the student was given" },
      { name: "userText", description: "The student's submitted text" },
      { name: "minWords", description: "Minimum expected word count for the level" },
      { name: "maxWords", description: "Maximum expected word count for the level" },
      { name: "wordCount", description: "Actual word count of the student's submission (computed in code)" },
      { name: "feedbackLanguage", description: "Language feedback must be written in, resolved from the user's interface language" },
    ],
    template: `You are an expert language examiner evaluating a CEFR {{level}} writing exercise in {{targetLang}}.
The student was asked to write in {{targetLang}}.

--- EXERCISE PROMPT ---
{{exercisePrompt}}
--- END EXERCISE PROMPT ---

--- STUDENT TEXT ---
{{userText}}
--- END STUDENT TEXT ---

Evaluate the student text using the following 5 parameters, each scored from 1 to 5:

A. Tema, tipologia, informação e coerência (Theme, text type, information & coherence)
   5: Fully follows task instructions, coherent, complete information.
   3: Partially follows instructions, generally coherent with some gaps.
   1: Insufficient task completion, very little intelligible content.

B. Estrutura e coesão (Structure & cohesion)
   5: Well-defined structure, correct paragraphing, punctuation, cohesive devices, appropriate verb tenses.
   3: Satisfactory structure with minor inconsistencies in cohesion and verb tense.
   1: Very poor structure, breaks in cohesion, inconsistent verb tenses.

C. Morfologia e sintaxe (Morphology & syntax)
   5: Good command of sentence construction, agreement, word order. Uses complex structures.
   3: Acceptable command with some errors in agreement, selection, inflection.
   1: Poor command, serious errors throughout. No complex structures.

D. Vocabulário (Vocabulary)
   5: Adequate, diverse, appropriate vocabulary for the topic.
   3: Adequate but limited vocabulary with occasional inadequacies.
   1: Limited, redundant, often inappropriate vocabulary.

E. Ortografia (Spelling)
   5: Correct spelling or at most 1 error per 60 words.
   3: Some spelling errors (~4 per 60 words).
   1: Many spelling errors (more than 7 per 60 words).

Important:
- Scores may be intermediate values (e.g. 2, 4) when between levels.
- Expected word count range: {{minWords}}–{{maxWords}} words. Student wrote {{wordCount}} words.
- Do NOT apply the word count penalty yourself — it will be applied programmatically.
- Write ALL feedback (the "feedback" fields and "generalFeedback") in {{feedbackLanguage}}. This is mandatory.
- Be specific and constructive in each parameter's feedback.

Return ONLY a valid JSON object with this exact shape:
{
  "parameters": [
    { "id": "A", "name": "Tema, tipologia, informação e coerência", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in {{feedbackLanguage}}>" },
    { "id": "B", "name": "Estrutura e coesão", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in {{feedbackLanguage}}>" },
    { "id": "C", "name": "Morfologia e sintaxe", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in {{feedbackLanguage}}>" },
    { "id": "D", "name": "Vocabulário", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in {{feedbackLanguage}}>" },
    { "id": "E", "name": "Ortografia", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback in {{feedbackLanguage}}>" }
  ],
  "generalFeedback": "<overall constructive feedback paragraph in {{feedbackLanguage}}>"
}
Do NOT include any text outside the JSON object.`,
  },

  // ── Translation ────────────────────────────────────────────────────────
  {
    id: "translation-fill-missing-prompt",
    name: "Fill Missing UI Translations Prompt",
    description: "Builds the AI prompt used to translate only the UI string keys that are missing from a locale (compared to en-US), so newly-added English strings get filled in automatically.",
    category: "translation",
    status: "active",
    sourceFile: "src/services/translationService.js",
    sourceFunction: "fillMissingTranslations",
    variables: [
      { name: "locale", description: "BCP-47 locale being filled, e.g. 'pt-PT'" },
      { name: "missingKeysJson", description: "JSON (pretty-printed) of only the keys missing from this locale" },
    ],
    template: `You are a professional translator. Below is a JSON object containing new UI strings that need to be added to an existing {{locale}} translation file.

\`\`\`json
{{missingKeysJson}}
\`\`\`

Translate ALL string values to the locale "{{locale}}".

CRITICAL RULES:
- Keep the exact same JSON structure and keys — do NOT change any keys.
- Only translate the string VALUES, not the keys.
- For arrays, translate each element.
- Preserve any {{placeholders}} or interpolation variables exactly as-is.
- Return ONLY the translated JSON object — no markdown, no backticks, no commentary.`,
  },

  {
    id: "translation-seed-language-prompt",
    name: "Seed Language Translations Prompt",
    description: "Builds the AI prompt used to translate the entire en-US UI string bundle into a brand-new locale when a language is first added.",
    category: "translation",
    status: "active",
    sourceFile: "src/services/translationService.js",
    sourceFunction: "seedLanguageTranslations",
    variables: [
      { name: "locale", description: "BCP-47 locale being seeded, e.g. 'pt-BR'" },
      { name: "sourceJson", description: "JSON (pretty-printed) of the full en-US translation bundle" },
    ],
    template: `You are a professional translator. Below is a JSON object containing all UI strings for an application in English (en-US).

\`\`\`json
{{sourceJson}}
\`\`\`

Translate ALL string values to the locale "{{locale}}".

CRITICAL RULES:
- Keep the exact same JSON structure and keys — do NOT change any keys.
- Only translate the string VALUES, not the keys.
- For arrays (like "home.marquee"), translate each element.
- Preserve any {{placeholders}} or interpolation variables exactly as-is.
- Return ONLY the translated JSON object — no markdown, no backticks, no commentary.`,
  },

  {
    id: "language-metadata-seed-prompt",
    name: "New Language Metadata Prompt",
    description: "Builds the AI prompt used when an admin adds a new supported language — asks the AI to determine the BCP-47 code and generate metadata (label, flag, character sets, RTL flag) for it.",
    category: "translation",
    status: "active",
    sourceFile: "src/services/supportedLanguagesService.js",
    sourceFunction: "SEED_PROMPT",
    variables: [
      { name: "humanName", description: "The human-entered name/description of the language, e.g. 'australia english'" },
      { name: "code", description: "Optional BCP-47 code hint entered by the admin" },
    ],
    template: `You are a linguistics assistant. The user wants to add a language to the system.

User input: "{{humanName}}"
Possible BCP-47 code hint: "{{code}}"

Your job:
1. Determine the most appropriate BCP-47 code for this language/dialect.
   - If the hint looks like a valid BCP-47 code (e.g. "en-AU", "pt-BR", "ja-JP"), use it.
   - If the hint is a description (e.g. "australia english", "african portuguese em angola"), derive the correct BCP-47 code yourself.
   - If you cannot determine a precise code, use a sensible best guess (e.g. "en-AU" for Australian English).
2. Generate metadata for that language.

CRITICAL: The "code" field MUST be a valid BCP-47 language tag such as "en-AU", "pt-AO", "pt-BR", etc. Do NOT return a plain description like "australia english".

Return ONLY a JSON object (no markdown, no backticks, no commentary) with exactly these fields:
{
  "code": "<the BCP-47 code you determined>",
  "label": "Full language name in English (e.g. 'Portuguese (Portugal)')",
  "flag": "Single emoji flag for the primary country where this language is spoken",
  "examSupported": boolean (true only for Portuguese pt-PT and pt-BR, false for all others),
  "status": "active",
  "rtl": boolean (true for Arabic, Hebrew, Farsi, Urdu, etc.; false otherwise),
  "characters": {
    "default": ["array of all unique lowercase letters used in this language"],
    "special": ["array of accented / diacritic characters commonly used (empty array if none)"]
  }
}

Rules:
- The code MUST be a valid BCP-47 code (language-region format like "en-AU", "pt-AO", etc.).
- default and special arrays must be deduplicated.
- default should contain at least 20 characters if the language uses a Latin-like script.
- For non-Latin scripts (Cyrillic, Greek, Japanese, Korean, Chinese, etc.), include the relevant characters.
- Do NOT include uppercase letters in default — only lowercase base characters.
- Do NOT include digits, punctuation, or whitespace.
- Return ONLY the JSON object.`,
  },

  {
    id: "translate-text-prompt",
    name: "Ad-hoc Text Translation Prompt",
    description: "Builds the AI prompt used by the standalone translator tool to translate arbitrary text between two languages.",
    category: "translation",
    status: "active",
    sourceFile: "src/services/translatorService.js",
    sourceFunction: "translateText",
    variables: [
      { name: "sourceLang", description: "BCP-47 source locale, e.g. 'en-US'" },
      { name: "targetLang", description: "BCP-47 target locale, e.g. 'pt-PT'" },
      { name: "text", description: "The text to translate" },
    ],
    template: `You are a professional translator.
Translate the following text from {{sourceLang}} to {{targetLang}}.
Return ONLY the translated text. No explanations, no notes, no punctuation changes unless necessary.

Text to translate:
{{text}}`,
  },

  // ── Dictionary ─────────────────────────────────────────────────────────
  {
    id: "dictionary-lookup-prompt",
    name: "Dictionary Lookup Prompt",
    description: "Builds the AI prompt used to look up a word's definition (in the user's interface language) and synonyms (in the learning language).",
    category: "dictionary",
    status: "active",
    sourceFile: "src/services/dictionaryService.js",
    sourceFunction: "lookupWord",
    variables: [
      { name: "word", description: "Word or expression being looked up" },
      { name: "interfaceLang", description: "BCP-47 locale the definition must be written in" },
      { name: "learningLang", description: "BCP-47 locale the synonyms must be written in" },
    ],
    template: `You are a multilingual dictionary assistant.
Look up the following word or expression: "{{word}}"

Return a JSON object with exactly two fields:

- "definition": a short, clear, plain-language definition (1–2 sentences max).
  Write the definition in this language (BCP-47): {{interfaceLang}}.

- "synonyms": an array of synonyms or closely related words/expressions.
  Synonyms MUST be written in this language (BCP-47): {{learningLang}}.
  Do NOT translate synonyms into {{interfaceLang}}.
  Include as many as are genuinely relevant — do not invent synonyms if few exist.
  Do NOT include the original word itself in the synonyms array.

Do NOT add any explanation, notes, or extra fields outside the JSON.`,
  },

  // ── Vocabulary games ───────────────────────────────────────────────────
  {
    id: "word-ladder-generate-prompt",
    name: "Word Ladder Puzzle Generation Prompt",
    description: "Builds the AI prompt used to generate a Word Ladder puzzle (a chain of same-length words each differing by one letter) when the cached puzzle pool has no unseen puzzle for the dialect pair.",
    category: "vocabulary-games",
    status: "active",
    sourceFile: "src/services/wordLadderService.js",
    sourceFunction: "_generateFromAI",
    variables: [
      { name: "learningDialect", description: "BCP-47 target/learning language" },
      { name: "userDialect", description: "BCP-47 interface/native language, used for clues" },
      { name: "minWords", description: "Minimum chain length (constant: 4)" },
      { name: "maxWords", description: "Maximum chain length (constant: 6)" },
    ],
    template: `You are generating a "Word Ladder" language-learning puzzle in {{learningDialect}}.

Rules:
- Generate a chain of {{minWords}}–{{maxWords}} words, all the SAME length (4–6 letters preferred).
- Each adjacent pair of words must differ by EXACTLY ONE letter.
- Every word must be a real, standalone dictionary word in {{learningDialect}}.
- No proper nouns, no abbreviations, no vulgar words.
- For each word, provide a SHORT clue/definition in {{userDialect}} (max 8 words).
- "words" array and "clues" array must have the same length.
- "wordLength" must be the letter count of each word (they are all the same).

Return JSON with keys: words (string[]), clues (string[]), wordLength (number).`,
  },

  {
    id: "word-link-generate-prompt",
    name: "Word Link Puzzle Generation Prompt",
    description: "Builds the AI prompt used to generate a Word Link puzzle (a hidden theme guessed from a sequence of clue words) when the cached puzzle pool has no unseen puzzle for the dialect pair.",
    category: "vocabulary-games",
    status: "active",
    sourceFile: "src/services/wordLinkService.js",
    sourceFunction: "_generateFromAI",
    variables: [
      { name: "learningDialect", description: "BCP-47 target/learning language, used for clue words" },
      { name: "userDialect", description: "BCP-47 interface/native language, used for the theme" },
    ],
    template: `You are generating a "Word Link" language-learning puzzle.

The puzzle consists of:
- A hidden THEME (2–5 words) describing a category, e.g. "Names of fruits"
- Exactly 5 CLUE WORDS in {{learningDialect}} that belong to that category,
  ordered from hardest to easiest (last clue = most obvious giveaway)
- ACCEPTED KEYWORDS: single words a learner could type to correctly guess the theme

Rules:
- All 5 clue words must be in {{learningDialect}}
- "theme" must be in {{userDialect}}
- "themeTranslation" must be the same theme expressed in {{learningDialect}}
- "keywords" must include the key noun(s) from the theme in BOTH {{userDialect}} AND {{learningDialect}},
  including singular and plural forms of each
  e.g. for "Names of fruits": ["fruit", "fruits", "fruta", "frutas"]
- Clues must be genuine members of the theme category
- First clue = least obvious, last clue = most obvious
- Provide at least 4 accepted keywords (both languages, singular + plural)`,
  },

  {
    id: "get-word-translate-concept-prompt",
    name: "Word Pool — Translate Existing Concept Prompt",
    description: "Builds the AI prompt used to translate an existing English word-pool concept into the learner's target dialect, with an optional character-length constraint (used by length-limited games like Hangman).",
    category: "vocabulary-games",
    status: "active",
    sourceFile: "src/services/getWordService.js",
    sourceFunction: "_generateTranslation",
    variables: [
      { name: "sourceWord", description: "The canonical English word for this concept" },
      { name: "learningDialect", description: "BCP-47 target/learning language" },
      { name: "userDialect", description: "BCP-47 interface/native language, used for the hint" },
      { name: "lengthConstraintLine", description: "Optional line enforcing a max character length, blank when maxLength isn't set" },
    ],
    template: `You are a language learning assistant.
Translate the English word "{{sourceWord}}" into {{learningDialect}}.
{{lengthConstraintLine}}
Return a JSON object with:
  - "word": the translated word in {{learningDialect}}, lowercase, no extra spaces.
  - "hint": one sentence in {{userDialect}} describing the word without saying it, suitable for a guessing game.
Return ONLY valid JSON. No markdown, no explanation.`,
  },

  {
    id: "get-word-generate-hint-prompt",
    name: "Word Pool — Generate Hint for Dialect Prompt",
    description: "Builds the AI prompt used to generate a single hint sentence in a dialect that doesn't have one yet for an existing word-pool concept.",
    category: "vocabulary-games",
    status: "active",
    sourceFile: "src/services/getWordService.js",
    sourceFunction: "_generateHintForDialect",
    variables: [
      { name: "userDialect", description: "BCP-47 language the hint must be written in" },
      { name: "sourceWord", description: "The canonical English word being hinted at" },
    ],
    template: `You are a language learning assistant.
Write exactly one sentence in {{userDialect}} that describes the word "{{sourceWord}}" without saying it.
The sentence should be suitable as a hint in a word-guessing game.
Return a JSON object with a single "hint" field.
Return ONLY valid JSON. No markdown, no explanation.`,
  },

  {
    id: "get-word-generate-new-concept-prompt",
    name: "Word Pool — Generate New Concept Prompt",
    description: "Builds the AI prompt used to generate a brand-new vocabulary word + translation + hint when a user has already seen every concept currently in the word pool for their dialect pair.",
    category: "vocabulary-games",
    status: "active",
    sourceFile: "src/services/getWordService.js",
    sourceFunction: "_generateNewConcept",
    variables: [
      { name: "learningDialect", description: "BCP-47 target/learning language" },
      { name: "userDialect", description: "BCP-47 interface/native language, used for the hint" },
      { name: "lengthConstraintLine", description: "Optional line enforcing a max character length, blank when maxLength isn't set" },
      { name: "avoidListLine", description: "Optional 'Do NOT use any of these...' line listing already-known words, blank when the pool is empty" },
    ],
    template: `You are a language learning assistant.
Generate exactly ONE common vocabulary word.
{{lengthConstraintLine}}
Return a JSON object with:
  - "sourceWord": the English label for the concept, lowercase.
  - "word": the translation in {{learningDialect}}, lowercase.
  - "hint": one sentence in {{userDialect}} describing the word without saying it, suitable for a guessing game.
{{avoidListLine}}
Return ONLY valid JSON. No markdown, no explanation.`,
  },

  // ── Audio ──────────────────────────────────────────────────────────────
  {
    id: "tts-build-prompt",
    name: "TTS Dialect Instruction Prompt",
    description: "Wraps raw text with accent/pronunciation instructions before sending it to Gemini TTS, so playback uses the correct regional accent regardless of the text content.",
    category: "audio",
    status: "active",
    sourceFile: "src/services/getTtsService.js",
    sourceFunction: "_buildTtsPrompt",
    variables: [
      { name: "language", description: "Human-readable language/dialect name (looked up from LOCALE_METADATA by locale)" },
      { name: "region", description: "Human-readable region name (looked up from LOCALE_METADATA by locale)" },
      { name: "text", description: "The raw text to be read aloud, appended unmodified" },
    ],
    template: `You are a native {{language}} speaker from {{region}}. Please read the following text aloud in a clear and natural tone, using the accent and pronunciation typical of {{region}}. Do not translate, summarize, or modify the text in any way — read it exactly as written.

{{text}}`,
  },

  {
    id: "image-multiple-choice-prompt",
    name: "Image Multiple Choice Exercise Prompt",
    description: "Builds the AI prompt for generating an image-based multiple-choice reading exercise. Not currently called by any UI — ImageMultipleChoiceExercise.generatePrompt() has no call sites yet.",
    category: "exams",
    status: "unused",
    sourceFile: "src/components/exercises/ImageMultipleChoiceExercise.jsx",
    sourceFunction: "ImageMultipleChoiceExercise.generatePrompt",
    variables: [
      { name: "level", description: "CEFR level (A1-C2)" },
      { name: "targetLang", description: "Target language name" },
    ],
    template: `Generate an image-based multiple choice reading comprehension exercise in {{targetLang}} for CEFR level {{level}}.
CRITICAL: All text content must be written entirely in {{targetLang}}.
Each question should describe a scenario or image context (e.g. a classroom, a market, a family dinner) that the student can visualise.
Follow with 4-6 questions, each with 4 options. Only one correct answer per question.
Return a JSON object with:
  - "imageUrl": "" (empty string, images are handled by the platform)
  - "imageAlt": a short alt text describing the image in {{targetLang}}
  - "questions": array of { id, text, options[], correctAnswer }
Return ONLY valid JSON. No markdown, no explanation.`,
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch every prompt document from appConfig/config/prompts.
 * @returns {Promise<Array<object>>}
 */
export async function getPrompts() {
  const result = await queryCollection(PROMPTS_COLLECTION, {}, {});
  return result?.documents ?? [];
}

/**
 * Update fields on an existing prompt document, stamping version/updatedAt/updatedBy.
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
  return updateDocument(PROMPTS_COLLECTION, id, data);
}

/**
 * Create any DEFAULT_PROMPTS documents that don't already exist in Firestore.
 * Idempotent — safe to call more than once. This is the Phase 1 migration
 * mechanism (run from the Admin Page, no separate script/credentials needed).
 *
 * @param {Array<object>} existingDocs - Docs already loaded from getPrompts().
 * @returns {Promise<string[]>} IDs of the prompts that were created.
 */
export async function seedMissingPrompts(existingDocs) {
  const existingIds = new Set((existingDocs ?? []).map((d) => d.id));
  const missing = DEFAULT_PROMPTS.filter((p) => !existingIds.has(p.id));

  const now = new Date().toISOString();
  const created = [];
  for (const prompt of missing) {
    const { id, ...rest } = prompt;
    await createDocument(
      PROMPTS_COLLECTION,
      { ...rest, version: 1, createdAt: now, updatedAt: now, updatedBy: "system-migration" },
      id
    );
    created.push(id);
  }
  return created;
}
