import { useEffect, useRef } from "react";
import PropTypes from "prop-types";

/**
 * LiveTutorBlob
 *
 * The field behind "Fala com a IA": a soft shape that swells with whoever is
 * talking and takes their colour — sky for the tutor, emerald for you.
 *
 * **It never re-renders.** Loudness changes about fifteen times a second and
 * the page it sits behind holds a growing transcript, so the level is *pulled*
 * from `getAudioLevels()` inside this component's own frame loop rather than
 * pushed through React state. Nothing above this component knows the shape
 * moved.
 *
 * Canvas rather than SVG or CSS: it is three overlapping gradient-filled paths
 * redrawn every frame, which is what canvas is for. An SVG would be a hundred
 * points of DOM mutated sixty times a second.
 */

/**
 * Speech sits around 0.05-0.2 RMS, so this maps an ordinary speaking voice
 * onto most of the range without a shout pinning it at the top.
 */
const LEVEL_GAIN = 5;

/** Below this, nobody is talking and the shape returns to its resting drift. */
const SILENCE = 0.02;

/** Sky (tutor), emerald (you), slate (nobody) as [r, g, b]. */
const VOICE_RGB = {
  tutor: [56, 189, 248],
  user: [52, 211, 153],
  idle: [71, 85, 105],
};

/**
 * One closed, wobbling ring. Three sine terms at different rates so the
 * outline never repeats visibly; each is scaled by the level, so a silent blob
 * is nearly round and a loud one is lumpy.
 */
function traceBlob(ctx, cx, cy, radius, time, level, seed) {
  const STEPS = 96;
  ctx.beginPath();
  for (let i = 0; i <= STEPS; i += 1) {
    const angle = (i / STEPS) * Math.PI * 2;
    const wobble =
      1 +
      0.10 * Math.sin(3 * angle + time * 1.1 + seed) * (0.4 + level) +
      0.07 * Math.sin(5 * angle - time * 0.85 + seed) * (0.3 + level) +
      0.05 * Math.sin(7 * angle + time * 1.7 + seed) * (0.2 + level * 1.3);
    const r = radius * (1 + 0.17 * level) * wobble;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

const LiveTutorBlob = ({ getAudioLevels, isActive, className = "" }) => {
  const canvasRef = useRef(null);

  // Props the frame loop reads. Held in refs so that toggling `isActive` does
  // not tear the loop down and restart it — which would reset the clock and
  // make the shape jump at the exact moment somebody pressed start.
  const levelsRef = useRef(getAudioLevels);
  const activeRef = useRef(isActive);

  useEffect(() => {
    levelsRef.current = getAudioLevels;
    activeRef.current = isActive;
  }, [getAudioLevels, isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

    let width = 0;
    let height = 0;
    let ratio = 1;

    const measure = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);

    let frame = 0;
    let clock = 0;
    let smoothed = 0;
    let previous = performance.now();

    const draw = (now) => {
      frame = requestAnimationFrame(draw);

      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      if (!width || !height) return;

      // A resting drift when nobody is speaking, so the stage reads as ready
      // rather than broken — but not for someone who asked for less motion.
      if (!calm) clock += delta;

      const live = activeRef.current;
      const { mic, tutor } = live ? levelsRef.current() : { mic: 0, tutor: 0 };
      const loudest = Math.max(mic, tutor);
      const voice = loudest < SILENCE ? "idle" : tutor >= mic ? "tutor" : "user";

      const target = Math.min(1, loudest * LEVEL_GAIN);
      // Eased towards rather than snapped to: the microphone reports once per
      // 64ms frame and the screen paints four times as often, so the raw value
      // would step visibly.
      smoothed += (target - smoothed) * Math.min(1, delta * 12);

      const [r, g, b] = VOICE_RGB[voice];
      const cx = width * (width < 640 ? 0.5 : 0.36);
      const cy = height * (width < 640 ? 0.4 : 0.5);
      const radius = Math.min(width, height) * 0.46;

      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const backdrop = context.createLinearGradient(0, 0, width, height);
      backdrop.addColorStop(0, "#071a2a");
      backdrop.addColorStop(1, "#04101b");
      context.fillStyle = backdrop;
      context.fillRect(0, 0, width, height);

      for (let layer = 2; layer >= 0; layer -= 1) {
        const depth = layer / 2;
        const size = radius * (0.62 + depth * 0.72);

        context.globalAlpha = (0.1 + 0.2 * (1 - depth)) * (live ? 1 : 0.5);
        traceBlob(
          context,
          cx,
          cy,
          size,
          clock * (0.5 + depth * 0.45),
          smoothed * (1 - depth * 0.4),
          layer * 1.9,
        );

        const glow = context.createRadialGradient(cx, cy, size * 0.1, cx, cy, size);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.05)`);
        context.fillStyle = glow;
        context.fill();
      }
      context.globalAlpha = 1;
    };

    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block w-full h-full ${className}`} />;
};

LiveTutorBlob.propTypes = {
  /** Returns `{ mic, tutor }` loudness, 0..1-ish. Called once per frame. */
  getAudioLevels: PropTypes.func.isRequired,
  isActive: PropTypes.bool,
  className: PropTypes.string,
};

LiveTutorBlob.defaultProps = {
  isActive: false,
  className: "",
};

export default LiveTutorBlob;
