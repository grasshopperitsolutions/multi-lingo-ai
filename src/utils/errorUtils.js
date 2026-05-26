/**
 * errorUtils.js
 *
 * Shared error-handling utilities for the Multi-Lingo AI frontend.
 * Keep provider-specific details away from the user.
 */

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
