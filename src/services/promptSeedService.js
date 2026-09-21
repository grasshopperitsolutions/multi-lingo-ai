/**
 * promptSeedService.js
 *
 * ⚠️ TEMPORARY — DELETE THIS FILE ONCE IT HAS BEEN RUN IN EVERY ENVIRONMENT.
 *
 * Creates prompt documents in `appConfig/config/prompts` that the app expects
 * to find. The Admin panel can edit prompts but has no create affordance, and
 * no sane way to paste a forty-line template without typos, so this exists to
 * be run once from Admin › Prompts and then removed with its button.
 *
 * It is not a permissions workaround: that collection is already
 * `{read: 'public', write: 'admin'}` and an admin POST already works. The only
 * thing missing is a button.
 *
 * **It never overwrites.** A document that already exists is skipped, so
 * running it twice is harmless and an admin's edits to a template are never
 * clobbered by a second press.
 *
 * Removal checklist:
 *   1. delete this file
 *   2. delete the seed button in components/admin/PromptsSection.jsx
 *   3. delete the handler in pages/AdminPage.jsx
 */

import { createDocument } from "./firestoreService";
import { PROMPTS_COLLECTION, getPrompts, clearPromptsCache } from "./promptService";

/**
 * The passage someone reads aloud.
 *
 * Two instructions here are worth more than they look. **No numerals** —
 * "1997" is a pronunciation exercise nobody asked for and it derails a reading
 * at A1. And **no dialogue or quotation marks**, because punctuation that
 * implies intonation turns a pronunciation test into a performance test.
 */
const PASSAGE_TEMPLATE = `Write a short passage in {{targetLang}} for a learner at CEFR level {{level}} to read aloud.

This is a pronunciation exercise, not a reading-comprehension one. Build it around the sounds learners of {{targetLang}} actually struggle with — the ones that do not exist in most other languages, or that are written one way and said another. Pick two or three of them and work them in repeatedly, but naturally.

Already in the collection — build yours around different sounds and different words:
{{avoidTexts}}

Language constraints for {{level}}:
{{grammarDescription}}

Rules:
- Exactly {{sentenceCount}} sentences, each short enough to say comfortably in one breath.
- Ordinary connected prose about something. Not a list of words, and not a tongue-twister: it has to be readable at a natural pace by somebody seeing it for the first time.
- Every word sits inside {{level}}. The difficulty is the sounds, never the vocabulary.
- No numerals — write any number as a word. No abbreviations, no acronyms, and no proper nouns a learner would have to guess at.
- No quotation marks and no dialogue. Punctuation should not make the reader guess at intonation.
- "focus" lists the two or three sounds you built it around, written the way a learner would recognise them — the letters or letter groups, not IPA.`;

/**
 * The feedback on that reading.
 *
 * **The boundaries in this template are legal, not stylistic.** §2.6 of the
 * privacy policy promises that recordings are used only to produce
 * pronunciation feedback and a transcript, that no voiceprint is made, that
 * the voice is not analysed to identify or distinguish anyone, and that no
 * emotion is inferred — and it names Illinois BIPA and Texas CUBI as the
 * reason. A template edited to ask "how confident do they sound" or "where is
 * this accent from" walks straight through that promise. Edit the wording
 * freely; leave the boundaries alone.
 *
 * The refusal case is explicit for the same reason it is elsewhere in this
 * app: a model asked to grade silence will otherwise grade what it assumes was
 * probably said.
 */
const FEEDBACK_TEMPLATE = `You are listening to a language learner read a passage aloud in {{targetLang}}. Their level is {{level}}.

This is the passage they were asked to read:
{{text}}

Transcribe what you actually hear, then compare it with the passage and comment on how the words were pronounced.

Boundaries — these are requirements, not preferences:
- Comment only on how the words were said. Say nothing about the speaker: not their gender, age, region of origin, mood, confidence, or anything about the sound of their voice as a voice.
- Do not try to identify the speaker, and do not describe or characterise their voice.
- If the recording is silent, unintelligible, or is not a reading of the passage above, say so in "summary", set "score" to 0 and leave "issues" empty. Never guess at what was probably said.

Rules:
- "transcript" is what you heard, written in {{targetLang}}, as it actually sounded — mistakes included. Do not quietly correct it towards the passage; the difference between the two is the whole point.
- "score" is 0-100 for this reading of this passage: how close the pronunciation came to how {{targetLang}} is really spoken. Be fair rather than kind — a learner who is understandable but plainly foreign sits around 70.
- "summary" is one or two sentences in {{explanationLang}}, honest and encouraging.
- "issues" holds at most {{maxIssues}} entries, worst first, and only for words genuinely mispronounced — not words merely spoken with an accent. "word" is the word as written in the passage, "heard" is how it came out, and "tip" is one short sentence in {{explanationLang}} that says how to fix it by naming the sound or the mouth position, rather than just repeating the word.
- A reading with nothing wrong gets an empty "issues" array. Do not invent a problem to fill it.`;

export const PROMPT_SEEDS = [
  {
    id: "pronunciation-passage-prompt",
    name: "Pronunciation — Passage to read",
    description:
      "Writes a short passage for a learner to read aloud, built around the sounds that are hard in their practice language. Pooled and shared: generated once per level and language, then reused.",
    sourceFile: "src/services/pronunciationService.js",
    sourceFunction: "getPassage",
    category: "pronunciation",
    status: "active",
    model: "",
    explorerModel: "",
    maxTokens: 1024,
    variables: [
      { name: "targetLang", description: "Language the passage is written in, e.g. pt-PT" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "sentenceCount", description: "How many sentences to write" },
      { name: "grammarDescription", description: "Level-appropriate grammar and tense guidance" },
      { name: "avoidTexts", description: "Passages already pooled for this level and language" },
    ],
    version: 1,
    template: PASSAGE_TEMPLATE,
  },
  {
    id: "pronunciation-feedback-prompt",
    name: "Pronunciation — Feedback on a reading",
    description:
      "Listens to a recording of someone reading the passage and returns a transcript, a score out of 100, a summary and up to six specific fixes. The recording is inline in the request and is stored nowhere. NOTE: the boundaries in this template are what keep the feature inside the privacy policy's promises (no voiceprint, no speaker analysis, no emotion inference) — reword the rest freely, leave those alone.",
    sourceFile: "src/services/pronunciationService.js",
    sourceFunction: "gradePronunciation",
    category: "pronunciation",
    status: "active",
    // Blank falls back to gemini-3.5-transcribe in the service. If feedback
    // comes back empty and only a transcript arrives, that model is
    // transcribing rather than following the rest of the instruction — set
    // this to gemini-3.8-flash, which is what Google's audio docs use for
    // listening tasks. No deploy needed either way.
    model: "",
    explorerModel: "",
    maxTokens: 2048,
    variables: [
      { name: "targetLang", description: "Language the passage is in, e.g. pt-PT" },
      { name: "explanationLang", description: "Language the summary and tips are written in" },
      { name: "level", description: "CEFR level: A1-C2" },
      { name: "text", description: "The passage the learner was asked to read" },
      { name: "maxIssues", description: "Cap on how many fixes to list" },
    ],
    version: 1,
    template: FEEDBACK_TEMPLATE,
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
