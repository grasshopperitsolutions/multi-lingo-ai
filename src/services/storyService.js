/**
 * storyService.js
 *
 * Generates a short story that naturally weaves in a set of vocabulary words,
 * using the /api/ask-ai proxy backed by Gemini 2.5 Flash (JSON mode).
 *
 * - The story is written in `learningLang`.
 * - The translation is written in `interfaceLang`.
 * - The difficulty controls sentence complexity and vocabulary register.
 *
 * Usage:
 *   import { generateStory } from '../services/storyService';
 *
 *   const { storyText, translation, wordsUsed } = await generateStory({
 *     token:         user.token,
 *     words:         ['efémero', 'saudade', 'caminhar'],
 *     learningLang:  'pt-PT',
 *     interfaceLang: 'en-US',
 *     level:         'intermediate',
 *   });
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {'beginner' | 'intermediate' | 'advanced'} DifficultyLevel
 */

/**
 * @typedef {Object} GenerateStoryParams
 * @property {string}          token         - Firebase ID token
 * @property {string[]}        words         - Vocabulary words to weave into the story
 * @property {string}          learningLang  - BCP-47 locale for the story, e.g. 'pt-PT'
 * @property {string}          interfaceLang - BCP-47 locale for the translation, e.g. 'en-US'
 * @property {DifficultyLevel} [level]       - Story complexity level (default: 'intermediate')
 */

/**
 * @typedef {Object} StoryResult
 * @property {string}   storyText   - The full story written in learningLang
 * @property {string}   translation - The story translated into interfaceLang
 * @property {string[]} wordsUsed   - Subset of the requested words that appear in the story
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-2.5-flash';

const LEVEL_INSTRUCTIONS = {
  beginner: [
    'Use very short, simple sentences (max 8 words each).',
    'Use only common, everyday vocabulary. Avoid idioms or complex grammar.',
    'The story should be 4–6 sentences long.',
  ],
  intermediate: [
    'Use moderately complex sentences with some variety in structure.',
    'You may use common idioms where natural, but keep them accessible.',
    'The story should be 6–9 sentences long.',
  ],
  advanced: [
    'Use rich, varied sentence structures including subordinate clauses.',
    'You may use idiomatic expressions, literary devices, and nuanced vocabulary.',
    'The story should be 8–12 sentences long.',
  ],
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    storyText:   { type: 'string' },
    translation: { type: 'string' },
    wordsUsed:   { type: 'array', items: { type: 'string' } },
  },
  required: ['storyText', 'translation', 'wordsUsed'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats the word list for the prompt in a human-readable way.
 * e.g. ['olá', 'comer', 'casa'] → '"olá", "comer", "casa"'
 * @param {string[]} words
 * @returns {string}
 */
function formatWordList(words) {
  return words.map((w) => `"${w.trim()}"`).join(', ');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a short story that incorporates the given vocabulary words.
 *
 * @param {GenerateStoryParams} params
 * @returns {Promise<StoryResult>}
 */
export async function generateStory({
  token,
  words,
  learningLang,
  interfaceLang,
  level = 'intermediate',
}) {
  // — Input validation —
  if (!token)                          throw new Error('[storyService] token is required');
  if (!Array.isArray(words) || words.length === 0)
    throw new Error('[storyService] words must be a non-empty array');
  if (!learningLang)                   throw new Error('[storyService] learningLang is required');
  if (!interfaceLang)                  throw new Error('[storyService] interfaceLang is required');

  const resolvedLevel = LEVEL_INSTRUCTIONS[level] ? level : 'intermediate';
  const levelLines    = LEVEL_INSTRUCTIONS[resolvedLevel];
  const wordList      = formatWordList(words);

  const prompt = [
    `You are a creative language-learning story writer.`,
    ``,
    `Write a short, engaging, coherent story in this language (BCP-47): ${learningLang}.`,
    `The story must naturally incorporate as many of the following vocabulary words as possible:`,
    `${wordList}`,
    ``,
    `Difficulty level: ${resolvedLevel}`,
    ...levelLines,
    ``,
    `Rules:`,
    `- The story must be a single cohesive narrative with a clear beginning and end.`,
    `- Do NOT list the words separately. Weave them naturally into the prose.`,
    `- Do NOT add a title to the story.`,
    `- If a word cannot be incorporated naturally, leave it out — do not force it.`,
    ``,
    `Return a JSON object with exactly three fields:`,
    ``,
    `- "storyText": the full story written in ${learningLang}.`,
    `- "translation": a faithful translation of the story into ${interfaceLang}.`,
    `  Translate the full story — do not summarise or paraphrase.`,
    `- "wordsUsed": an array containing only the words from the input list that`,
    `  actually appear in the story (use the exact forms provided in the input list,`,
    `  not inflected forms).`,
    ``,
    `Do NOT add any explanation, notes, or extra fields outside the JSON.`,
  ].join('\n');

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:       'gemini',
        model:          GEMINI_MODEL,
        temperature:    0.8,   // Higher than translator/dictionary for creative variety
        jsonMode:       true,
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[storyService] Request failed (${response.status})`
    );
  }

  // API envelope: { success: true, data: { text: string | object, ... } }
  const raw = json?.data?.text ?? json?.text ?? '';

  if (!raw) throw new Error('[storyService] Empty response returned');

  let parsed;
  try {
    parsed = typeof raw === 'object' ? raw : JSON.parse(raw);
  } catch {
    throw new Error('[storyService] Could not parse AI response as JSON');
  }

  const storyText   = (parsed?.storyText   ?? '').trim();
  const translation = (parsed?.translation ?? '').trim();
  const wordsUsed   = Array.isArray(parsed?.wordsUsed)
    ? parsed.wordsUsed.map((w) => String(w).trim()).filter(Boolean)
    : [];

  if (!storyText)   throw new Error('[storyService] No story text returned');
  if (!translation) throw new Error('[storyService] No translation returned');

  return { storyText, translation, wordsUsed };
}
