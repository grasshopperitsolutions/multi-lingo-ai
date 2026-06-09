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
 *   // With lifecycle callbacks
 *   speak('Olá mundo', 'pt-PT', { onEnd: () => console.log('done'), onError: (e) => console.error(e) });
 *
 *   stopSpeaking();  // Cancel any ongoing speech
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';
const GEMINI_TTS_MODEL = 'gemini-3.5-flash-preview-tts';
const WEB_SPEECH_RATE = 1.0;

// ---------------------------------------------------------------------------
// Global singleton — tracks the currently active onEnd callback so that
// stopSpeaking() can notify the previous caller that playback was interrupted.
// ---------------------------------------------------------------------------

let _currentOnEnd = null;
let _currentOnError = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Speak `text` in `lang`.
 *
 * Uses Gemini TTS if a token is provided. Falls back to the Web Speech API
 * if Gemini fails or if `useFallback` is explicitly set.
 *
 * @param {string} text                    - Text to speak
 * @param {string} lang                    - BCP-47 locale, e.g. 'pt-PT', 'en-US'
 * @param {object} [options]
 * @param {string}   [options.token]        - Firebase ID token (required for Gemini TTS)
 * @param {boolean}  [options.useFallback]  - Force Web Speech API only
 * @param {boolean}  [options.preferFallback] - Try Gemini first, fall back on error
 * @param {number}   [options.rate]         - Speech rate (Web Speech API only, default 1.0)
 * @param {Function} [options.onEnd]        - Called when playback ends naturally or is stopped
 * @param {Function} [options.onError]      - Called when playback fails
 * @returns {Promise<boolean>} true if speech succeeded
 */
export async function speak(
  text,
  lang,
  { token, useFallback = false, preferFallback = true, rate = WEB_SPEECH_RATE, onEnd, onError } = {}
) {
  if (!text?.trim()) return false;

  // Stop any ongoing speech and notify the previous caller it was interrupted
  stopSpeaking();

  // Register callbacks for this new playback session
  _currentOnEnd   = onEnd   ?? null;
  _currentOnError = onError ?? null;

  const _handleEnd = () => {
    if (_currentOnEnd) {
      const cb = _currentOnEnd;
      _currentOnEnd   = null;
      _currentOnError = null;
      cb();
    }
  };

  const _handleError = (err) => {
    if (_currentOnError) {
      const cb = _currentOnError;
      _currentOnEnd   = null;
      _currentOnError = null;
      cb(err);
    }
  };

  // Option A: Use Gemini TTS (primary, async)
  if (!useFallback && token) {
    try {
      const success = await _speakWithGemini(token, text, lang, _handleEnd, _handleError);
      if (success) return true;
      if (!preferFallback) return false;
    } catch (err) {
      console.warn('[getTtsService] Gemini TTS failed, falling back to Web Speech API:', err.message);
      if (!preferFallback) return false;
    }
  }

  // Option B: Web Speech API (fallback, synchronous-like)
  _speakWithWebSpeech(text, lang, rate, _handleEnd, _handleError);
  return true;
}

/**
 * Pause any currently playing speech.
 * Works for both Web Speech API and Gemini TTS (audio elements).
 */
export function pauseSpeaking() {
  if (window.speechSynthesis?.speaking && !window.speechSynthesis.paused) {
    window.speechSynthesis.pause();
  }
  document.querySelectorAll('audio[data-tts-audio]').forEach((el) => {
    if (!el.paused) el.pause();
  });
}

/**
 * Resume any paused speech.
 * Works for both Web Speech API and Gemini TTS (audio elements).
 */
export function resumeSpeaking() {
  if (window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
  }
  document.querySelectorAll('audio[data-tts-audio]').forEach((el) => {
    if (el.paused && el.currentTime > 0 && !el.ended) el.play();
  });
}

/**
 * Stop any currently playing speech (both Gemini and Web Speech API).
 * Fires the registered onEnd callback of the interrupted session.
 */
export function stopSpeaking() {
  const onEnd = _currentOnEnd;
  _currentOnEnd   = null;
  _currentOnError = null;

  window.speechSynthesis?.cancel();

  document.querySelectorAll('audio[data-tts-audio]').forEach((el) => {
    el.pause();
    el.remove();
  });

  if (onEnd) onEnd();
}

// ---------------------------------------------------------------------------
// Gemini TTS (primary)
// ---------------------------------------------------------------------------

async function _speakWithGemini(token, text, lang, onEnd, onError) {
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
        language: lang,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Gemini TTS failed');
  }

  const result = json?.data ?? json;

  if (result?.audioUrl)  return _playAudioUrl(result.audioUrl, onEnd, onError);
  if (result?.audioData) return _playAudioBase64(result.audioData, result.mimeType || 'audio/wav', onEnd, onError);

  if (json?.audioData || json?.audioUrl) {
    if (json.audioUrl)  return _playAudioUrl(json.audioUrl, onEnd, onError);
    if (json.audioData) return _playAudioBase64(json.audioData, json.mimeType || 'audio/wav', onEnd, onError);
  }

  console.warn('[getTtsService] Unexpected Gemini TTS response shape', result);
  return false;
}

function _playAudioUrl(url, onEnd, onError) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.dataset.ttsAudio = 'true';
    audio.onended = () => { onEnd?.(); resolve(true); };
    audio.onerror = (err) => {
      console.warn('[getTtsService] Audio playback error:', err);
      onError?.(err);
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      console.warn('[getTtsService] Audio play() failed:', err);
      onError?.(err);
      reject(err);
    });
  });
}

function _playAudioBase64(base64Data, mimeType, onEnd, onError) {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return _playAudioUrl(dataUrl, onEnd, onError);
}

// ---------------------------------------------------------------------------
// Web Speech API (fallback)
// ---------------------------------------------------------------------------

function _speakWithWebSpeech(text, lang, rate, onEnd, onError) {
  if (!window.speechSynthesis) {
    console.warn('[getTtsService] Web Speech API not available in this browser');
    onError?.(new Error('Web Speech API not available'));
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang  = lang;
  utterance.rate  = rate;
  utterance.onend   = () => onEnd?.();
  utterance.onerror = (e) => {
    if (e?.error === 'interrupted' || e?.error === 'canceled') return;
    onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}
