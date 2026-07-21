/**
 * aiService.js
 *
 * Centralized HTTP client for all /api/ask-ai calls.
 * Handles base URL, auth, timeout, and response envelope parsing.
 *
 * Returns `json.data` directly — each consumer service reads the fields
 * it needs (e.g. `.text` for text responses, `.audioUrl`/`.audioData`
 * for TTS, `.imageData` for images).
 *
 * Usage:
 *   import { askAI } from '../services/aiService';
 *
 *   // Text response
 *   const data = await askAI(token, prompt, { provider: 'gemini', model: 'gemini-3.5-flash-lite', ... });
 *   const text = data.text;
 *
 *   // TTS response
 *   const ttsData = await askAI(token, prompt, { provider: 'gemini', model: '...', tts: true, ... });
 *   // ttsData.audioUrl or ttsData.audioData
 *
 *   // Image response
 *   const imgData = await askAI(token, prompt, { provider: 'gemini', model: 'imagen-...' });
 *   // imgData.imageData, imgData.mimeType
 *
 *   // With timeout override
 *   const data = await askAI(token, prompt, params, { timeout: 60000 });
 *
 *   // With cancellation
 *   const ac = new AbortController();
 *   const data = await askAI(token, prompt, params, { signal: ac.signal });
 *   ac.abort(); // cancels the request
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const DEFAULT_TIMEOUT = 25000; // 25 seconds

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Make a request to the /api/ask-ai endpoint.
 *
 * @param {string}  token          - Firebase ID token
 * @param {string}  prompt         - The prompt text to send
 * @param {object}  providerParams - Provider configuration (provider, model, temperature, etc.)
 * @param {object}  [options]
 * @param {number}  [options.timeout=25000] - Request timeout in milliseconds
 * @param {AbortSignal} [options.signal]    - External abort signal for cancellation
 * @param {number}  [options.retries=0]     - Number of retry attempts on failure
 * @returns {Promise<object>} The `data` field from the API response envelope
 */
export async function askAI(token, prompt, providerParams, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, signal, retries = 0 } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine external signal with timeout signal
    const combinedSignal = signal
      ? _combineSignals(signal, controller.signal)
      : controller.signal;

    try {
      const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, providerParams }),
        signal: combinedSignal,
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.error || json?.message || `AI request failed (${response.status})`
        );
      }

      return json?.data ?? {};
    } catch (err) {
      lastError = err;

      // Don't retry if the request was explicitly aborted by the caller
      if (err.name === 'AbortError' && signal?.aborted) {
        throw err;
      }

      // Don't retry on the last attempt
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await _sleep(delay);
        continue;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError || new Error('AI request failed');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Combine two AbortSignals into one.
 * If either signal aborts, the combined signal aborts.
 */
function _combineSignals(signal1, signal2) {
  const controller = new AbortController();

  const onAbort = () => controller.abort();

  signal1.addEventListener('abort', onAbort, { once: true });
  signal2.addEventListener('abort', onAbort, { once: true });

  // Clean up listeners if the combined signal is already aborted
  if (controller.signal.aborted) {
    signal1.removeEventListener('abort', onAbort);
    signal2.removeEventListener('abort', onAbort);
  }

  return controller.signal;
}

/**
 * Promise-based sleep for retry backoff.
 */
function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}