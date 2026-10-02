/**
 * sounds.js
 *
 * Every sound the app makes, in one place: its category, how it is made, and
 * the brief it was shaped to (the comment above each one). See
 * `services/soundService.js` for the rules every sound follows and
 * `plans`/CLAUDE.md for why.
 *
 * ## The sound of the app
 *
 * Chunky, dry, short and friendly: a thick plastic arcade button, a cardboard
 * piece snapping into place, an 8-bit coin, a stamp on paper. No reverb, no
 * music beds, nothing longer than about a second except a win. Notes sit in C
 * major pentatonic, so two sounds that overlap still agree. Success climbs and
 * failure falls, but a mistake is a soft "bonk", never a buzzer that mocks.
 *
 * ## How a sound is defined
 *
 * A sound is a list of `parts`, each starting `at` milliseconds after the
 * first. A part is one of:
 *
 * - `zzfx`: a ZzFX parameter array (synthesised once into a buffer and reused).
 *   Arrays from the ZzFX designer paste in as they are; `z({...})` below just
 *   writes the same array with names. Keep `randomness` (index 1) at 0: the
 *   service adds its own pitch variation where a sound asks for it.
 * - `noise`: filtered white noise, played live, for anything that is a real
 *   object rather than a tone (paper, wood, a whoosh): `{ duration, from, to,
 *   q, peak }`, the band sweeping from `from` Hz to `to` Hz.
 *
 * `vary: true` gives each play a ±3% pitch, for sounds that repeat in runs
 * (letters, ticks), so a run of them does not sound like a machine gun.
 *
 * Every sound is synthesised: there are no audio files. To replace one with a
 * recorded file later, give it a `file` source in the service and change only
 * its entry here.
 */

export const SOUND_CATEGORIES = {
  UI: "ui",
  FEEDBACK: "feedback",
  REWARDS: "rewards",
  VOICE: "voice",
  BOOKS: "books",
};

/** Category gains, under the master volume. UI is quietest: it is the most frequent. */
export const CATEGORY_GAINS = {
  ui: 0.35,
  feedback: 0.6,
  rewards: 0.8,
  voice: 0.6,
  books: 0.5,
};

// C major pentatonic, and a few neighbours the briefs ask for.
const N = {
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093.0,
};

const SHAPE = { SINE: 0, TRIANGLE: 1, SAW: 2, NOISE: 4, SQUARE: 5 };

/** A ZzFX array written with names. Unnamed parameters keep ZzFX's defaults. */
function z({
  volume = 1, frequency = 220, attack = 0, sustain = 0, release = 0.1, shape = 0, shapeCurve = 1,
  slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0,
  modulation = 0, bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0, filter = 0,
}) {
  return [volume, 0, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
    pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume,
    decay, tremolo, filter];
}

/** A short 8-bit note: square by default, quick decay. */
const note = (frequency, { len = 0.08, shape = SHAPE.SQUARE, volume = 0.5, filter = 0, release = 0.06 } = {}) =>
  z({ volume, frequency, sustain: len * 0.3, decay: len * 0.7, sustainVolume: 0.4, release, shape, filter });

/** A bell-ish note: triangle with a longer tail. */
const bell = (frequency, { len = 0.12, volume = 0.6 } = {}) =>
  z({ volume, frequency, decay: len, sustainVolume: 0.25, release: len, shape: SHAPE.TRIANGLE });

/** A tiny click: a sliver of band-passed noise. */
const click = (frequency = 2500, duration = 0.02, peak = 0.5) => ({ noise: { duration, from: frequency, to: frequency * 0.8, q: 2, peak } });

const part = (source, at = 0) => (Array.isArray(source) ? { zzfx: source, at } : { ...source, at });

const C = SOUND_CATEGORIES;

export const SOUNDS = {
  // ── UI ────────────────────────────────────────────────────────────────────

  // A single chunky button press: a square-wave blip dropping a fifth, with a
  // tiny plastic click on the attack. Dry, close. 45 ms.
  tap: {
    category: C.UI,
    parts: [part(click(3200, 0.012, 0.35)), part(z({ volume: 0.45, frequency: N.A5, sustain: 0.015, release: 0.03, shape: SHAPE.SQUARE, pitchJump: N.D5 - N.A5, pitchJumpTime: 0.015, filter: -3000 }))],
  },
  // Two quick rising 8-bit blips a major third apart, bright but soft. 90 ms.
  toggle_on: { category: C.UI, parts: [part(note(N.C6, { len: 0.04, volume: 0.35 })), part(note(N.E6, { len: 0.045, volume: 0.35 }), 45)] },
  // The same two blips falling, slightly duller. 90 ms.
  toggle_off: { category: C.UI, parts: [part(note(N.E6, { len: 0.04, volume: 0.3, filter: -2500 })), part(note(N.C6, { len: 0.045, volume: 0.3, filter: -2500 }), 45)] },
  // A small wooden-bead tick with a short high sine ping behind it. 40 ms.
  select: { category: C.UI, vary: true, parts: [part(click(2200, 0.015, 0.4)), part(z({ volume: 0.2, frequency: N.G6, decay: 0.03, sustainVolume: 0, release: 0.01 }), 5)] },
  // A short upward "pop-swoosh": noise rising into a soft rounded blip. 140 ms.
  open: { category: C.UI, parts: [part({ noise: { duration: 0.1, from: 600, to: 2800, q: 1, peak: 0.18 } }), part(z({ volume: 0.3, frequency: N.E5, decay: 0.04, sustainVolume: 0, release: 0.02 }), 90)] },
  // The same, downward and quieter. 120 ms.
  close: { category: C.UI, parts: [part({ noise: { duration: 0.09, from: 2600, to: 600, q: 1, peak: 0.12 } }), part(z({ volume: 0.2, frequency: N.C5, decay: 0.035, sustainVolume: 0, release: 0.02 }), 75)] },
  // A crisp tiny "tick-tick", two clicks 30 ms apart. 60 ms.
  copy: { category: C.UI, parts: [part(click(3500, 0.012, 0.45)), part(click(3800, 0.012, 0.45), 30)] },
  // A rubber stamp on paper: a soft thud with a papery slap on top. 180 ms.
  download: { category: C.UI, parts: [part(z({ volume: 0.7, frequency: 110, decay: 0.08, sustainVolume: 0, release: 0.05, slide: -2 })), part({ noise: { duration: 0.12, from: 1600, to: 700, q: 0.8, peak: 0.3 } }, 8)] },
  // One friendly rising two-note chime, C to G, triangle, gentle. 160 ms.
  unmute: { category: C.UI, parts: [part(bell(N.C5, { len: 0.05, volume: 0.5 })), part(bell(N.G5, { len: 0.05, volume: 0.5 }), 60)] },

  // ── Feedback ──────────────────────────────────────────────────────────────

  // Two bright bell-like 8-bit notes climbing a major third: a small "yes!". 220 ms.
  success: { category: C.FEEDBACK, parts: [part(note(N.C6, { len: 0.08, volume: 0.4 })), part(note(N.E6, { len: 0.12, volume: 0.4 }), 90)] },
  // Two low soft square notes falling a minor second, muffled: a friendly "uh-uh". 200 ms.
  error: { category: C.FEEDBACK, parts: [part(note(N.E4, { len: 0.08, volume: 0.4, filter: -900 })), part(note(N.Eb4, { len: 0.1, volume: 0.4, filter: -900 }), 95)] },
  // One mid "bonk" on a hollow wooden block, short and round. 120 ms.
  warning: { category: C.FEEDBACK, parts: [part(z({ volume: 0.6, frequency: N.G4, decay: 0.08, sustainVolume: 0, release: 0.04, shape: SHAPE.TRIANGLE, slide: -6 })), part(click(900, 0.02, 0.25))] },
  // A single soft sine blip, high and short, like a notification dot. 80 ms.
  info: { category: C.FEEDBACK, parts: [part(z({ volume: 0.35, frequency: N.E6, decay: 0.05, sustainVolume: 0, release: 0.03 }))] },
  // A bubbly upward "bloop": a round sine bending from low to high. 150 ms.
  favourite_on: { category: C.FEEDBACK, parts: [part(z({ volume: 0.5, frequency: 300, sustain: 0.05, release: 0.09, slide: 45 }))] },
  // The same bloop downward, half as loud. 120 ms.
  favourite_off: { category: C.FEEDBACK, parts: [part(z({ volume: 0.25, frequency: 800, sustain: 0.04, release: 0.08, slide: -40 }))] },
  // The classic 8-bit coin: B then E an octave up. The app's signature sound. 180 ms.
  word_banked: { category: C.FEEDBACK, parts: [part(z({ volume: 0.4, frequency: N.B5, sustain: 0.06, release: 0.12, shape: SHAPE.SQUARE, pitchJump: N.E6 - N.B5, pitchJumpTime: 0.06, filter: -5000 }))] },
  // A soft reverse pop, like a bubble going the wrong way. 100 ms.
  word_unbanked: { category: C.FEEDBACK, parts: [part(z({ volume: 0.35, frequency: 600, sustain: 0.03, release: 0.06, slide: -35 }))] },
  // A sticker pressed onto a page: a soft paper "pat", then a quick rising
  // two-note chirp, bright but small. "Stuck." The album's own sound. 190 ms.
  sticker: { category: C.FEEDBACK, parts: [part(click(1500, 0.03, 0.45)), part(note(N.G5, { len: 0.06, volume: 0.35 }), 45), part(note(N.C6, { len: 0.1, volume: 0.35 }), 105)] },
  // A card flipped on a table: a papery flick with a tiny "tink" at the end. 130 ms.
  reveal: { category: C.FEEDBACK, parts: [part({ noise: { duration: 0.08, from: 3200, to: 1600, q: 1.2, peak: 0.2 } }), part(z({ volume: 0.25, frequency: N.C7, decay: 0.04, sustainVolume: 0, release: 0.02 }), 90)] },
  // A short sparkle: three fast rising pentatonic notes on a glassy triangle,
  // then a soft shimmer. "Here you go." 450 ms.
  ai_ready: {
    category: C.FEEDBACK,
    parts: [
      part(bell(N.C6, { len: 0.06, volume: 0.4 })),
      part(bell(N.E6, { len: 0.06, volume: 0.4 }), 70),
      part(bell(N.G6, { len: 0.08, volume: 0.4 }), 140),
      part(z({ volume: 0.15, frequency: N.C7, sustain: 0.05, release: 0.2, repeatTime: 0.04, tremolo: 0.6 }), 210),
    ],
  },
  // A coin dropped into an empty slot, then a short descending "power down". Wry, not sad. 500 ms.
  limit_reached: {
    category: C.FEEDBACK,
    parts: [part(note(N.C7, { len: 0.05, volume: 0.3 })), part(z({ volume: 0.35, frequency: N.A4, sustain: 0.15, release: 0.15, shape: SHAPE.SQUARE, slide: -8, filter: -1800 }), 130)],
  },
  // A bright two-note ding, G then C above, like a quiz-show "correct" made tiny. 250 ms.
  answer_correct: { category: C.FEEDBACK, parts: [part(note(N.G5, { len: 0.08, volume: 0.4 })), part(note(N.C6, { len: 0.14, volume: 0.4 }), 100)] },
  // A soft low "bonk-bonk" on a hollow block, falling, gentle enough to hear many times. 220 ms.
  answer_wrong: {
    category: C.FEEDBACK,
    parts: [
      part(z({ volume: 0.5, frequency: 220, decay: 0.07, sustainVolume: 0, release: 0.03, shape: SHAPE.TRIANGLE, filter: -1200 })),
      part(z({ volume: 0.5, frequency: 196, decay: 0.09, sustainVolume: 0, release: 0.04, shape: SHAPE.TRIANGLE, filter: -1200 }), 110),
    ],
  },

  // ── Games ─────────────────────────────────────────────────────────────────

  // A short mechanical keyboard clack, dry, slightly different each time. 35 ms.
  key: { category: C.FEEDBACK, vary: true, parts: [part(click(1900, 0.025, 0.45)), part(z({ volume: 0.15, frequency: 140, decay: 0.02, sustainVolume: 0, release: 0.01 }))] },
  // A clean upward chiptune blip, a fourth, cheerful. 120 ms.
  letter_right: { category: C.FEEDBACK, parts: [part(z({ volume: 0.4, frequency: N.G5, sustain: 0.04, release: 0.07, shape: SHAPE.SQUARE, pitchJump: N.C6 - N.G5, pitchJumpTime: 0.04, filter: -4000 }))] },
  // A dull cardboard thump with a low square "doh" under it. 150 ms.
  letter_wrong: { category: C.FEEDBACK, parts: [part({ noise: { duration: 0.08, from: 450, to: 250, q: 1, peak: 0.35 } }), part(note(147, { len: 0.12, volume: 0.35, filter: -700 }))] },
  // A small plastic tile lifted off a board: a light click with a tiny rising pop. 60 ms.
  tile_pick: { category: C.FEEDBACK, vary: true, parts: [part(click(2800, 0.012, 0.35)), part(z({ volume: 0.25, frequency: 600, sustain: 0.02, release: 0.03, slide: 25 }), 8)] },
  // A satisfying snap, like a Scrabble tile clacking into a rack. 70 ms.
  tile_drop: { category: C.FEEDBACK, vary: true, parts: [part(click(1800, 0.03, 0.55)), part(z({ volume: 0.3, frequency: 220, decay: 0.04, sustainVolume: 0, release: 0.02, shape: SHAPE.TRIANGLE }))] },
  // A quick ratchet of five tiny clicks sweeping up, like tiles shaken in a bag. 250 ms.
  shuffle: { category: C.FEEDBACK, parts: [0, 1, 2, 3, 4].map((i) => part(click(1500 + i * 500, 0.015, 0.35), i * 45)) },
  // A three-note rising arpeggio (C, E, G) on bright squares: "got one". 300 ms.
  word_found: { category: C.FEEDBACK, parts: [part(note(N.C6, { len: 0.07, volume: 0.4 })), part(note(N.E6, { len: 0.07, volume: 0.4 }), 80), part(note(N.G6, { len: 0.12, volume: 0.4 }), 160)] },
  // A short retro "err" buzz, low and blunt, then a crack of cardboard. Firm, not cruel. 250 ms.
  strike: { category: C.FEEDBACK, parts: [part(z({ volume: 0.35, frequency: 110, sustain: 0.1, release: 0.06, shape: SHAPE.SAW, filter: -1100 })), part({ noise: { duration: 0.06, from: 900, to: 500, q: 1, peak: 0.3 } }, 150)] },
  // A twinkle: two high sine notes and a breath of shimmer, like a hint lamp switching on. 250 ms.
  hint: { category: C.FEEDBACK, parts: [part(z({ volume: 0.3, frequency: N.G6, decay: 0.06, sustainVolume: 0, release: 0.03 })), part(z({ volume: 0.3, frequency: N.C7, decay: 0.08, sustainVolume: 0, release: 0.05 }), 70), part({ noise: { duration: 0.1, from: 6000, to: 8000, q: 0.7, peak: 0.06 } }, 120)] },
  // A quick swoosh past the ear, filtered noise sweeping down, light. 150 ms.
  skip: { category: C.FEEDBACK, parts: [part({ noise: { duration: 0.15, from: 3000, to: 700, q: 0.9, peak: 0.22 } })] },
  // A neutral soft chime and a page slide: explained, not punished. 350 ms.
  reveal_answer: { category: C.FEEDBACK, parts: [part(bell(N.E5, { len: 0.2, volume: 0.35 })), part(bell(N.G5, { len: 0.2, volume: 0.25 })), part({ noise: { duration: 0.2, from: 2200, to: 1200, q: 0.8, peak: 0.12 } }, 120)] },
  // A short 8-bit fanfare: five notes climbing to a held high C with a little
  // vibrato, a snare roll under the first three. Triumphant and brief. 1.1 s.
  win: {
    category: C.REWARDS,
    parts: [
      part(note(N.C5, { len: 0.09, volume: 0.4 })),
      part(note(N.D5, { len: 0.09, volume: 0.4 }), 100),
      part(note(N.E5, { len: 0.09, volume: 0.4 }), 200),
      part(note(N.G5, { len: 0.09, volume: 0.4 }), 300),
      part(z({ volume: 0.4, frequency: N.C6, sustain: 0.45, release: 0.2, shape: SHAPE.SQUARE, modulation: 6, filter: -5000 }), 400),
      ...[0, 50, 100, 150, 200, 250].map((t) => part({ noise: { duration: 0.035, from: 4000, to: 3000, q: 0.8, peak: 0.12 } }, t)),
    ],
  },
  // A playful sad "wah-wah-wah-waaah" on a muted chiptune trombone, the last
  // note bending down. Funny, not gloomy. 1.0 s.
  lose: {
    category: C.REWARDS,
    parts: [
      part(z({ volume: 0.4, frequency: N.G4, sustain: 0.12, release: 0.06, shape: SHAPE.SAW, filter: -900, tremolo: 0.3, repeatTime: 0.05 })),
      part(z({ volume: 0.4, frequency: N.Fs4, sustain: 0.12, release: 0.06, shape: SHAPE.SAW, filter: -900, tremolo: 0.3, repeatTime: 0.05 }), 210),
      part(z({ volume: 0.4, frequency: N.F4, sustain: 0.12, release: 0.06, shape: SHAPE.SAW, filter: -900, tremolo: 0.3, repeatTime: 0.05 }), 420),
      part(z({ volume: 0.4, frequency: N.E4, sustain: 0.3, release: 0.15, shape: SHAPE.SAW, filter: -900, slide: -1.2, modulation: 5 }), 630),
    ],
  },

  // ── Progress and rewards ──────────────────────────────────────────────────

  // One tick of a score counting up; the caller raises `pitch` as it climbs.
  score_count: { category: C.FEEDBACK, parts: [part(z({ volume: 0.25, frequency: N.C6, decay: 0.025, sustainVolume: 0, release: 0.01 }))] },
  // A neutral single chime, for a score that ends below half. Never `lose` for a score.
  chime: { category: C.FEEDBACK, parts: [part(bell(N.G5, { len: 0.25, volume: 0.4 }))] },
  // A practice day counted (the first tap of the day): a small warm whoosh into
  // a bright rising two-note chime. 500 ms.
  practice_day: {
    category: C.REWARDS,
    parts: [part({ noise: { duration: 0.14, from: 500, to: 1800, q: 0.8, peak: 0.15 } }), part(bell(N.E5, { len: 0.12, volume: 0.45 }), 120), part(bell(N.A5, { len: 0.2, volume: 0.45 }), 230)],
  },
  // The win fanfare with a confetti burst: a crackle of tiny high clicks after
  // the last note. Onboarding finished; a new plan activated. 1.4 s.
  celebrate: {
    category: C.REWARDS,
    parts: [
      part(note(N.C5, { len: 0.09, volume: 0.4 })),
      part(note(N.E5, { len: 0.09, volume: 0.4 }), 100),
      part(note(N.G5, { len: 0.09, volume: 0.4 }), 200),
      part(note(N.C6, { len: 0.09, volume: 0.4 }), 300),
      part(z({ volume: 0.4, frequency: N.E6, sustain: 0.4, release: 0.2, shape: SHAPE.SQUARE, modulation: 6, filter: -5000 }), 400),
      ...[1000, 1040, 1090, 1120, 1170, 1210, 1260, 1300].map((t, i) => part(click(5000 + (i % 3) * 1200, 0.01, 0.25), t)),
    ],
  },

  // ── Voice ─────────────────────────────────────────────────────────────────

  // Two rising electronic beeps, like an old tape recorder armed. Before the microphone opens. 180 ms.
  record_start: { category: C.VOICE, parts: [part(note(N.A5, { len: 0.06, shape: SHAPE.SINE, volume: 0.45 })), part(note(N.D6, { len: 0.07, shape: SHAPE.SINE, volume: 0.45 }), 90)] },
  // The same two beeps falling. After the microphone closes. 180 ms.
  record_stop: { category: C.VOICE, parts: [part(note(N.D6, { len: 0.06, shape: SHAPE.SINE, volume: 0.4 })), part(note(N.A5, { len: 0.07, shape: SHAPE.SINE, volume: 0.4 }), 90)] },
  // A soft "connected" two-tone, like a walkie-talkie opening. 250 ms.
  call_start: { category: C.VOICE, parts: [part({ noise: { duration: 0.05, from: 2500, to: 2000, q: 1, peak: 0.08 } }), part(bell(N.G5, { len: 0.08, volume: 0.4 }), 40), part(bell(N.C6, { len: 0.12, volume: 0.4 }), 130)] },
  // A short "click-hum" hang-up, gentle. After the microphone closes. 250 ms.
  call_end: { category: C.VOICE, parts: [part(click(1500, 0.02, 0.3)), part(z({ volume: 0.3, frequency: N.C5, sustain: 0.1, release: 0.12, shape: SHAPE.TRIANGLE, slide: -3 }), 20)] },

  // ── Books (for the parked book shelf) ─────────────────────────────────────

  // A soft detent click, like a turntable notch, very quiet. 25 ms.
  turntable_tick: { category: C.BOOKS, vary: true, parts: [part(click(2400, 0.012, 0.2))] },
  // A hardback slid off a wooden shelf: a short wood-on-cloth scrape. 250 ms.
  book_pick: { category: C.BOOKS, parts: [part({ noise: { duration: 0.25, from: 900, to: 1500, q: 0.7, peak: 0.16 } })] },
  // The heavy page rustle, as `usePageTurnSound.playCover` drew it. 420 ms.
  cover_open: { category: C.BOOKS, parts: [part({ noise: { duration: 0.42, from: 1500, to: 825, q: 0.7, peak: 0.26 } })] },
  // The light page rustle (`playPage`). 260 ms.
  page_turn: { category: C.BOOKS, vary: true, parts: [part({ noise: { duration: 0.26, from: 2600, to: 1430, q: 1.1, peak: 0.18 } })] },
  // A soft hardback thump, closed with a hand. 220 ms.
  book_close: { category: C.BOOKS, parts: [part(z({ volume: 0.6, frequency: 90, decay: 0.12, sustainVolume: 0, release: 0.06, slide: -1 })), part({ noise: { duration: 0.08, from: 700, to: 400, q: 0.8, peak: 0.15 } })] },
};

export const SOUND_IDS = Object.keys(SOUNDS);
