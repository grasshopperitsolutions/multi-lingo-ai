/**
 * ttsService.js
 *
 * Centralised Text-to-Speech utility using the Web Speech API.
 * Works in any component — no React context or hook required.
 *
 * State machine:
 *   idle → playing  (speak() called)
 *   playing → paused  (pause() called)
 *   paused → playing  (resume() called)
 *   playing → idle    (speech ends naturally or stopSpeaking() called)
 *   paused → idle     (stopSpeaking() called)
 *
 * Browser quirk — iOS Safari / some Android browsers:
 *   speechSynthesis.pause() may silently cancel instead of pausing.
 *   After calling pause() we check speechSynthesis.paused; if the browser
 *   did not actually pause, we set state to 'idle' so the UI never shows
 *   a stuck "Paused" indicator.
 *
 * Usage:
 *   import { speak, stopSpeaking, pause, resume, getState,
 *            onStateChange, offStateChange } from '../services/ttsService';
 *
 *   speak('Olá mundo', 'pt-PT');               // normal speed
 *   speak('Olá mundo', 'pt-PT', { rate: 0.5 }); // half speed
 *   pause();                                    // pause mid-sentence
 *   resume();                                   // resume from pause
 *   stopSpeaking();                             // cancel entirely
 *   getState();                                 // 'idle' | 'playing' | 'paused'
 *
 *   // React usage — subscribe in useEffect, clean up on unmount:
 *   useEffect(() => {
 *     const handler = (newState) => setPlayState(newState);
 *     onStateChange(handler);
 *     return () => offStateChange(handler);
 *   }, []);
 */

// ---------------------------------------------------------------------------
// Module-level state (singleton — mirrors the browser speechSynthesis singleton)
// ---------------------------------------------------------------------------

/** @type {'idle' | 'playing' | 'paused'} */
let _state = 'idle';

/** @type {Set<Function>} */
const _listeners = new Set();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _setState(newState) {
  if (_state === newState) return;
  _state = newState;
  _listeners.forEach((cb) => {
    try { cb(newState); } catch (e) { console.warn('[ttsService] listener error:', e); }
  });
}

function _isSupported() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('[ttsService] Web Speech API is not supported in this environment.');
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Speak `text` in `lang` at the given `rate`.
 * Cancels any ongoing or paused speech before starting.
 *
 * @param {string} text        - Text to speak
 * @param {string} lang        - BCP-47 locale, e.g. 'pt-PT', 'en-US'
 * @param {object} [options]
 * @param {number} [options.rate=1.0] - Speech rate (0.1–10). 0.5 = half speed.
 */
export function speak(text, lang, { rate = 1.0 } = {}) {
  if (!text?.trim()) return;
  if (!_isSupported()) return;

  // Cancel any ongoing speech; reset state immediately so listeners
  // see 'idle' before the new 'playing' transition.
  window.speechSynthesis.cancel();
  _setState('idle');

  // setTimeout guards against the iOS Safari race condition where
  // calling speak() immediately after cancel() results in silence.
  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang  = lang;
    utterance.rate  = rate;

    utterance.onstart  = () => _setState('playing');
    utterance.onpause  = () => _setState('paused');
    utterance.onresume = () => _setState('playing');
    utterance.onend    = () => _setState('idle');
    utterance.onerror  = () => _setState('idle');
    window.speechSynthesis.speak(utterance);
  }, 50);
}

/**
 * Pause the current speech.
 * No-op if nothing is playing.
 * Handles browsers that silently cancel instead of pausing (iOS Safari).
 */
export function pause() {
  if (!_isSupported() || _state !== 'playing') return;

  window.speechSynthesis.pause();

  // Guard against browsers that cancel instead of pausing:
  // give the browser one tick to update .paused, then verify.
  setTimeout(() => {
    if (!window.speechSynthesis.paused && _state !== 'idle') {
      // Browser cancelled rather than paused — reflect real state
      _setState('idle');
    } else if (window.speechSynthesis.paused) {
      _setState('paused');
    }
  }, 0);
}

/**
 * Resume paused speech.
 * No-op if not currently paused.
 */
export function resume() {
  if (!_isSupported() || _state !== 'paused') return;
  window.speechSynthesis.resume();
  // onresume event will call _setState('playing')
}

/**
 * Stop any currently playing or paused speech.
 */
export function stopSpeaking() {
  if (!_isSupported()) return;
  window.speechSynthesis.cancel();
  _setState('idle');
}

/**
 * Get the current TTS state synchronously.
 * @returns {'idle' | 'playing' | 'paused'}
 */
export function getState() {
  return _state;
}

/**
 * Subscribe to state changes.
 * The callback receives the new state string on every transition.
 * Call offStateChange() with the same reference to unsubscribe.
 *
 * @param {(state: 'idle' | 'playing' | 'paused') => void} cb
 */
export function onStateChange(cb) {
  _listeners.add(cb);
}

/**
 * Unsubscribe a previously registered state-change callback.
 * Safe to call even if the callback was never registered.
 *
 * @param {(state: 'idle' | 'playing' | 'paused') => void} cb
 */
export function offStateChange(cb) {
  _listeners.delete(cb);
}
