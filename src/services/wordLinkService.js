const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-3.5-flash';
const MAX_CLUES    = 5;

/**
 * Generates a Word Link puzzle via Gemini AI.
 *
 * Uses jsonMode + responseSchema (same pattern as getWordService.js) so the
 * response is guaranteed to be structured JSON — no manual fence-stripping needed.
 *
 * @param {object} params
 * @param {string} params.token           - Firebase ID token
 * @param {string} params.userDialect     - BCP-47 interface language (e.g. 'en-US')
 * @param {string} params.learningDialect - BCP-47 learning language (e.g. 'pt-PT')
 * @returns {Promise<{ theme: string, clues: string[], keywords: string[] }>}
 */
export const fetchWordLinkPuzzle = async ({ token, userDialect, learningDialect }) => {
  const prompt = [
    `You are generating a "Word Link" language-learning puzzle.`,
    ``,
    `The puzzle consists of:`,
    `- A hidden THEME (2–5 words, e.g. "Names of insects")`,
    `- Exactly 5 CLUE WORDS in ${learningDialect} that all belong to that theme,`,
    `  ordered from hardest to easiest (last clue = most obvious giveaway)`,
    `- A list of ACCEPTED KEYWORDS — single words in ${userDialect} that correctly`,
    `  identify the theme (e.g. ["insects", "bugs", "bug", "insect"])`,
    ``,
    `Rules:`,
    `- All clue words must be in ${learningDialect}`,
    `- The theme and accepted keywords must be in ${userDialect}`,
    `- Clues must be genuine members of the theme category`,
    `- First clue = least obvious, last clue = most obvious`,
    `- Provide at least 2 accepted keywords (singular + plural at minimum)`,
  ].join('\n');

  const res = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.9,
        jsonMode:    true,
        responseSchema: {
          type: 'object',
          properties: {
            theme:    { type: 'string' },
            clues:    { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
          },
          required: ['theme', 'clues', 'keywords'],
        },
      },
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || j?.message || 'Failed to generate Word Link puzzle');
  }

  const json   = await res.json();
  const parsed = JSON.parse(json?.data?.text ?? json?.text ?? '{}');

  if (!parsed.theme || !Array.isArray(parsed.clues) || !Array.isArray(parsed.keywords)) {
    throw new Error('Invalid puzzle format from AI');
  }

  return {
    theme:    parsed.theme,
    clues:    parsed.clues.slice(0, MAX_CLUES),
    keywords: parsed.keywords,
  };
};
