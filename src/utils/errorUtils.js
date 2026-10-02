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

// ── isSessionExpiredError ─────────────────────────────────────────────────

/**
 * Whether the API refused a request for its sign-in token: 401 "Invalid or
 * expired token" (lib/verify-auth.ts), which the services rethrow as the
 * error's message. What to do about it is hooks/useSessionRecovery's job.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isSessionExpiredError(err) {
  const msg = (err?.message ?? '').toLowerCase();
  return msg.includes('expired token') || msg.includes('invalid or expired');
}

// ── sanitizeAIError ───────────────────────────────────────────────────────

/**
 * Replaces any error message that leaks an AI provider name
 * (Gemini, OpenAI, Anthropic, etc.) with a generic
 * user-friendly message, and a refused sign-in token (English, and
 * meaningless to the user) with the fallback.
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
  if (isSessionExpiredError({ message: msg })) return fallback;

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
