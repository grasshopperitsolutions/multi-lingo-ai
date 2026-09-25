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
 *   const data = await askAI(token, prompt, params, { timeout: 30000 });
 *
 *   // With cancellation
 *   const ac = new AbortController();
 *   const data = await askAI(token, prompt, params, { signal: ac.signal });
 *   ac.abort(); // cancels the request
 */

import i18next from 'i18next';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const DEFAULT_TIMEOUT = 25000; // 25 seconds (up to 120 seconds as per api limit)

// ---------------------------------------------------------------------------
// Generation confirmation
//
// Every call through here spends one of the user's daily AI allowance, so the
// app asks before spending it. The handler is registered from AppContext (the
// same pattern i18n uses for registerMissingKeyHandler) because the decision
// needs a modal, which a service can't render.
//
// Calls that aren't the user asking for new content pass `skipConfirm: true`:
// background translation back-fill, and TTS playback (already cached per clip,
// and prompting mid-exercise to hear a sentence would be unusable).
// ---------------------------------------------------------------------------

let _confirmHandler = null;

/**
 * Register the confirmation prompt shown before a billable AI call.
 *
 * @param {null|(() => Promise<boolean>)} fn - Resolves true to proceed.
 */
export function registerAiConfirmHandler(fn) {
  _confirmHandler = typeof fn === 'function' ? fn : null;
}

/**
 * True when an error is the user declining the generation prompt rather than a
 * real failure. Call sites use this to bail out quietly instead of showing an
 * error banner for something the user chose.
 */
export function isAiDeclined(err) {
  return Boolean(err?.declined);
}

// ---------------------------------------------------------------------------
// Usage
//
// A counted call comes back with the server's count (`data.usage`), and so
// does the daily-limit refusal. AppContext registers a handler that mirrors
// it into the profile, so the meter is the server's number rather than the
// one read at sign-in. Same registration pattern as the confirm handler.
// ---------------------------------------------------------------------------

let _usageHandler = null;

/**
 * @param {null|((usage: {aiCallsToday: number, aiCallsDate: string, aiCallsPerDay: number}) => void)} fn
 */
export function registerAiUsageHandler(fn) {
  _usageHandler = typeof fn === 'function' ? fn : null;
}

function _reportUsage(usage) {
  if (!_usageHandler || !usage || typeof usage.aiCallsToday !== 'number') return;
  try {
    _usageHandler(usage);
  } catch (err) {
    console.warn('[aiService] usage handler failed', err);
  }
}

/** True when an error is the daily AI allowance being used up. */
export function isDailyLimit(err) {
  return err?.code === 'DAILY_LIMIT';
}

/** Thrown when the user declines the generation prompt. */
export class AiGenerationDeclined extends Error {
  constructor() {
    super('AI generation declined by user');
    this.name = 'AiGenerationDeclined';
    this.declined = true;
  }
}

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
 * @param {boolean} [options.skipConfirm]    - Bypass the generation prompt for
 *   background/system calls the user didn't explicitly ask for.
 * @param {Array<{data: string, mimeType: string}>} [options.images] - Pictures
 *   for the model to look at. Gemini only; base64 without a `data:` prefix.
 * @param {Array<{data: string, mimeType: string}>} [options.audio] - One
 *   recording for the model to listen to. Same terms as `images`.
 * @returns {Promise<object>} The `data` field from the API response envelope
 * @throws {AiGenerationDeclined} If the user declines the generation prompt.
 */
export async function askAI(token, prompt, providerParams, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, signal, retries = 0, skipConfirm = false, images, audio } = options;

  if (!skipConfirm && _confirmHandler) {
    const proceed = await _confirmHandler();
    if (!proceed) throw new AiGenerationDeclined();
  }

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
        // Each attachment key is omitted rather than sent as undefined: the
        // endpoint validates a field whenever it is present, and an empty
        // array would be rejected on a non-gemini provider for no reason.
        body: JSON.stringify({
          prompt,
          providerParams,
          ...(images?.length ? { images } : {}),
          ...(audio?.length ? { audio } : {}),
        }),
        signal: combinedSignal,
      });

      const json = await response.json();

      if (!response.ok) {
        // The app's own allowance, not a provider's rate limit (also a 429):
        // correct the meter and say it in the reader's language. The server's
        // English text is only the fallback before translations load.
        if (json?.code === 'DAILY_LIMIT') {
          _reportUsage(json.usage);
          const limitError = new Error(
            i18next.t('ai_usage.limit_reached', { defaultValue: json?.error || 'Daily AI limit reached.' })
          );
          limitError.code = 'DAILY_LIMIT';
          throw limitError;
        }
        throw new Error(
          json?.error || json?.message || `AI request failed (${response.status})`
        );
      }

      _reportUsage(json?.data?.usage);
      return json?.data ?? {};
    } catch (err) {
      lastError = err;

      // Don't retry if the request was explicitly aborted by the caller
      if (err.name === 'AbortError' && signal?.aborted) {
        throw err;
      }

      // Nor when the allowance is spent: a retry only asks again.
      if (isDailyLimit(err)) {
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