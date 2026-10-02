import { useCallback, useEffect, useRef } from "react";
import { play as playSound, playScore } from "../services/soundService";

/**
 * useSound
 *
 * `play` for components, so a call site is one line: `play("word_banked")`.
 * Mute, volume, holds and ducking all live in `soundService`; this hook adds
 * nothing but a stable function.
 *
 * @returns {{ play: (id: string, options?: { pitch?: number }) => boolean }}
 */
export function useSound() {
  const play = useCallback((id, options) => playSound(id, options), []);
  return { play };
}

/**
 * `open` when a modal, sheet or drawer appears and `close` when it goes, for
 * components that are mounted only while open (pass nothing) or that stay
 * mounted and take an `isOpen` flag.
 */
export function useOpenCloseSound(isOpen = true) {
  useEffect(() => {
    if (!isOpen) return undefined;
    playSound("open");
    return () => {
      playSound("close");
    };
  }, [isOpen]);
}

/**
 * The three endings of a round: `win`, `lose`, and `reveal_answer` for "show
 * me the answer" (explained, not punished). Each plays when its flag turns on.
 */
export function useGameOutcomeSound({ won = false, lost = false, revealed = false }) {
  useEffect(() => {
    if (won) playSound("win");
  }, [won]);
  useEffect(() => {
    if (lost) playSound("lose");
  }, [lost]);
  useEffect(() => {
    if (revealed) playSound("reveal_answer");
  }, [revealed]);
}

/**
 * Plays `id` each time `count` goes up (a word found, an entry solved), and
 * stays quiet when it resets or on the first render.
 */
export function usePlayOnIncrease(count, id) {
  const previous = useRef(count);
  useEffect(() => {
    if (count > previous.current) playSound(id);
    previous.current = count;
  }, [count, id]);
}

/**
 * Plays `id` when `value` becomes something new and truthy: a generated tale,
 * an exercise, a verdict. Not on the first render, so content already on the
 * page when it mounts stays quiet, and not when it is cleared.
 */
export function usePlayWhenSet(value, id) {
  const previous = useRef(value);
  useEffect(() => {
    if (value && value !== previous.current) playSound(id);
    previous.current = value;
  }, [value, id]);
}

/**
 * Plays a score counting up when `percentage` arrives (see `playScore`), once
 * per result, and stops the ticks if the screen goes away mid-count.
 */
export function useScoreSound(percentage) {
  useEffect(() => playScore(percentage), [percentage]);
}
