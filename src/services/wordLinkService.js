const PROXY_URL    = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_CLUES    = 5;

/**
 * Generates a Word Link puzzle via Gemini AI.
 *
 * Returns:
 *   - theme            : theme label in userDialect  (e.g. "Names of fruits")
 *   - themeTranslation : theme label in learningDialect (e.g. "Nomes de frutas")
 *   - clues            : 5 clue words in learningDialect, hardest → easiest
 *   - keywords         : accepted answer words in BOTH userDialect AND learningDialect
 *                        (singular + plural for each)
 *
 * @param {object} params
 * @param {string} params.token           - Firebase ID token
 * @param {string} params.userDialect     - BCP-47 interface language (e.g. 'en-US')
 * @param {string} params.learningDialect - BCP-47 learning language (e.g. 'pt-PT')
 * @returns {Promise<{ theme: string, themeTranslation: string, clues: string[], keywords: string[] }>}
 */
export const fetchWordLinkPuzzle = async ({ token, userDialect, learningDialect }) => {
  const prompt = [
    `You are generating a "Word Link" language-learning puzzle.`,
    ``,
    `The puzzle consists of:`,
    `- A hidden THEME (2–5 words) describing a category, e.g. "Names of fruits"`,
    `- Exactly 5 CLUE WORDS in ${learningDialect} that belong to that category,`,
    `  ordered from hardest to easiest (last clue = most obvious giveaway)`,
    `- ACCEPTED KEYWORDS: single words a learner could type to correctly guess the theme`,
    ``,
    `Rules:`,
    `- All 5 clue words must be in ${learningDialect}`,
    `- "theme" must be in ${userDialect}`,
    `- "themeTranslation" must be the same theme expressed in ${learningDialect}`,
    `- "keywords" must include the key noun(s) from the theme in BOTH ${userDialect} AND ${learningDialect},`,
    `  including singular and plural forms of each`,
    `  e.g. for "Names of fruits": ["fruit", "fruits", "fruta", "frutas"]`,
    `- Clues must be genuine members of the theme category`,
    `- First clue = least obvious, last clue = most obvious`,
    `- Provide at least 4 accepted keywords (both languages, singular + plural)`,
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
            theme:             { type: 'string' },
            themeTranslation:  { type: 'string' },
            clues:             { type: 'array', items: { type: 'string' } },
            keywords:          { type: 'array', items: { type: 'string' } },
          },
          required: ['theme', 'themeTranslation', 'clues', 'keywords'],
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

  if (!parsed.theme || !parsed.themeTranslation || !Array.isArray(parsed.clues) || !Array.isArray(parsed.keywords)) {
    throw new Error('Invalid puzzle format from AI');
  }

  return {
    theme:            parsed.theme,
    themeTranslation: parsed.themeTranslation,
    clues:            parsed.clues.slice(0, MAX_CLUES),
    keywords:         parsed.keywords,
  };
};
