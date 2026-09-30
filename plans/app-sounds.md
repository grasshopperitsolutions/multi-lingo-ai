# Sounds across the app

**Status:** queued. Written 2026-09-30.
**Why:** the app looks like a game (thick borders, hard shadows, wiggle-hover
cards, challenges first), and it is silent. Short, chunky sounds on the
moments that matter make practice feel like play and make feedback land
faster: right, wrong, found it, won, saved. One mute button, in the header like
the theme toggle, puts it all away.

## The sound of the app, in one paragraph

**Chunky, dry, short and friendly.** Think a thick plastic arcade button, a
cardboard game piece snapping into place, an 8-bit coin, a stamp on paper.
No reverb, no music beds, nothing longer than about a second except a win.
Everything sits in one key (C major pentatonic), so any two sounds that
overlap still agree. Success climbs and failure falls, but a mistake is a soft
"bonk", never a buzzer that mocks: this is a practice app, and being wrong is
most of practising. Quiet by default. The loudest thing in the app is a win,
and even that sits under a TTS clip.

## Rules every sound follows

- **Never the only signal.** Every sound repeats something already on screen
  (a colour, a message, a moved piece). Muted, nothing is lost.
- **Only after a tap.** No sound on page load, ever. Browsers block it
  anyway, and the ones that don't shouldn't be tested.
- **Short.** UI sounds under 120 ms, feedback under 300 ms, rewards under
  1.2 s.
- **Not twice at once.** The same sound can't restart within 60 ms (a held
  key, a double tap). Repeated sounds (letters, ticks) vary their pitch by
  ±3% so a run of them doesn't sound like a machine gun.
- **Silent while listening.** While a recording runs (voice practice) or a
  live tutor conversation is open, every UI sound is held. The microphone
  would pick them up, and the tutor would hear them. While a TTS clip plays,
  UI sounds drop to 30% so the voice stays on top.
- **Silent in a hidden tab.**
- **Respect the phone's silent switch.** Where the browser supports it
  (`navigator.audioSession.type = "ambient"`, Safari 16.4+), the sounds follow
  the ring/silent switch and mix with the reader's own music rather than
  stopping it.

## The list

**Categories** set the volume and can be switched off together:
- **UI:** clicks and panels, the most frequent and the easiest to tire of;
- **Feedback:** right, wrong, found;
- **Rewards:** won, streak;
- **Voice:** recording and the live tutor;
- **Books:** from `dashboard-book-shelf.md`.

Each **brief** is written to be usable as-is: as a prompt for an AI sound
generator, or as the target when shaping it in a synth.

### UI (every screen)

| Id | Plays when | Brief | Length |
|---|---|---|---|
| `tap` | A primary action button is pressed (Generate, Discover, Check, Apply, Save) | A single chunky button press: a square-wave blip dropping a fifth, with a tiny plastic click on the attack. Dry, close, like a thick arcade button bottoming out. | 45 ms |
| `toggle_on` | A switch turns on (theme, cursor, publish profile, reminders) | Two quick rising 8-bit blips a major third apart, bright but soft, like a light switch in a retro game. | 90 ms |
| `toggle_off` | A switch turns off | The same two blips falling, slightly duller. | 90 ms |
| `select` | An option is picked (dropdown row, word bank chip, interest, level) | A small wooden-bead tick with a short high sine ping behind it. Light, satisfying, barely there. | 40 ms |
| `open` | A modal, sheet or drawer opens (confirm, word lookup, mobile menu) | A short upward "pop-swoosh": filtered noise rising into a soft rounded blip, like a card sliding up out of a sleeve. | 140 ms |
| `close` | It closes | The same, downward and quieter. | 120 ms |
| `copy` | Text copied to the clipboard (translator, dictionary) | A crisp tiny "tick-tick", two clicks 30 ms apart, like a pen clicked twice. | 60 ms |
| `download` | A PDF is saved | A rubber stamp on paper: a soft thud with a papery slap on top, then silence. | 180 ms |
| `unmute` | The mute button turns sound back on (confirms it works) | One friendly rising two-note chime, C to G, triangle wave, gentle. | 160 ms |

### Feedback (practice moments)

| Id | Plays when | Brief | Length |
|---|---|---|---|
| `success` | A success alert shows (saved, added, published) | Two bright bell-like 8-bit notes climbing a major third, clean and quick, a small "yes!". | 220 ms |
| `error` | An error alert shows | Two low soft square notes falling a minor second, muffled, like a friendly "uh-uh". Never harsh. | 200 ms |
| `warning` | A warning alert shows (limit reached, field required) | One mid "bonk" on a hollow wooden block, short and round. | 120 ms |
| `info` | An info alert shows | A single soft sine blip, high and short, like a notification dot. | 80 ms |
| `favourite_on` | A heart is filled (feature, grammar tip) | A bubbly upward "bloop", a pitch bend of a round sine from low to high, playful. | 150 ms |
| `favourite_off` | A heart is emptied | The same bloop downward, half as loud. | 120 ms |
| `word_banked` | A word is held and goes into the word bank | The classic 8-bit coin: two square notes, B then E an octave up, crisp and happy. The app's signature sound. | 180 ms |
| `word_unbanked` | A word leaves the bank | A soft reverse pop, like a bubble going the wrong way. | 100 ms |
| `reveal` | A translation or practice-language version is revealed | A card flipped on a table: a quick papery flick with a tiny tonal "tink" at the end. | 130 ms |
| `ai_ready` | Something the AI wrote arrives (tale, culture piece, Practice Text, exercise, drill, photo notes) | A short sparkle: three fast rising pentatonic notes on a glassy triangle, ending on a soft shimmer. "Here you go." | 450 ms |
| `limit_reached` | The daily AI allowance is spent | A coin dropped into an empty slot machine: a single coin clink, then a short descending "power down" blip. Wry, not sad. | 500 ms |
| `answer_correct` | A drill or exam answer is marked right | A bright two-note ding, G then C above, bell-like 8-bit, like a quiz show "correct" made tiny. | 250 ms |
| `answer_wrong` | A drill or exam answer is marked wrong | A soft low "bonk-bonk" on a hollow block, falling, gentle enough to hear many times. | 220 ms |

### Games (challenges)

| Id | Plays when | Brief | Length |
|---|---|---|---|
| `key` | A letter key is pressed (Hangman, Word Link) | A short mechanical keyboard clack, dry, slightly different each time (pitch ±3%). | 35 ms |
| `letter_right` | A guessed letter is in the word | A clean upward chiptune blip, a fourth, cheerful. | 120 ms |
| `letter_wrong` | A guessed letter isn't | A dull cardboard thump with a low square "doh" under it. | 150 ms |
| `tile_pick` | A tile is picked up (Scrambled Word, crossword drag) | A small plastic tile lifted off a board: a light click with a tiny rising pop. | 60 ms |
| `tile_drop` | A tile lands in place | A satisfying snap, like a Scrabble tile clacking into a rack. | 70 ms |
| `shuffle` | Tiles are reshuffled | A quick ratchet of five tiny clicks sweeping up in pitch, like tiles shaken in a bag. | 250 ms |
| `word_found` | A word is found (Word Search) or a crossword entry solved | A three-note rising arpeggio (C, E, G) on bright squares, snappy, "got one". | 300 ms |
| `strike` | A wrong guess costs a life (Word Link, Word Ladder) | A short retro "err" buzz, low and blunt, then a crack of cardboard. Firm but not cruel. | 250 ms |
| `hint` | A clue is revealed (Word Link's next clue) | A twinkle: two high sine notes and a breath of shimmer, like a hint lamp switching on. | 250 ms |
| `skip` | A word is skipped | A quick swoosh past the ear, filtered noise sweeping left, light. | 150 ms |
| `reveal_answer` | "Show the answer" | A neutral soft chime and a page slide: explained, not punished. Same sky-blue calm as its banner. | 350 ms |
| `win` | A round is won | A short 8-bit fanfare: five notes climbing the pentatonic to a held high C with a little vibrato, a snare roll under the first three. Triumphant and brief. | 1.1 s |
| `lose` | A round is lost | A playful sad "wah-wah-wah-waaah" on a muted chiptune trombone, four falling notes, the last one bending down. Funny, not gloomy. | 1.0 s |

### Progress and rewards

| Id | Plays when | Brief | Length |
|---|---|---|---|
| `score_count` | An exam or drill score counts up | A rapid run of soft ticks rising in pitch as the number climbs, like a slot counter. | follows the count |
| `score_done` | The count stops | `win` at 80% and above, `success` from 50%, a neutral single chime below. Never `lose` for a score. | as above |
| `streak_up` | The day streak grows (first tap of the day on the dashboard) | A small flame whoosh into a bright rising two-note chime, warm. | 500 ms |
| `celebrate` | Onboarding finished; a new plan activated | The `win` fanfare with a confetti burst: a crackle of tiny high clicks after the last note. | 1.4 s |

### Voice

| Id | Plays when | Brief | Length |
|---|---|---|---|
| `record_start` | Recording begins (voice practice) | Two rising electronic beeps, like an old tape recorder armed. Plays **before** the microphone opens. | 180 ms |
| `record_stop` | Recording ends | The same two beeps falling. Plays **after** the microphone closes. | 180 ms |
| `call_start` | A live tutor conversation connects | A soft "connected" two-tone, like a walkie-talkie opening. Before the microphone streams. | 250 ms |
| `call_end` | It ends | A short "click-hum" hang-up, gentle. After the microphone closes. | 250 ms |

### Books (with `dashboard-book-shelf.md`)

| Id | Plays when | Brief | Length |
|---|---|---|---|
| `turntable_tick` | A book passes the middle of the turntable | A soft detent click, like a turntable notch, very quiet. | 25 ms |
| `book_pick` | A book is picked | A hardback slid off a wooden shelf: a short wood-on-cloth scrape. | 250 ms |
| `cover_open` | The cover swings open | The existing heavy rustle (`usePageTurnSound.playCover`). | 420 ms |
| `page_turn` | A page is turned | The existing light rustle (`playPage`). | 260 ms |
| `book_close` | The book is put back | A soft hardback thump, closed with a hand. | 220 ms |

### Deliberately silent

- **Page navigation, hover and typing in text boxes.** They are far too
  frequent, and sound on them is fatigue, not feedback.
- **The TTS speakers.** The sound *is* the clip.
- **Scrolling and drags without a drop.**

## Where the sounds come from

Two sources, chosen per sound:

1. **Synthesised in the browser, for the 8-bit and UI sounds** (most of the
   list). A sound is an array of about twenty numbers played through **ZzFX**,
   a 1 KB MIT sound synth built for exactly this: games that want retro sound
   effects without shipping files.
   - It has a web designer where each sound is shaped by ear, and the array
     it produces is pasted into `config/sounds.js`.
   - Zero bytes of audio, no request, no cache, and a sound can be retuned by
     changing a number.
   - Each array is rendered once into an `AudioBuffer` the first time its
     sound plays, and reused after.
2. **Recorded foley files, for the textured sounds** (stamp, card flip,
   hardback, shelf scrape, flame, keyboard clack): anything that is a real
   object rather than a tone.
   - Made from the briefs above in an AI sound-effects generator: ElevenLabs
     Sound Effects or Stable Audio, used in their own web apps by you.
     **No API key ever comes near this repo**, and nothing calls a sound
     service at runtime.
   - Trimmed and loudness-matched in Audacity, then exported as mono MP3 at
     64 kbps. Every browser plays MP3; each file is 2 to 12 KB.
   - Stored in `public/sounds/`, fetched the first time the sound is played,
     and kept decoded in memory.
   - The two existing page rustles stay synthesised, as they are now.

**Loudness is matched, not guessed.** Every sound is normalised to the same
perceived level (about -18 LUFS short-term), and the category gains set the
mix:

| Category | Gain |
|---|---|
| UI | 0.35 |
| Feedback | 0.6 |
| Rewards | 0.8 |
| Voice | 0.6 |
| Books | 0.5 |

All of it is under the master volume.

**An admin sound board** (Admin › Sounds, admin-only, so English copy is fine)
plays every sound by name, with its brief beside it. It's how we review the
set together, and how a retuned array gets heard before it ships.

## The mute button

**In the dashboard header, beside the theme toggle, with the same look**:
- a round `p-3` button in the same border and hard-shadow style;
- a speaker icon (`Volume2`) when sound is on, and a crossed speaker
  (`VolumeX`) when muted;
- a tooltip and `aria-label` that say what pressing it will do ("Desligar som"
  / "Ligar som");
- `aria-pressed` for its state.

It also appears:
- **in the public header**, beside its theme toggle, for guests;
- **in the mobile drawer**, as a row under the theme row, the same way the
  theme is offered there;
- **in Settings › Appearance**, as a switch next to the theme and cursor
  switches, saved on pick like them. Under it: a volume slider, and an
  "interface clicks" switch that turns off only the UI category, the one people
  most often want gone while keeping the game sounds.

Optional, where it applies:
- **the challenge sidebar**: a small speaker toggle in the stats panel, since
  games are where sound matters most and the header is a scroll away on a
  phone;
- **the book shelf**: this replaces that plan's question 4 (a speaker toggle
  on the shelf) with the same global switch.

Not on the voice practice or live tutor pages: UI sounds are held there
anyway.

**Where it is saved, like the theme:**
- **On the device:** `localStorage` (`soundMuted`, `soundVolume`,
  `soundUiClicks`) is read at boot, so the first tap already respects it, and
  it is what guests get.
- **On the profile, once signed in:** `users/{uid}.sound = { muted, volume,
  uiClicks }`, written on pick and hydrated in AppContext. **It must go on the
  hydration allow-list**, or it saves and then vanishes on the next load.

**The privacy policy lists what the browser keeps** (§2.7: "as suas
preferências de idioma e de tema"). That becomes "de idioma, de tema e de
som", with the policy date moved, and other locales need a force resync.

## How it is built

- **`services/soundService.js`**, a module singleton, like `getTtsService`
  holding the voice:
  - one lazily created `AudioContext`, unlocked by the first pointer or key
    event anywhere (a one-time listener);
  - a master gain and one gain per category;
  - `play(id, { pitch })`, the rate limiter, the pitch variation;
  - `hold(reason)` and `release(reason)` for recording, the live tutor and TTS
    ducking;
  - the buffer cache, and the mute and volume state.
  - It never throws: a browser with no Web Audio simply stays silent.
- **`config/sounds.js`**: the registry. Each id has its category, its source
  (a ZzFX array or a file path), and its brief as a comment, the one place a
  sound is defined.
- **`hooks/useSound()`**: returns `play` for components, so a call site is one
  line: `play("word_banked")`.
- **AppContext** owns the mute, volume and UI-click preferences, persists them
  like the theme, and hands them to the service, the same pattern as
  `setPreferredVoice`.
- **`usePageTurnSound` moves into the service**, so the book sounds obey mute
  too.

**Wired at shared places first, so most of the app sounds with few edits:**

| Shared place | Sounds |
|---|---|
| `AlertMessage` | success, error, warning, info |
| `ConfirmModal`, `WordLookupSheet`, `MobileMenuDrawer` | open, close |
| `PrimaryButton` | tap, opt-out with `sound={false}` |
| `NeoDropdown` and `WordBankSidebar` chips | select |
| `FavouriteButton` | favourite on and off |
| `useWordFavourites` | banked and unbanked |
| `DownloadPdfButton` | download |
| `showDailyLimitAlert` | limit reached, instead of warning |
| `useVoiceRecorder` | record start and stop, hold and release |
| `useLiveTutor` | call start and end, hold and release |
| `getTtsService` | ducking while a clip plays |

Then **explicit calls at the moments only a page knows**:
- each game's right, wrong, found, won, lost, revealed and skipped;
- drill and exam marking and score counts;
- `ai_ready` where each generator resolves;
- the streak;
- onboarding and the subscription success page.

## Phases

**Phase 0: the engine and the switch (about 1 day)**
- `soundService`, `config/sounds.js` with placeholder arrays, and `useSound`.
- The preferences in AppContext with the allow-list entry, and the privacy
  policy line.
- The mute button in both headers, the drawer and Settings.
- The admin sound board.
- Only `unmute` and the toggles make a sound yet.

**Phase 1: design the set with you (about 1 day, mostly listening)**
- Shape every ZzFX sound on the board. Generate the foley files from the
  briefs, trim and normalise them.
- One review session: each sound played in context on the board, keep or
  redo.

**Phase 2: UI and feedback (about half a day)**
- The shared places in the table above.

**Phase 3: games, drills and exams (about 1 day)**
- All six challenges, the grammar drills, the four exam types and the scores.

**Phase 4: voice, AI moments, rewards (about half a day)**
- Recording and tutor hold and release, `ai_ready`, the streak, and the
  celebrations.

**Phase 5: tune on real phones**
- Levels checked on a phone speaker (where lows vanish and highs bite) and on
  headphones.
- The silent switch on an iPhone.
- The CLAUDE.md section, with the rules above.

The book sounds land with the book shelf plan, whichever ships second.

## Verification

- **Unit:**
  - the rate limiter and pitch variation;
  - hold and release (nested reasons must not release early);
  - mute and volume persistence, on the device and on the profile;
  - the category gains;
  - a registry test that every id has a category and a source, and every
    file exists in `public/sounds/`.
- **Component:**
  - the mute button in every place it appears (label, `aria-pressed`, saved
    on pick, rolled back on a failed write);
  - no sound on load;
  - nothing plays while muted;
  - nothing plays while recording or in a live session.
- **In the browser:** every sound fired in context once, with the console
  clean. Performance is a non-issue by construction (short buffers, one
  context), but the drag in the book shelf is checked for jank with ticks on.
- **On devices:** an iPhone (silent switch, first-tap unlock) and an Android
  phone (speaker levels).

## Risks

- **Fatigue.** The most common failure of UI sound. That's why UI clicks are
  their own category with their own switch, the list leaves out hover and
  navigation, and the review session listens to a run of ten presses in a
  row, not one.
- **Recording contamination.** A sound captured in a voice-practice take
  would be judged as the reader's speech. The hold is taken before the
  microphone opens and released after it closes, and a test pins that.
- **iOS unlock.** Safari only starts audio from a gesture, so the context is
  created and resumed in the first tap handler, not at boot. The first sound
  may land a few milliseconds late; that is acceptable.
- **Taste.** Sounds are personal. The board and the review session exist so
  the set is chosen by ear, together, and not shipped from a table.

## Questions to settle before building

1. **On by default?** Recommended: on for signed-in users, quiet, with the
   mute button in plain sight; **off for guests** on the public pages, where a
   first visit shouldn't make noise.
2. **ZzFX for the 8-bit sounds** (1 KB, MIT, vendored into `src/lib/` with
   its licence), or a small synth of our own? Recommended: ZzFX, for its
   designer.
3. **Foley files: will you generate them** in ElevenLabs or Stable Audio from
   the briefs, or should the textured sounds also be synthesised (quicker,
   slightly less real)?
4. **Saved per account or per device?** Recommended: both, like the theme:
   the device answers at boot, and the profile carries it across devices.
