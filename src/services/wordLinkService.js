const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const MAX_CLUES = 5;

/**
 * Generates a Word Link puzzle via Gemini AI.
 *
 * @param {object} params
 * @param {string} params.token           - Firebase ID token
 * @param {string} params.userDialect     - BCP-47 interface language (e.g. 'en-US')
 * @param {string} params.learningDialect - BCP-47 learning language (e.g. 'pt-PT')
 * @returns {Promise<{ theme: string, clues: string[], keywords: string[] }>}
 */
export const fetchWordLinkPuzzle = async ({ token, userDialect, learningDialect }) => {
  const prompt = `You are generating a "Word Link" language-learning puzzle.

The puzzle consists of:
- A hidden THEME (2–5 words, e.g. "Names of insects")
- Up to 5 CLUE WORDS in ${learningDialect} that all belong to that theme, ordered from hardest to easiest (the last clue should be the most obvious giveaway)
- A list of ACCEPTED KEYWORDS — single words (in ${userDialect}) that a learner could type to correctly guess the theme (e.g. ["insects", "bugs", "bug"])

Rules:
- All clue words must be in ${learningDialect}
- The theme and accepted keywords must be in ${userDialect}
- Clues must be genuine members of the theme category
- First clue = least obvious, last clue = most obvious
- Return ONLY valid JSON, no markdown, no explanation

Return exactly this JSON shape:
{
  "theme": "Names of insects",
  "clues": ["Mosca", "Grilo", "Besouro de Junho", "Louva-a-deus", "Pirilampo"],
  "keywords": ["insects", "bugs", "bug", "insect"]
}`;

  const res = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.9,
      },
    }),
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j?.error || j?.message || 'Failed to generate Word Link puzzle');
  }

  const json    = await res.json();
  const raw     = json?.data?.text ?? json?.text ?? '';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed  = JSON.parse(cleaned);

  if (!parsed.theme || !Array.isArray(parsed.clues) || !Array.isArray(parsed.keywords)) {
    throw new Error('Invalid puzzle format from AI');
  }

  return {
    theme:    parsed.theme,
    clues:    parsed.clues.slice(0, MAX_CLUES),
    keywords: parsed.keywords,
  };
};
