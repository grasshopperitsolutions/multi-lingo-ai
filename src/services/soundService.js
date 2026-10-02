import { CATEGORY_GAINS, SOUNDS, SOUND_CATEGORIES } from "../config/sounds";
import { buildZzfxSamples, ZZFX_SAMPLE_RATE } from "../lib/zzfx";

/**
 * soundService
 *
 * The app's sounds: one lazily created AudioContext, a master gain, one gain
 * per category, and `play(id)`. A module singleton, like `getTtsService`
 * holding the voice: sounds are played from components, hooks and services
 * alike, and "obeys mute" should not depend on each of them remembering to.
 *
 * ## Rules every sound follows (and where each is enforced)
 *
 * - **Never the only signal.** Every sound repeats something already on
 *   screen. Muted, nothing is lost. (The call sites' job.)
 * - **Only after a tap.** No sound before the first pointer or key event:
 *   the context is created and resumed inside that event, which is also what
 *   Safari requires. `play` before then does nothing.
 * - **Not twice at once.** The same id cannot restart within
 *   {@link REPEAT_GUARD_MS} (a held key, a double tap).
 * - **Silent while listening.** `hold(reason)` while a recording runs or a live
 *   tutor conversation is open: the microphone would pick sounds up. Reasons
 *   nest, so one release cannot unmute another hold.
 * - **Ducked under speech.** While a read-aloud clip plays, everything drops to
 *   {@link DUCK_LEVEL} so the voice stays on top.
 * - **Silent in a hidden tab.**
 * - **Follows the phone's silent switch** where the browser supports
 *   `navigator.audioSession` (Safari 16.4+), and mixes with the reader's own
 *   music rather than stopping it.
 *
 * It never throws: a browser with no Web Audio simply stays silent.
 */

export const REPEAT_GUARD_MS = 60;
export const DUCK_LEVEL = 0.3;
const VARY = 0.03;

const state = {
  muted: false,
  volume: 0.8,
  uiClicks: true,
};

let ctx = null;
let master = null;
let categoryGains = {};
let unlocked = false;
let noiseBuffer = null;
let ducked = false;
let pendingOnTap = null;
const holds = new Set();
const lastPlayed = new Map();
const buffers = new Map();

const AudioCtor = () =>
  (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) || null;

function masterLevel() {
  return state.muted ? 0 : state.volume * (ducked ? DUCK_LEVEL : 1);
}

function applyMaster() {
  if (!master || !ctx) return;
  try {
    master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.02);
  } catch {
    master.gain.value = masterLevel();
  }
}

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = AudioCtor();
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = masterLevel();
    master.connect(ctx.destination);
    categoryGains = {};
    for (const category of Object.values(SOUND_CATEGORIES)) {
      const gain = ctx.createGain();
      gain.gain.value = CATEGORY_GAINS[category] ?? 0.5;
      gain.connect(master);
      categoryGains[category] = gain;
    }
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * The first pointer or key event anywhere: create and resume the context while
 * we are inside a user gesture. Listens in the capture phase, so it runs before
 * the click handler that plays the first sound.
 */
function onFirstGesture() {
  unlocked = true;
  const context = ensureContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
  if (pendingOnTap) {
    const id = pendingOnTap;
    pendingOnTap = null;
    // After the event that unlocked us, so it is not swallowed by the guard.
    setTimeout(() => play(id), 0);
  }
}

let installed = false;

/** Arms the first-gesture unlock and the audio session. Safe to call more than once. */
export function initSounds() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    // Follow the ring/silent switch and mix with other audio (Safari 16.4+).
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch {
    // Not supported; nothing to do.
  }
  for (const type of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(type, onFirstGesture, { capture: true, passive: true });
  }
}

function getNoise(context) {
  if (noiseBuffer) return noiseBuffer;
  const frames = context.sampleRate;
  noiseBuffer = context.createBuffer(1, frames, context.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

function zzfxBuffer(context, key, params) {
  if (buffers.has(key)) return buffers.get(key);
  const samples = buildZzfxSamples(...params);
  const buffer = context.createBuffer(1, Math.max(samples.length, 1), ZZFX_SAMPLE_RATE);
  buffer.getChannelData(0).set(samples);
  buffers.set(key, buffer);
  return buffer;
}

function playZzfx(context, destination, key, params, when, rate) {
  const source = context.createBufferSource();
  source.buffer = zzfxBuffer(context, key, params);
  source.playbackRate.value = rate;
  source.connect(destination);
  source.start(when);
}

function playNoise(context, destination, { duration, from, to, q = 1, peak = 0.2 }, when, rate) {
  const source = context.createBufferSource();
  source.buffer = getNoise(context);
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(from * rate, when);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to * rate), when + duration);
  filter.Q.value = q;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + duration * 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  source.connect(filter).connect(gain).connect(destination);
  source.start(when, Math.random() * 0.5, duration);
  source.stop(when + duration);
}

/** Why `play(id)` would stay silent right now, or null if it would sound. */
export function silenceReason(id, now = Date.now()) {
  const sound = SOUNDS[id];
  if (!sound) return "unknown";
  if (state.muted || state.volume <= 0) return "muted";
  if (sound.category === SOUND_CATEGORIES.UI && !state.uiClicks) return "ui-off";
  if (holds.size > 0) return "held";
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return "hidden";
  if (!unlocked) return "locked";
  const last = lastPlayed.get(id);
  if (last !== undefined && now - last < REPEAT_GUARD_MS) return "repeat";
  return null;
}

/**
 * Play a sound by id. `pitch` multiplies the playback rate (1 = as written),
 * for sounds a caller raises as it goes, like a score counting up.
 */
export function play(id, { pitch = 1 } = {}) {
  try {
    const now = Date.now();
    if (silenceReason(id, now)) return false;
    const context = ensureContext();
    if (!context) return false;
    if (context.state === "suspended") context.resume().catch(() => {});
    lastPlayed.set(id, now);

    const sound = SOUNDS[id];
    const rate = pitch * (sound.vary ? 1 + (Math.random() * 2 - 1) * VARY : 1);
    const destination = categoryGains[sound.category] ?? master;
    const start = context.currentTime + 0.005;

    sound.parts.forEach((p, index) => {
      const when = start + (p.at ?? 0) / 1000;
      if (p.zzfx) playZzfx(context, destination, `${id}:${index}`, p.zzfx, when, rate);
      else if (p.noise) playNoise(context, destination, p.noise, when, rate);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Play `id` on the next tap anywhere, for something that happened before the
 * reader touched the page (a practice day counted on load). Only one waits.
 */
export function playOnNextTap(id) {
  if (unlocked) {
    pendingOnTap = id;
    const handler = () => {
      window.removeEventListener("pointerdown", handler, true);
      const next = pendingOnTap;
      pendingOnTap = null;
      if (next) setTimeout(() => play(next), 0);
    };
    window.addEventListener("pointerdown", handler, true);
    return;
  }
  pendingOnTap = id;
}

/** One tick per tenth of a score, then the ending it earned. */
const SCORE_TICK_MS = 70;

/**
 * A score counting up: soft ticks rising in pitch, then `win` at 80% and above,
 * `success` from 50%, and a neutral `chime` below. Never `lose` for a score.
 * Returns a function that cancels whatever has not played yet.
 */
export function playScore(percentage) {
  if (typeof percentage !== "number" || Number.isNaN(percentage)) return () => {};
  const ticks = Math.max(1, Math.min(10, Math.round(percentage / 10)));
  const timers = [];
  for (let i = 0; i < ticks; i += 1) {
    timers.push(setTimeout(() => play("score_count", { pitch: 1 + i * 0.06 }), i * SCORE_TICK_MS));
  }
  const ending = percentage >= 80 ? "win" : percentage >= 50 ? "success" : "chime";
  timers.push(setTimeout(() => play(ending), ticks * SCORE_TICK_MS + 80));
  return () => timers.forEach(clearTimeout);
}

/** Hold every sound for `reason` (recording, a live conversation). Reasons nest. */
export function hold(reason) {
  holds.add(reason);
}

export function release(reason) {
  holds.delete(reason);
}

export const isHeld = () => holds.size > 0;

/** Drop everything to {@link DUCK_LEVEL} while speech plays. */
export function setDucked(on) {
  ducked = !!on;
  applyMaster();
}

/** Mute, volume (0..1) and whether interface clicks sound. Partial updates. */
export function setSoundPreferences({ muted, volume, uiClicks } = {}) {
  if (typeof muted === "boolean") state.muted = muted;
  if (typeof volume === "number" && Number.isFinite(volume)) state.volume = Math.min(Math.max(volume, 0), 1);
  if (typeof uiClicks === "boolean") state.uiClicks = uiClicks;
  applyMaster();
}

export const getSoundPreferences = () => ({ ...state });

/** For tests: forget everything, as a fresh page would. */
export function __resetSoundsForTests() {
  ctx = null;
  master = null;
  categoryGains = {};
  unlocked = false;
  noiseBuffer = null;
  ducked = false;
  pendingOnTap = null;
  holds.clear();
  lastPlayed.clear();
  buffers.clear();
  state.muted = false;
  state.volume = 0.8;
  state.uiClicks = true;
}

/** For tests: behave as if the reader has already tapped. */
export function __unlockForTests() {
  unlocked = true;
}
