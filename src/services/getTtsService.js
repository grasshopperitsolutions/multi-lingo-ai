/**
 * getTtsService.js
 *
 * Text-to-Speech service with Gemini TTS as primary engine
 * and Web Speech API as fallback.
 *
 * Usage:
 *   import { speak, stopSpeaking } from '../services/getTtsService';
 *
 *   // Gemini TTS (primary) — requires a Firebase ID token
 *   await speak('Olá mundo', 'pt-PT', { token: '...firebase-token...' });
 *
 *   // Force Web Speech API only (no token needed)
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

/**
 * Current active Gemini TTS model.
 * NOTE: 'gemini-3.5-flash-preview-tts' does NOT exist — never use it.
 * Use 'gemini-2.5-flash-preview-tts' (current stable preview).
 */
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_TTS_VOICE = 'Sulafat';
const WEB_SPEECH_RATE  = 1.0;

/**
 * Locale metadata used to build dialect-aware TTS prompts.
 * Each entry maps a BCP-47 locale to human-readable language/region info
 * so Gemini TTS reads with the correct accent and pronunciation.
 */
const LOCALE_METADATA = {
  // ── Portuguese ────────────────────────────────────────────────────────────
  'pt-PT': { language: 'European Portuguese',    region: 'Portugal' },
  'pt-BR': { language: 'Brazilian Portuguese',   region: 'Brazil' },
  // ── English ───────────────────────────────────────────────────────────────
  'en-US': { language: 'American English',       region: 'the United States' },
  'en-GB': { language: 'British English',        region: 'the United Kingdom' },
  'en-AU': { language: 'Australian English',     region: 'Australia' },
  // ── Spanish ───────────────────────────────────────────────────────────────
  'es-ES': { language: 'Castilian Spanish',      region: 'Spain' },
  'es-MX': { language: 'Mexican Spanish',        region: 'Mexico' },
  'es-AR': { language: 'Rioplatense Spanish',    region: 'Argentina' },
  // ── Catalan ───────────────────────────────────────────────────────────────
  'ca':    { language: 'Catalan',                region: 'Catalonia' },
  'ca-ES': { language: 'Catalan',                region: 'Catalonia, Spain' },
  'ca-AD': { language: 'Andorran Catalan',       region: 'Andorra' },
  'ca-FR': { language: 'Northern Catalan',       region: 'the Pyrenees-Orientales region of France' },
  'ca-IT': { language: 'Algherese Catalan',      region: 'Alghero, Sardinia, Italy' },
  // ── French ────────────────────────────────────────────────────────────────
  'fr-FR': { language: 'French',                 region: 'France' },
  'fr-CA': { language: 'Canadian French',        region: 'Canada' },
  // ── Other European ────────────────────────────────────────────────────────
  'de-DE': { language: 'German',                 region: 'Germany' },
  'it-IT': { language: 'Italian',                region: 'Italy' },
  'nl-NL': { language: 'Dutch',                  region: 'the Netherlands' },
  'pl-PL': { language: 'Polish',                 region: 'Poland' },
  'ru-RU': { language: 'Russian',                region: 'Russia' },
  'tr-TR': { language: 'Turkish',                region: 'Turkey' },
  // ── Asian ─────────────────────────────────────────────────────────────────
  'ja-JP': { language: 'Japanese',               region: 'Japan' },
  'zh-CN': { language: 'Mandarin Chinese',       region: 'mainland China' },
  'zh-TW': { language: 'Traditional Chinese',    region: 'Taiwan' },
  'ko-KR': { language: 'Korean',                 region: 'South Korea' },
  // ── Middle East ───────────────────────────────────────────────────────────
  'ar-SA': { language: 'Arabic',                 region: 'Saudi Arabia' },
};

// ---------------------------------------------------------------------------
// Global singleton — tracks the currently active onEnd callback so that
// stopSpeaking() can notify the previous caller that playback was interrupted.
// ---------------------------------------------------------------------------

let _currentOnEnd   = null;
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
 * @param {string} text                      - Text to speak
 * @param {string} lang                      - BCP-47 locale, e.g. 'pt-PT', 'en-US'
 * @param {object} [options]
 * @param {string}   [options.token]          - Firebase ID token (required for Gemini TTS)
 * @param {boolean}  [options.useFallback]    - Force Web Speech API only
 * @param {boolean}  [options.preferFallback] - Try Gemini first, fall back on error (default: true)
 * @param {number}   [options.rate]           - Speech rate (Web Speech API fallback only, default 1.0)
 * @param {Function} [options.onEnd]          - Called when playback ends naturally or is stopped
 * @param {Function} [options.onError]        - Called when playback fails
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
      const cb    = _currentOnEnd;
      _currentOnEnd   = null;
      _currentOnError = null;
      cb();
    }
  };

  const _handleError = (err) => {
    if (_currentOnError) {
      const cb    = _currentOnError;
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

  // Option B: Web Speech API (fallback)
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
  const onEnd    = _currentOnEnd;
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
// TTS Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build a dialect-aware instructional prompt for Gemini TTS.
 *
 * Instead of sending raw text (which causes Gemini to infer the dialect
 * from the content alone), this wraps the text with clear instructions
 * about language, regional origin, and tone — ensuring the correct accent
 * and pronunciation is used regardless of text content.
 *
 * @param {string} text - The text to be read aloud (not modified)
 * @param {string} lang - BCP-47 locale, e.g. 'pt-PT', 'en-US'
 * @returns {string} Full instructional prompt for Gemini TTS
 */
function _buildTtsPrompt(text, lang) {
  const meta = LOCALE_METADATA[lang] ?? {
    language: lang,
    region: 'the appropriate region',
  };

  return (
    `You are a native ${meta.language} speaker from ${meta.region}. ` +
    `Please read the following text aloud in a clear and natural tone, ` +
    `using the accent and pronunciation typical of ${meta.region}. ` +
    `Do not translate, summarize, or modify the text in any way — read it exactly as written.` +
    `\n\n${text}`
  );
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
      prompt: _buildTtsPrompt(text, lang),
      providerParams: {
        provider:  'gemini',
        model:     GEMINI_TTS_MODEL,
        tts:       true,
        voice:     GEMINI_TTS_VOICE,
        language:  lang,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(json?.error || json?.message || 'Gemini TTS failed');
  }

  const result = json?.data ?? json;

  console.log('[getTtsService] Gemini TTS mimeType:', result?.mimeType);

  if (result?.audioUrl)  return _playAudioUrl(result.audioUrl, onEnd, onError);
  if (result?.audioData) return _playAudioBase64(result.audioData, result.mimeType || 'audio/wav', onEnd, onError);

  console.warn('[getTtsService] Unexpected Gemini TTS response shape', result);
  return false;
}

function _playAudioUrl(url, onEnd, onError, blobUrlToRevoke = null) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.dataset.ttsAudio = 'true';
    audio.onended = () => {
      if (blobUrlToRevoke) URL.revokeObjectURL(blobUrlToRevoke);
      onEnd?.();
      resolve(true);
    };
    audio.onerror = (err) => {
      if (blobUrlToRevoke) URL.revokeObjectURL(blobUrlToRevoke);
      console.warn('[getTtsService] Audio playback error:', err);
      onError?.(err);
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      if (blobUrlToRevoke) URL.revokeObjectURL(blobUrlToRevoke);
      console.warn('[getTtsService] Audio play() failed:', err);
      onError?.(err);
      reject(err);
    });
  });
}

/**
 * Convert raw PCM Base64 audio (e.g. audio/L16;codec=pcm;rate=24000) into
 * a blob: URL backed by a proper WAV file.
 *
 * Gemini TTS returns signed 16-bit little-endian mono PCM with no container.
 * Browsers cannot decode this as a data: URL — they need the 44-byte RIFF/WAV
 * header to know the sample rate, bit depth, and channel count.
 *
 * @param {string} base64Data - Base64-encoded raw PCM bytes
 * @param {string} mimeType   - e.g. 'audio/L16;codec=pcm;rate=24000'
 * @returns {string} blob: URL pointing to a valid WAV file
 */
function _pcmToWavBlobUrl(base64Data, mimeType) {
  // Parse sample rate from mimeType string, e.g. "rate=24000" → 24000
  const rateMatch = mimeType.match(/rate=(\d+)/i);
  const sampleRate   = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  const numChannels  = 1;   // Gemini TTS is always mono
  const bitsPerSample = 16; // L16 = signed 16-bit
  const byteRate     = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign   = numChannels * (bitsPerSample / 8);

  // Decode base64 → raw PCM bytes
  const binaryStr = atob(base64Data);
  const pcmBytes  = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i);
  }

  const dataSize   = pcmBytes.byteLength;
  const headerSize = 44;
  const wavBuffer  = new ArrayBuffer(headerSize + dataSize);
  const view       = new DataView(wavBuffer);

  // RIFF chunk
  _writeStr(view, 0,  'RIFF');
  view.setUint32(4,  36 + dataSize, true);  // file size - 8
  _writeStr(view, 8,  'WAVE');

  // fmt sub-chunk
  _writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16,           true);  // sub-chunk size (PCM = 16)
  view.setUint16(20, 1,            true);  // audio format (1 = PCM)
  view.setUint16(22, numChannels,  true);
  view.setUint32(24, sampleRate,   true);
  view.setUint32(28, byteRate,     true);
  view.setUint16(32, blockAlign,   true);
  view.setUint16(34, bitsPerSample,true);

  // data sub-chunk
  _writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM payload
  new Uint8Array(wavBuffer, headerSize).set(pcmBytes);

  const blob    = new Blob([wavBuffer], { type: 'audio/wav' });
  const blobUrl = URL.createObjectURL(blob);
  return blobUrl;
}

function _writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function _playAudioBase64(base64Data, mimeType, onEnd, onError) {
  // Gemini returns raw L16 PCM — browsers cannot play it without a WAV header.
  // Detect by mimeType and wrap in a proper WAV container via blob: URL.
  const isPcm = /L16|pcm/i.test(mimeType);

  if (isPcm) {
    const blobUrl = _pcmToWavBlobUrl(base64Data, mimeType);
    return _playAudioUrl(blobUrl, onEnd, onError, blobUrl);
  }

  // Already a browser-playable format (audio/wav, audio/mp3, audio/ogg, etc.)
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

  const utterance    = new SpeechSynthesisUtterance(text);
  utterance.lang     = lang;
  utterance.rate     = rate;
  utterance.onend    = () => onEnd?.();
  utterance.onerror  = (e) => {
    if (e?.error === 'interrupted' || e?.error === 'canceled') return;
    onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}
