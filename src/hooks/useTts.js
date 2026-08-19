/**
 * useTts.js
 *
 * Custom hook that wraps getTtsService with stateful Play / Pause / Stop
 * lifecycle management.
 *
 * Usage:
 *   const { ttsState, playTts, pauseTts, stopTts } = useTts();
 *
 *   // ttsState: { activeKey, isPaused, isGenerating }
 *   // activeKey    — an opaque key identifying which audio source is active
 *   // isPaused     — true while paused (activeKey is still set)
 *   // isGenerating — true between the play press and the first sound, while
 *   //                Gemini synthesises the clip. Callers should show a loader
 *   //                rather than claiming playback has started.
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
  const [activeKey,    setActiveKey]    = useState(null);
  const [isPaused,     setIsPaused]     = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const activeKeyRef = useRef(null);

  const _resetState = useCallback(() => {
    activeKeyRef.current = null;
    setActiveKey(null);
    setIsPaused(false);
    setIsGenerating(false);
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
    // Gemini synthesis takes seconds. Until onStart fires there is nothing to
    // hear, so the UI must show "generating" rather than "playing".
    setIsGenerating(true);

    speak(text, lang, {
      token,
      rate,
      onStart: () => {
        if (activeKeyRef.current === key) setIsGenerating(false);
      },
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
    // stopSpeaking() also bumps the service's sequence counter, so a clip still
    // being generated is discarded instead of playing once it arrives.
    stopSpeaking();
    setActiveKey(null);
    setIsPaused(false);
    setIsGenerating(false);
  }, []);

  return { ttsState: { activeKey, isPaused, isGenerating }, playTts, pauseTts, stopTts };
}
