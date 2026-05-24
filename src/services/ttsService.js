/**
 * ttsService.js
 *
 * Centralised Text-to-Speech utility using the Web Speech API.
 * Works in any component — no React context or hook required.
 *
 * Usage:
 *   import { speak, stopSpeaking } from '../services/ttsService';
 *
 *   speak('Olá mundo', 'pt-PT');              // normal speed
 *   speak('Olá mundo', 'pt-PT', { rate: 0.5 }); // half speed
 *   stopSpeaking();                            // cancel current speech
 */

/**
 * Speak `text` in `lang` at the given `rate`.
 *
 * @param {string} text        - Text to speak
 * @param {string} lang        - BCP-47 locale, e.g. 'pt-PT', 'en-US'
 * @param {object} [options]
 * @param {number} [options.rate=1.0] - Speech rate (0.1–10). 0.5 = half speed.
 */
export function speak(text, lang, { rate = 1.0 } = {}) {
  if (!text?.trim() || !window.speechSynthesis) return;

  // Cancel any ongoing speech first.
  // setTimeout guards against the iOS Safari race condition where
  // calling speak() immediately after cancel() results in silence.
  window.speechSynthesis.cancel();
  setTimeout(() => {
    const utterance  = new SpeechSynthesisUtterance(text);
    utterance.lang   = lang;
    utterance.rate   = rate;
    window.speechSynthesis.speak(utterance);
  }, 50);
}

/**
 * Stop any currently playing speech.
 */
export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}
