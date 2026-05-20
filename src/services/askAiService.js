import { auth } from '../firebase';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

// ---------------------------------------------------------------------------
// Helper: resolve a fresh ID token, throwing a clear error if not authed
// ---------------------------------------------------------------------------
async function getToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('[askAiService] No authenticated user');
  return user.getIdToken();
}

// ---------------------------------------------------------------------------
// callAskAI
// ---------------------------------------------------------------------------

/**
 * Send a request to POST /api/ask-ai and return the parsed AI response.
 *
 * @param {import('../challenges-services/types').AskAIRequest} payload
 * @param {string} [token] - Optional pre-fetched Firebase ID token.
 * @returns {Promise<import('../challenges-services/types').AskAIResponse>}
 *
 * @example
 * const result = await callAskAI({
 *   prompt: 'Give me a word in Spanish',
 *   providerParams: {
 *     provider: 'gemini',
 *     model: 'gemini-2.0-flash',
 *     temperature: 0.9,
 *     jsonMode: true,
 *   },
 * });
 * console.log(result.text); // raw JSON string from Gemini
 */
export async function callAskAI(payload, token) {
  const idToken = token ?? (await getToken());

  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[askAiService] Request failed (${response.status})`
    );
  }

  // API envelope: { success: true, data: AskAIResponse }
  return json.data;
}
