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

export function useTts() {
  const [activeKey, setActiveKey] = useState(null);
  const [isPaused,  setIsPaused]  = useState(false);

  const activeKeyRef = useRef(null);

  const _resetState = useCallback(() => {
    activeKeyRef.current = null;
    setActiveKey(null);
    setIsPaused(false);
  }, []);

  const playTts = useCallback(({ key, text, lang, token, rate = 1 }) => {
    if (activeKeyRef.current === key && isPaused) {
      resumeSpeaking();
      setIsPaused(false);
      return;
    }

    activeKeyRef.current = key;
    setActiveKey(key);
    setIsPaused(false);

    speak(text, lang, {
      token,
      rate,
      onEnd: () => {
        if (activeKeyRef.current === key) _resetState();
      },
      onError: () => {
        if (activeKeyRef.current === key) _resetState();
      },
    });
  }, [isPaused, _resetState]);

  const pauseTts = useCallback(() => {
    if (!activeKeyRef.current || isPaused) return;
    pauseSpeaking();
    setIsPaused(true);
  }, [isPaused]);

  const stopTts = useCallback(() => {
    if (!activeKeyRef.current) return;
    activeKeyRef.current = null;
    stopSpeaking();
    setActiveKey(null);
    setIsPaused(false);
  }, []);

  return { ttsState: { activeKey, isPaused }, playTts, pauseTts, stopTts };
}
