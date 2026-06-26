/**
 * errorUtils.js
 *
 * Shared error-handling utilities for the Multi-Lingo AI frontend.
 * Keep provider-specific details away from the user.
 */

// ── authFetch ─────────────────────────────────────────────────────────────

/**
 * A thin wrapper around `fetch` that detects 401 (Unauthorized) responses
 * and triggers the global session-expired handler.
 *
 * Usage — drop-in replacement for `fetch`:
 *   import { authFetch } from "../utils/errorUtils";
 *   const res = await authFetch(url, options);
 *
 * The second parameter `onTokenExpired` is a callback that should call
 * handleTokenExpired() from AppContext.  It is only invoked once per 401
 * to avoid spamming the user with multiple alerts.
 *
 * @param {string|URL} url
 * @param {RequestInit} [options]
 * @param {Function}    [onTokenExpired] - called when a 401 is received
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options, onTokenExpired) {
  const response = await fetch(url, options);

  if (response.status === 401 && onTokenExpired) {
    onTokenExpired();
  }

  return response;
}

// ── sanitizeAIError ───────────────────────────────────────────────────────

/**
 * Replaces any error message that leaks an AI provider name
 * (Gemini, OpenAI, Perplexity, Anthropic, etc.) with a generic
 * user-friendly message.
 *
 * @param {string|null|undefined} message - Raw error message from the API
 * @param {string} [fallback]             - Default when message is empty
 * @returns {string}
 */
export function sanitizeAIError(
  message,
  fallback = 'Something went wrong. Please try again.'
) {
  const msg = (message ?? '').trim();
  if (!msg) return fallback;

  const lower = msg.toLowerCase();
  const providerKeywords = [
    'gemini',
    'openai',
    'open ai',
    'perplexity',
    'anthropic',
    'claude',
    'gpt',
    'vertex',
    'palm',
    'mistral',
    'cohere',
    'groq',
  ];

  const leaksProvider = providerKeywords.some((kw) => lower.includes(kw));
  if (leaksProvider) return 'AI request failed. Please try again.';

  return msg;
}

// ── RateLimitError ────────────────────────────────────────────────────────

/**
 * Thrown by any AI service when the backend returns HTTP 429.
 * Caught by `useRateLimitHandler` to show the upgrade alert instead
 * of a generic error message.
 *
 * Usage in services:
 *   import { RateLimitError } from "../utils/errorUtils";
 *   if (response.status === 429) throw new RateLimitError(json?.error);
 *
 * Usage in components:
 *   import { RateLimitError } from "../utils/errorUtils";
 *   if (err instanceof RateLimitError) { ... }
 */
export class RateLimitError extends Error {
  constructor(message = 'Daily AI limit reached') {
    super(message);
    this.name = 'RateLimitError';
  }
}
