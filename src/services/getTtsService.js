/**
 * getTtsService.js
 *
 * Text-to-Speech service with Gemini TTS as primary engine
 * and Web Speech API as fallback.
 *
 * Usage:
 *   import { speak, stopSpeaking } from '../services/getTtsService';
 *
 *   // Gemini TTS (primary)
 *   await speak('Olá mundo', 'pt-PT', { token: '...firebase-token...' });
 *
 *   // With explicit fallback
 *   await speak('Olá mundo', 'pt-PT', { token: '...', preferFallback: true });
 *
 *   // Web Speech API only (synchronous, no token needed)
 *   speak('Olá mundo', 'pt-PT', { useFallback: true });
 *
 *   stopSpeaking();  // Cancel any ongoing speech
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const WEB_SPEECH_RATE = 1.0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Speak `text` in `lang`.
 *
 * Uses Gemini TTS if a token is provided. Falls back to the Web Speech API
 * if Gemini fails or if `useFallback` is explicitly set.
 *
 * @param {string} text              - Text to speak
 * @param {string} lang              - BCP-47 locale, e.g. 'pt-PT', 'en-US'
 * @param {object} [options]
 * @param {string} [options.token]   - Firebase ID token (required for Gemini TTS)
 * @param {boolean} [options.useFallback] - Force Web Speech API only
 * @param {boolean} [options.preferFallback] - Try Gemini first, fall back on error
 * @returns {Promise<boolean>} true if speech succeeded
 */
export async function speak(text, lang, { token, useFallback = false, preferFallback = true } = {}) {
  if (!text?.trim()) return false;

  // Stop any ongoing speech first
  stopSpeaking();

  // Option A: Use Gemini TTS (primary, async)
  if (!useFallback && token) {
    try {
      const success = await _speakWithGemini(token, text, lang);
      if (success) return true;
      // Gemini failed silently — fall through to Web Speech if preferFallback
      if (!preferFallback) return false;
    } catch (err) {
      console.warn('[getTtsService] Gemini TTS failed, falling back to Web Speech API:', err.message);
      if (!preferFallback) return false;
    }
  }

  // Option B: Web Speech API (fallback, synchronous-like)
  _speakWithWebSpeech(text, lang);
  return true;
}

/**
 * Stop any currently playing speech (both Gemini and Web Speech API).
 */
export function stopSpeaking() {
  // Stop Web Speech API
  window.speechSynthesis?.cancel();

  // Stop any audio elements that may have been created by Gemini TTS
  document.querySelectorAll('audio[data-tts-audio]').forEach((el) => {
    el.pause();
    el.remove();
  });
}

// ---------------------------------------------------------------------------
// Gemini TTS (primary)
// ---------------------------------------------------------------------------

/**
 * Speak text using Gemini's TTS model via the proxy API.
 * The API returns audio data as base64, which we play via an Audio element.
 */
async function _speakWithGemini(token, text, lang) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: text,
      providerParams: {
        provider: 'gemini',
        model: GEMINI_TTS_MODEL,
        // TTS-specific parameters
        language: lang,
        // The response will be audio data (base64 or stream)
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Gemini TTS failed');
  }

  // Expected response shape: { data: { audioData: "<base64>", mimeType: "audio/wav" } }
  // or { data: { audioUrl: "https://..." } }
  const result = json?.data ?? json;

  if (result?.audioUrl) {
    // Play from URL
    return _playAudioUrl(result.audioUrl);
  }

  if (result?.audioData) {
    // Play from base64
    return _playAudioBase64(result.audioData, result.mimeType || 'audio/wav');
  }

  // If the response is a direct stream/buffer, we may get it as raw bytes
  // Check for alternative response shapes
  if (json?.audioData || json?.audioUrl) {
    const altResult = json;
    if (altResult.audioUrl) return _playAudioUrl(altResult.audioUrl);
    if (altResult.audioData) return _playAudioBase64(altResult.audioData, altResult.mimeType || 'audio/wav');
  }

  console.warn('[getTtsService] Unexpected Gemini TTS response shape', result);
  return false;
}

/**
 * Play audio from a URL by creating an Audio element.
 * Returns a promise that resolves when playback completes.
 */
function _playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.dataset.ttsAudio = 'true';
    audio.onended = () => resolve(true);
    audio.onerror = (err) => {
      console.warn('[getTtsService] Audio playback error:', err);
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      console.warn('[getTtsService] Audio play() failed:', err);
      reject(err);
    });
  });
}

/**
 * Play audio from a base64-encoded data string.
 */
function _playAudioBase64(base64Data, mimeType) {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return _playAudioUrl(dataUrl);
}

// ---------------------------------------------------------------------------
// Web Speech API (fallback)
// ---------------------------------------------------------------------------

/**
 * Speak text using the browser's built-in Speech Synthesis API.
 * This is synchronous in the sense that it returns immediately,
 * but the actual speech plays asynchronously.
 */
function _speakWithWebSpeech(text, lang) {
  if (!window.speechSynthesis) {
    console.warn('[getTtsService] Web Speech API not available in this browser');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = WEB_SPEECH_RATE;

  // Mark the utterance so we can track cancellations
  window.speechSynthesis.speak(utterance);
}