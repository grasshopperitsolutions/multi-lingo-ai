import { useCallback, useRef } from "react";

/**
 * usePageTurnSound
 *
 * A paper rustle, synthesised with the Web Audio API rather than shipped as an
 * audio file: it costs no bytes, needs no network request (the artifact CSP and
 * the app's own offline behaviour both stay simple), and the character can be
 * tuned by changing numbers instead of re-recording.
 *
 * The sound itself is a short burst of white noise pushed through a bandpass
 * filter with a fast decay — which is essentially what a page turn is
 * acoustically. Two flavours: a heavier one for the cover, a lighter one for a
 * single page.
 *
 * The AudioContext is created lazily on first play. Every call site is a click
 * handler, so it is always inside a user gesture and autoplay policy is
 * satisfied; if it is not, the resume() simply fails and the app carries on
 * silently rather than throwing.
 *
 * @returns {{ playCover: () => void, playPage: () => void }}
 */
export function usePageTurnSound() {
  const contextRef = useRef(null);
  const noiseRef = useRef(null);

  const getContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    contextRef.current = new Ctor();
    return contextRef.current;
  }, []);

  /** One second of white noise, generated once and reused for every rustle. */
  const getNoiseBuffer = useCallback((ctx) => {
    if (noiseRef.current) return noiseRef.current;
    const frames = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    noiseRef.current = buffer;
    return buffer;
  }, []);

  const rustle = useCallback(
    ({ duration, frequency, q, peak }) => {
      const ctx = getContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const now = ctx.currentTime;

      const source = ctx.createBufferSource();
      source.buffer = getNoiseBuffer(ctx);
      // Random offset so two turns in a row are not bit-identical.
      const offset = Math.random() * 0.5;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(frequency, now);
      // Sweep down slightly: the trailing edge of a page turn is duller than
      // its attack, and the sweep is most of what sells it as paper.
      filter.frequency.exponentialRampToValueAtTime(frequency * 0.55, now + duration);
      filter.Q.value = q;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + duration * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start(now, offset, duration);
      source.stop(now + duration);
    },
    [getContext, getNoiseBuffer],
  );

  // Deliberately quiet. Unprompted audio in a web app is intrusive, and this
  // only ever fires on a deliberate click.
  const playCover = useCallback(
    () => rustle({ duration: 0.42, frequency: 1500, q: 0.7, peak: 0.13 }),
    [rustle],
  );

  const playPage = useCallback(
    () => rustle({ duration: 0.26, frequency: 2600, q: 1.1, peak: 0.09 }),
    [rustle],
  );

  return { playCover, playPage };
}
