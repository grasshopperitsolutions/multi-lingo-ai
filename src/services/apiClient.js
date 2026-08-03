/**
 * apiClient.js
 *
 * Shared fetch wrapper for the backend proxy API. Every endpoint wraps its
 * payload as { success: true, data: T } (see successResponse() in the
 * multi-lingo-ai-api repo's lib/response.ts) or { success: false, error }
 * on failure. Centralizing that here means a call site can no longer read
 * from the wrong level — that's exactly how createCheckoutSession() shipped
 * reading json.url instead of json.data.url and silently broke checkout.
 */

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/**
 * Fetch a JSON endpoint on the backend proxy and unwrap its {success,data} envelope.
 *
 * @param {string} path - Path relative to the proxy origin, e.g. '/api/stripe'.
 * @param {RequestInit & { body?: any }} [options] - Standard fetch options.
 *   A plain-object `body` is JSON-stringified automatically; pass a string,
 *   FormData, or Blob to send it as-is.
 * @param {string} [fallbackErrorMessage] - Used when the API didn't send its own error text.
 * @returns {Promise<any>} The unwrapped `data` payload (undefined if the API sent none).
 * @throws {Error} When the response isn't ok, or the envelope reports failure.
 */
export async function apiFetch(path, options = {}, fallbackErrorMessage = 'Request failed') {
  const { body, headers, ...rest } = options;
  const isPlainBody = body != null && typeof body === 'object'
    && !(body instanceof FormData) && !(body instanceof Blob);

  const response = await fetch(`${PROXY_URL}${path}`, {
    ...rest,
    headers: isPlainBody ? { 'Content-Type': 'application/json', ...headers } : headers,
    body: isPlainBody ? JSON.stringify(body) : body,
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || fallbackErrorMessage);
  }

  return json?.data;
}
