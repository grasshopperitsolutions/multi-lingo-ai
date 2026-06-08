/**
 * useTts.js
 *
 * Custom hook that wraps getTtsService with stateful Play / Pause / Stop
 * lifecycle management.
 *
 * Usage:
 *   const { ttsState, playTts, pauseTts, stopTts } = useTts();
 *
 *   // ttsState: { activeKey: string|null, isPaused: boolean }
 *   // activeKey — an opaque key identifying which audio source is playing
 *   // isPaused  — true while paused (activeKey is still set)
 *
 *   playTts({ key: 'input', text, lang, token, rate });
 *   pauseTts();
 *   stopTts();
 *
 * Only one audio source can play at a time (enforced by getTtsService).
 * Pressing play on a different key automatically stops the current one.
 */

import { useState, useCallback, useRef } from 'react';
import { speak, pauseSpeaking, resumeSpeaking, stopSpeaking } from '../services/getTtsService';

/**
 * @typedef {Object} TtsState
 * @property {string|null} activeKey - Key of the currently active (playing or paused) source
 * @property {boolean}     isPaused  - Whether the active source is paused
 */

/**
 * @returns {{ ttsState: TtsState, playTts: Function, pauseTts: Function, stopTts: Function }}
 */
export function useTts() {
  const [activeKey, setActiveKey] = useState(null);
  const [isPaused,  setIsPaused]  = useState(false);

  // Track the key that is currently "active" in a ref so callbacks can read
  // the latest value without stale closure issues.
  const activeKeyRef = useRef(null);

  const _resetState = useCallback(() => {
    activeKeyRef.current = null;
    setActiveKey(null);
    setIsPaused(false);
  }, []);

  /**
   * Start (or resume) playback for the given key.
   *
   * @param {object} params
   * @param {string}  params.key   - Unique identifier for this TTS source (e.g. 'input', 'output')
   * @param {string}  params.text  - Text to speak
   * @param {string}  params.lang  - BCP-47 locale
   * @param {string}  [params.token] - Firebase ID token for Gemini TTS
   * @param {number}  [params.rate]  - Speech rate (default 1)
   */
  const playTts = useCallback(({ key, text, lang, token, rate = 1 }) => {
    // If the same key is paused, just resume it
    if (activeKeyRef.current === key && isPaused) {
      resumeSpeaking();
      setIsPaused(false);
      return;
    }

    // Otherwise, start new playback (speak() will stop any current audio first)
    activeKeyRef.current = key;
    setActiveKey(key);
    setIsPaused(false);

    speak(text, lang, {
      token,
      rate,
      onEnd: () => {
        // Only reset if this key is still the active one
        if (activeKeyRef.current === key) {
          _resetState();
        }
      },
      onError: () => {
        if (activeKeyRef.current === key) {
          _resetState();
        }
      },
    });
  }, [isPaused, _resetState]);

  /**
   * Pause the currently playing audio.
   */
  const pauseTts = useCallback(() => {
    if (!activeKeyRef.current || isPaused) return;
    pauseSpeaking();
    setIsPaused(true);
  }, [isPaused]);

  /**
   * Stop the currently playing/paused audio entirely.
   */
  const stopTts = useCallback(() => {
    if (!activeKeyRef.current) return;
    // Clear ref BEFORE calling stopSpeaking so the onEnd callback
    // inside playTts does not double-reset.
    activeKeyRef.current = null;
    stopSpeaking();
    setActiveKey(null);
    setIsPaused(false);
  }, []);

  return {
    ttsState: { activeKey, isPaused },
    playTts,
    pauseTts,
    stopTts,
  };
}
