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

import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';

/**
 * Fallback TTS model, used only when the `tts-build-prompt` Firestore doc has
 * no `model` field set. Must stay in sync with DEFAULT_TTS_MODEL in the proxy
 * (multi-lingo-ai-api/lib/providers/gemini.ts) — that file's own comment notes
 * a differently-misnamed model "does NOT exist and should never be used", and
 * this constant had drifted to yet another wrong variant (word order swapped).
 */
const GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview';

/**
 * Speech pace options.
 *
 * A slow reading is a *separately generated recording* — Gemini is asked to
 * speak deliberately — not the normal clip played back slowly. Browser
 * time-stretching (`playbackRate` with `preservesPitch`) runs a phase vocoder,
 * and at large ratios it produces the metallic, warbly artifacts that made the
 * old 0.25× option unusable. Asking the model for a genuinely slower delivery
 * keeps the voice human at the cost of one extra generation per pace.
 *
 * `promptValue` fills the {{speechPace}} placeholder in the `tts-build-prompt`
 * template. `webSpeechRate` applies only to the Web Speech fallback, which is a
 * real synthesizer and changes rate natively without artifacts.
 *
 * Adding another pace (e.g. a fast one) is a row here plus an option in
 * TTSPlayer — nothing else needs to know about it.
 */
export const SPEECH_PACE = {
  NATURAL: 'natural',
  SLOW:    'slow',
};

const PACE_CONFIG = {
  [SPEECH_PACE.NATURAL]: { promptValue: 'natural',          webSpeechRate: 1.0 },
  [SPEECH_PACE.SLOW]:    { promptValue: 'slow, deliberate', webSpeechRate: 0.7 },
};

const DEFAULT_PACE = SPEECH_PACE.NATURAL;

/** Resolve a pace to its config, falling back to natural for an unknown value. */
function _paceConfig(pace) {
  return PACE_CONFIG[pace] ?? PACE_CONFIG[DEFAULT_PACE];
}

/**
 * Prebuilt Gemini TTS voices, split by perceived gender.
 *
 * Every clip used to be read by 'Sulafat' (female), so a dialogue between two
 * people sounded like one person talking to herself — students had no way to
 * tell speakers apart. Until multi-speaker synthesis lands, the voice is picked
 * deterministically from the text so that a given transcript always sounds the
 * same (re-reading an exercise doesn't swap the narrator) while different
 * exercises vary.
 */
const GEMINI_VOICES = {
  female: ['Sulafat', 'Aoede', 'Kore', 'Leda'],
  male:   ['Charon', 'Puck', 'Fenrir', 'Orus'],
};
const ALL_VOICES = [...GEMINI_VOICES.female, ...GEMINI_VOICES.male];

/**
 * Maximum number of generated clips held in memory at once.
 * Gemini returns raw 24 kHz mono PCM — roughly 48 KB per second of speech —
 * so a 60-second exam transcript is ~3 MB. Twelve clips is a comfortable
 * ceiling for a single exam session without pushing the tab into swap.
 */
const AUDIO_CACHE_LIMIT = 12;

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
// Global singleton — tracks the currently active playback session.
//
// `_currentAudio` must be a real reference to the HTMLAudioElement. An earlier
// version tagged the element with `data-tts-audio` and looked it up with
// `document.querySelectorAll('audio[data-tts-audio]')`, but `new Audio()`
// elements are never appended to the document, so that selector always matched
// nothing and stop/pause/resume were silent no-ops on the Gemini path.
//
// `_playSeq` guards against a race: generation takes seconds, so a user can
// press stop (or start a different clip) while a request is still in flight.
// Each speak() call captures the sequence number it was issued under and
// discards its result if the number has moved on.
// ---------------------------------------------------------------------------

let _currentOnEnd   = null;
let _currentOnError = null;
let _currentAudio   = null;
let _currentBlobUrl = null;
let _playSeq        = 0;

/**
 * In-memory cache of generated clips, keyed by voice + locale + text.
 *
 * Replaying a listening exercise is normal exam behaviour, and without this
 * every press of play was a fresh `askAI` round-trip: several seconds of wait
 * and another call charged against the user's daily tier limit. Each pace is
 * its own recording and so its own entry — a text the user hears both ways
 * occupies two slots.
 */
const _audioCache = new Map();

/**
 * djb2 — a short, stable string hash. Only used to keep cache keys a sane
 * length; it never needs to be collision-proof because the full locale and
 * voice are part of the key and a stale hit would at worst replay the wrong
 * clip within one session.
 */
function _hashText(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Build the cache key. The locale is part of it because the *same* text can be
 * legitimately read in different languages — "Toronto" or "chocolate" in pt-PT
 * versus en-US are different recordings, and keying on text alone would serve a
 * Portuguese learner an English pronunciation. The pace is part of it because
 * natural and slow are now two distinct recordings, not one clip played at two
 * speeds — without it, pressing slow would replay the natural take.
 */
function _cacheKey(text, lang, voice, pace) {
  return `${voice}|${lang}|${pace}|${_hashText(text.trim())}`;
}

function _cacheGet(key) {
  const hit = _audioCache.get(key);
  if (!hit) return null;
  // Refresh recency — Map preserves insertion order, so re-inserting moves the
  // entry to the end and keeps the eviction below approximately LRU.
  _audioCache.delete(key);
  _audioCache.set(key, hit);
  return hit;
}

function _cacheSet(key, value) {
  if (_audioCache.has(key)) _audioCache.delete(key);
  _audioCache.set(key, value);
  while (_audioCache.size > AUDIO_CACHE_LIMIT) {
    _audioCache.delete(_audioCache.keys().next().value);
  }
}

/**
 * Pick a deterministic voice for a piece of text so the same transcript always
 * gets the same narrator across replays (and therefore the same cache key).
 */
function _pickVoice(text, lang) {
  const idx = parseInt(_hashText(`${lang}:${text.trim()}`), 36) % ALL_VOICES.length;
  return ALL_VOICES[idx];
}

/** Release the current audio element and any blob URL backing it. */
function _teardownAudio() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.onended = null;
    _currentAudio.onerror = null;
    _currentAudio.onplaying = null;
    _currentAudio.src = '';
    _currentAudio = null;
  }
  if (_currentBlobUrl) {
    URL.revokeObjectURL(_currentBlobUrl);
    _currentBlobUrl = null;
  }
}

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
 * @param {string}   [options.pace]           - One of SPEECH_PACE. A non-natural
 *   pace is generated as its own recording rather than time-stretched.
 * @param {Function} [options.onStart]        - Called when audio actually begins playing
 * @param {Function} [options.onEnd]          - Called when playback ends naturally or is stopped
 * @param {Function} [options.onError]        - Called when playback fails
 * @returns {Promise<boolean>} true if speech succeeded
 */
export async function speak(
  text,
  lang,
  { token, useFallback = false, preferFallback = true, pace = DEFAULT_PACE, onStart, onEnd, onError } = {}
) {
  if (!text?.trim()) return false;

  // Stop any ongoing speech and notify the previous caller it was interrupted
  stopSpeaking();

  // Claim this playback session. Anything that arrives late from a previous
  // generation checks this number and bails out instead of playing over us.
  const seq = ++_playSeq;

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
      const success = await _speakWithGemini(token, text, lang, pace, seq, onStart, _handleEnd, _handleError);
      if (success) return true;
      if (seq !== _playSeq) return false;   // superseded while generating
      if (!preferFallback) return false;
    } catch (err) {
      console.warn('[getTtsService] Gemini TTS failed, falling back to Web Speech API:', err.message);
      if (seq !== _playSeq) return false;
      if (!preferFallback) return false;
    }
  }

  // Option B: Web Speech API (fallback)
  _speakWithWebSpeech(text, lang, pace, onStart, _handleEnd, _handleError);
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
  if (_currentAudio && !_currentAudio.paused) _currentAudio.pause();
}

/**
 * Resume any paused speech.
 * Works for both Web Speech API and Gemini TTS (audio elements).
 */
export function resumeSpeaking() {
  if (window.speechSynthesis?.paused) {
    window.speechSynthesis.resume();
  }
  if (_currentAudio?.paused && !_currentAudio.ended) {
    _currentAudio.play().catch(() => {});
  }
}

/**
 * Stop any currently playing speech (both Gemini and Web Speech API).
 * Fires the registered onEnd callback of the interrupted session.
 *
 * Also invalidates any generation still in flight, so pressing stop while the
 * loader is showing genuinely cancels — previously the clip would arrive a few
 * seconds later and start playing on its own.
 */
export function stopSpeaking() {
  const onEnd    = _currentOnEnd;
  _currentOnEnd   = null;
  _currentOnError = null;

  _playSeq++;

  window.speechSynthesis?.cancel();
  _teardownAudio();

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
 * @param {string} pace - One of SPEECH_PACE
 * @returns {Promise<{prompt: string, model: string}>} Instructional prompt + model to use for Gemini TTS
 */
async function _buildTtsPrompt(text, lang, pace) {
  const meta = LOCALE_METADATA[lang] ?? {
    language: lang,
    region: 'the appropriate region',
  };

  const promptDoc = await getPrompt('tts-build-prompt');

  // The template is admin-edited in Firestore, so it may not carry the
  // placeholder yet. Without it a slow request generates — and caches, and
  // bills — a second clip that sounds exactly like the natural one, which is
  // silent enough to waste a lot of calls before anyone notices.
  if (pace !== DEFAULT_PACE && !String(promptDoc.template).includes('{{speechPace}}')) {
    console.warn(
      '[getTtsService] The "tts-build-prompt" template has no {{speechPace}} placeholder, ' +
      `so the "${pace}" reading will sound identical to the natural one. ` +
      'Add it in Admin > Prompts, e.g. "Speak at a {{speechPace}} pace."',
    );
  }

  const prompt = renderTemplate(promptDoc.template, {
    language: meta.language,
    region: meta.region,
    text,
    speechPace: _paceConfig(pace).promptValue,
  });
  // Overriding the model here requires a TTS-capable Gemini model — picking a
  // plain text model would break audio generation entirely.
  return { prompt, model: promptDoc.model || GEMINI_TTS_MODEL };
}

// ---------------------------------------------------------------------------
// Gemini TTS (primary)
// ---------------------------------------------------------------------------

async function _speakWithGemini(token, text, lang, pace, seq, onStart, onEnd, onError) {
  const voice = _pickVoice(text, lang);
  const key   = _cacheKey(text, lang, voice, pace);

  // Serve a previously generated clip without touching the API. Each pace is a
  // separate recording, so a text heard both ways caches two entries.
  const cached = _cacheGet(key);
  if (cached) {
    if (seq !== _playSeq) return false;
    return _playAudioBase64(cached.audioData, cached.mimeType, seq, onStart, onEnd, onError);
  }

  const { prompt: ttsPrompt, model } = await _buildTtsPrompt(text, lang, pace);
  const result = await askAI(
    token,
    ttsPrompt,
    { provider: 'gemini', model, tts: true, voice, language: lang },
    // Playback isn't the user asking for new content, and clips are cached per
    // (voice, locale, text) — a prompt here would fire mid-exercise.
    { skipConfirm: true },
  );

  // A stop (or a different clip) landed while we were generating — throw the
  // result away rather than playing over whatever is current now.
  if (seq !== _playSeq) return false;

  if (result?.audioData) {
    _cacheSet(key, {
      audioData: result.audioData,
      mimeType:  result.mimeType || 'audio/wav',
    });
    return _playAudioBase64(result.audioData, result.mimeType || 'audio/wav', seq, onStart, onEnd, onError);
  }

  // Remote URLs aren't cached — the browser's own HTTP cache covers replays,
  // and we have no bytes to hold on to.
  if (result?.audioUrl) return _playAudioUrl(result.audioUrl, seq, onStart, onEnd, onError);

  console.warn('[getTtsService] Unexpected Gemini TTS response shape', result);
  return false;
}

function _playAudioUrl(url, seq, onStart, onEnd, onError, blobUrl = null) {
  return new Promise((resolve, reject) => {
    if (seq !== _playSeq) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      resolve(false);
      return;
    }

    // Deliberately played at the rate it was recorded at. Slow readings come
    // from a separate generation (see SPEECH_PACE), so there is nothing to
    // time-stretch — and stretching is what made the voice sound robotic.
    const audio = new Audio(url);

    _currentAudio   = audio;
    _currentBlobUrl = blobUrl;

    // Only release global state if this element is still the active one — a
    // newer clip may already have replaced it.
    const releaseIfCurrent = () => {
      if (_currentAudio === audio) _teardownAudio();
      else if (blobUrl) URL.revokeObjectURL(blobUrl);
    };

    audio.onplaying = () => onStart?.();
    audio.onended = () => {
      releaseIfCurrent();
      onEnd?.();
      resolve(true);
    };
    audio.onerror = (err) => {
      releaseIfCurrent();
      console.warn('[getTtsService] Audio playback error:', err);
      onError?.(err);
      reject(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      releaseIfCurrent();
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

function _playAudioBase64(base64Data, mimeType, seq, onStart, onEnd, onError) {
  // Gemini returns raw L16 PCM — browsers cannot play it without a WAV header.
  // Detect by mimeType and wrap in a proper WAV container via blob: URL.
  const isPcm = /L16|pcm/i.test(mimeType);

  if (isPcm) {
    const blobUrl = _pcmToWavBlobUrl(base64Data, mimeType);
    return _playAudioUrl(blobUrl, seq, onStart, onEnd, onError, blobUrl);
  }

  // Already a browser-playable format (audio/wav, audio/mp3, audio/ogg, etc.)
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  return _playAudioUrl(dataUrl, seq, onStart, onEnd, onError);
}

// ---------------------------------------------------------------------------
// Web Speech API (fallback)
// ---------------------------------------------------------------------------

function _speakWithWebSpeech(text, lang, pace, onStart, onEnd, onError) {
  if (!window.speechSynthesis) {
    console.warn('[getTtsService] Web Speech API not available in this browser');
    onError?.(new Error('Web Speech API not available'));
    return;
  }

  const utterance    = new SpeechSynthesisUtterance(text);
  utterance.lang     = lang;
  // Unlike an <audio> element, this is a real synthesizer — it re-synthesises
  // at the requested rate rather than stretching a recording, so there are no
  // artifacts and no need for a separate generation.
  utterance.rate     = _paceConfig(pace).webSpeechRate;
  utterance.onstart  = () => onStart?.();
  utterance.onend    = () => onEnd?.();
  utterance.onerror  = (e) => {
    if (e?.error === 'interrupted' || e?.error === 'canceled') return;
    onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}
