# Picture games: Diz o que vês

**Status:** queued, optional. Written 2026-10-02, left over from the picture
games plan. Everything else in that plan is built (see "Picture games" in
CLAUDE.md); this is the one game that was marked optional.
**Why:** the other picture games ask the learner to read, tap or write. This one
asks them to *say* the word, which is the part of vocabulary the others can only
hear.

## The game

**Diz o que vês** (`picture_say_it`, Voyager and up): five pictures, one at a
time; the learner says each word out loud. One picture at a time on a phone.

- **One call per round.** Five recordings go in one Gemini audio call, each judged
  against its expected word, rather than five calls. The result is a verdict per
  word, and a right one sticks the picture in the Caderneta like every other game.
- **The same promises as Voice Practice.** No recording stored, and nothing
  inferred about the speaker: §2.6 and §6 of the privacy policy rest on that, and
  they name Illinois BIPA and Texas CUBI. Any prompt for this must stay inside
  them, and the microphone must take a sound `hold` while it is open (see
  "Sounds" in CLAUDE.md).
- **The words come from the same pool as the other games** (`usePictureRound`:
  a ready picture and a word in the practice language, interests first).

## Before building it

- **Decide how a spoken word is judged.** A model hearing "gato" has to accept the
  accents of every learner, and must say *which* word it heard, not just "close
  enough"; the prompt and the response schema need care, and the verdict should
  be one of heard / not heard / unclear.
- **It needs the audio field of `/api/ask-ai`**, which today takes **one** clip
  (`MAX_AUDIO_CLIPS = 1`). Five clips in one call means raising that, with the
  body-size limit in mind (Vercel rejects over ~4.5 MB before the handler runs).
- **A new prompt** (`picture-say-it-prompt`), written in English like the rest.

## Also left out of the picture games

- **One free "Descreve a imagem" a day for Explorer and Voyager**, as a taste of
  Maestro. The tier system has no per-day taste today.
- **Counting games** ("quantas maçãs?") and **tapping a spot in the picture**
  ("eu vejo, eu vejo"). Image models cannot be trusted to draw an exact number of
  things, and they do not say where they put them.
