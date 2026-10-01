# Picture games

**Status:** queued. Written 2026-10-01.
**Why:** words with pictures are the oldest way to practise vocabulary, and the
app has none. The dashboard's "Diverte-te" section has one tile (Desafios).
This adds a second one beside it: games built on a picture for each word.

**Decided with you:**
- **For everyone, not a kids section.** Any beginner, of any age, gets as much
  from matching pictures. No age wording anywhere, so the privacy policy
  (§8, "not directed to children under 13") stays as it is. The written word
  and the speaker icon are both shown, as in the other games.
- **Gemini's current image models**, through the Gemini API.
- **Rebuild `getImageService`**, rather than delete it and start clean.

## Where things stand

`src/services/getImageService.js` has never worked, and could not have:
- **Nothing calls it.** The only references are two tests of
  `findImageBySourceWord`.
- **The API can't return a generated image.** `lib/providers/gemini.ts` takes
  images and audio *in* and returns speech *out*, but has no image-output
  branch. `generateImage` would get text back and throw "No image data".
- **Its uploads would be refused.** It uploads to `examImages/...`, but
  `api/storage.ts` only accepts the `uploads` and `avatars` folders.
- **Nothing writes the `examImages` collection** that `findImageBySourceWord`
  searches.
- **Its prompt is hardcoded** (against the "no prompt text in code" rule) and
  names `imagen-4.0-fast-generate-001`, a retired generation.

The pattern worth copying is `conceptIconService`:
- **One picture per word, for every language.** It stores its result on the
  concept (`wordPool/{conceptId}`), because a cake is a cake in every
  language.
- **Paid once, ever.** The first play pays for it; every later play is free.
- **It never blocks the game:** it fails silently.

## The models

Prices from Google's pricing page, 2026-10-01. No free tier for any of them.

| Model | Good for | 1K image | Notes |
|---|---|---|---|
| `gemini-3.1-flash-lite-image` | **Word pictures** | $0.034 | Fastest and cheapest; 1K only. Not made for multi-turn editing, which we don't need. |
| `gemini-3.1-flash-image` | **Scenes** (several things in one picture) | $0.067 | Better at following a long brief. Also 512px ($0.045), 2K, 4K. |
| `gemini-3-pro-image` | Not needed | $0.134 | Premium; overkill for flat illustrations. |

- **Model ids live on the prompt document** (`model`), like every other
  feature. The API keeps a fallback constant only for a document with no
  model.
- **Call shape:** the SDK we have (`@google/genai` 2.24) supports images
  through `generateContent`:
  - `responseModalities: ['IMAGE']` and `imageConfig: { aspectRatio, imageSize }`;
  - the image comes back as `inlineData` (PNG).

  Google's newest docs show the Interactions API instead. Staying on
  `generateContent` keeps one code path with text and speech.
- **Every image carries an invisible SynthID watermark.** Nothing to do about
  it, just worth knowing.

## How a picture gets made: on the server, not in the browser

`conceptIconService` builds its prompt in the browser and writes the result
from the browser. That's acceptable for an SVG icon, which is sanitised on
render. **It is not acceptable for pictures, which every player sees:**
- **Anyone could plant a picture.** `wordPool` is writable by any signed-in
  account, guests included (`lib/collection-policies.ts`). A browser-built
  flow lets anyone put any image, from any prompt or URL, on "gato" for
  everybody.
- **Phones would download originals.** A generated PNG is about 1–2 MB, and a
  four-picture round on a phone shouldn't download 6 MB. The Gemini API
  can't return a compressed format (`outputMimeType` is not supported there),
  so something has to shrink it.

So the API does all of it, as a **new mode of `/api/ask-ai`, not a new
endpoint** (this needs your OK, see the open questions). The request names a
concept, never a prompt:

```
providerParams: { provider: 'gemini', picture: { conceptId } }
```

The server then:
1. **Return what exists.** If `conceptPictures/{conceptId}` is ready, return
   its URL: no AI call and nothing spent. This check comes before the
   allowance check, the same way the speech cache works.
2. **Check the word.** `wordPool/{conceptId}` must exist with `status: ready`
   and a `sourceWord`.
3. **Claim it.** A transaction marks it `pending`, so two players opening the
   same word at once don't pay twice. A claim older than 2 minutes is treated
   as abandoned.
4. **Ask whether it can be drawn** (`concept-picturable-prompt`, one cheap
   text call, stored as `picturable`). "Freedom" or "to remember" can't be one
   clear picture. If the answer is no, the word is marked `skipped` and the
   games never use it.
5. **Build the prompt on the server** from `concept-picture-prompt`, reading
   `appConfig/config/prompts` directly. The API already reads that collection
   for the Pulse labels. The variables come from the concept document, never
   from the request.
6. **Generate** with the document's model (`gemini-3.1-flash-lite-image`),
   square, 1K.
   - A safety block (`IMAGE_SAFETY`, `IMAGE_PROHIBITED_CONTENT`) or no image
     marks it `failed` with `failedAt`.
   - A failed word is retried after 7 days, and is skipped until then.
7. **Shrink** to a 512×512 WebP of about 30–60 KB with `sharp` (a new
   dependency, which runs on Vercel).
8. **Upload to Storage** as `conceptPictures/{conceptId}/{hash}.webp`.
   - The file is public-read like avatars, with a one-year immutable cache
     header.
   - The hash is in the name, so a regenerated picture gets a new URL and no
     phone keeps the old one.
9. **Write `conceptPictures/{conceptId}`**:
   `{ status, url, model, promptHash, picturable, width, height, createdAt, failedAt?, reports? }`.

`conceptPictures` is **readable by any signed-in account and written only by
the server** (`write: 'admin'` in `collection-policies.ts`, which the
server's Admin SDK bypasses). Keeping it out of `wordPool` is what makes
planting a picture impossible without a field-level rule.

### Who pays

- **Pictures don't spend the daily AI allowance.** Being shown decoration you
  didn't ask for shouldn't cost you a call, and an Explorer's 3 a day
  wouldn't survive one round.
- **Why it can't be abused:** the server builds the prompt and only pictures
  a word that has none. The total spend is capped by the number of words in
  the pool, and new words only come from paid `getWord` calls.
  - **Ballpark:** 500 common nouns cost about $17, once, for every language
    forever.
- **Per-account cap:** 30 new pictures a day (`PICTURE_DAILY_CAP`).
  - Past the cap the request is refused, not charged. The game just uses words
    that already have pictures.
  - It's logged like the maintenance cap, so a misuse shows up in Sentry.
- **Guests (anonymous accounts) never trigger a picture.** They play with words
  that already have one.
- **Pulse counts `pictures_generated`,** so the spend shows up in Admin › Pulse.

## The games

All of them live in a new "Diverte-te" tile, **Jogos com Imagens**, with
its own menu. It's built like Desafios: the same game cards, practice-language
badge, tier badges and favourites.

**How each round picks its words:**
- **The pool:** concepts with a `ready` picture and a translation in the
  practice language.
- **Topics:** the player's interests (`topicIds`, the same picker as tales)
  come first.
- **Repeats are allowed.** Seeing the same word again is the point here, so
  there's no "seen" exclusion; a round just avoids words from the last few
  rounds.
- **A thin pool fills itself.** When fewer than 12 words have pictures, the
  game asks the server for a few more in the background, one at a time like
  icons, and starts with what exists.
- **The first days:** a TEMPORARY admin button pictures about 150 common
  nouns, so no one sees an empty pool at launch.

**Pictures in dark mode:** every picture sits on a white tile with the
thick border, like a sticker. That keeps it readable in both themes, and is
why the prompts ask for a plain white background.

| Game | How it plays | Phone layout | Tier (Admin › Tiers & Features) |
|---|---|---|---|
| **Liga a imagem** (`picture_match`) | One word, four pictures, tap the right one. Every other turn it's reversed: one picture, four words. 8 turns a round. The speaker icon reads each word. | 2×2 pictures, full width | All tiers |
| **Jogo da memória** (`picture_memory`) | Flip cards to pair each picture with its word. A word card is read aloud when it's turned. Moves are counted. | 3×4 (6 pairs); 4×4 (8 pairs) on desktop | All tiers |
| **Qual é o intruso?** (`picture_odd_one_out`) | Four pictures, three from one topic: tap the one that doesn't belong. All four words are shown afterwards. | 2×2 | All tiers |
| **A Caderneta** (`picture_album`) | Every word you get right in the games adds its picture as a sticker. One page per topic, empty slots shown as "?", and a "12 / 40" count. | 3 columns; 6 on desktop | All tiers |
| **Descreve a imagem** (`picture_describe`) | A scene; write what you see, get feedback. See below. | Picture on top, text box below | Maestro |
| **Diz o que vês** (`picture_say_it`) | Five pictures; say each word out loud, judged in one call for the whole round. Phase 4. | One picture at a time | Voyager and up |

**Not included:** counting games ("quantas maçãs?") and tapping a spot in the
picture ("eu vejo, eu vejo"). Image models can't be trusted to draw an exact
number of things, and they don't say where they put them.

### A Caderneta

- **Where it's saved:** per player, per practice language, beside the
  challenge progress (`userService`), as a list of collected concept ids.
- **Pages:** one per topic (`topicIds`), with the topic chips scrolling
  sideways on phones.
- **Counts:** a page's total is the words in that topic that have a picture,
  so it grows as the pool does.
- **Cost:** reads only, with no AI involved.
- **Sounds:** if the sounds plan is built first, sticking a new sticker gets
  its own sound.

### Descreve a imagem (Maestro)

1. **The scene.** It's built from 4–6 pictured, drawable words chosen in code
   from one topic, preferring the player's interests.
   - The server renders `picture-scene-prompt` from those concepts'
     `sourceWord`s. The request sends concept ids, never text.
   - It uses `gemini-3.1-flash-image` at 4:3, shrunk to a 1024×768 WebP.
   - Scenes are stored in `pictureScenes/{id}`
     (`{ url, conceptIds, sourceWords, topicId, createdAt, model }`), which only
     the server writes.
2. **Shared and tracked.** Scenes are shared across languages, since the
   target words are translated per player. Each player's seen scenes are
   tracked the same way as tales and culture facts (`SeenProgressCard`, with
   a reset).
3. **Who can make new scenes.** Only callers on an unlimited allowance
   (Maestro) can generate one, up to 10 a day; that's checked on the server
   from the tier it already resolves. Everyone else draws from the existing
   scenes.
4. **The answer.** The player writes their description. Phones' own keyboard
   dictation works too, with no extra code.
5. **Checking the words.**
   - **Code first.** It checks which target words the description uses
     (normalised, matched against `word` and `baseForm`), so "found 4 of 6"
     is never the model's guess.
   - **Then the AI.** `picture-describe-feedback-prompt` gets the player's
     text, the found and missed words, the level, and the scene image itself.
     It comments on phrasing and anything else they described.
   - **A normal call:** one AI call, counted like any other.
6. **What the player sees:**
   - the words found, with stickers for the Caderneta;
   - corrections;
   - two words to try next ("Vês o pássaro?").

**Later, maybe:** one free "Descreve a imagem" a day for Explorer and
Voyager, as a taste of Maestro. The tier system has no per-day taste today,
so it's left out of this plan.

## The prompts

All four live in Firestore and are written in English (the house rules).
They're created by a TEMPORARY seeder, and the seeder is removed once it's
been run.

1. **`concept-picturable-prompt`** (text, JSON `{ picturable }`).
   - **Variables:** `sourceWord`, `senseKey`, `pos`.
   - **The question:** could a learner see this as one clear picture of a
     single concrete thing, and name this word from it?
   - **Answers no for:** abstract ideas, feelings, actions that need a
     sequence, and words easily mistaken for a more common word with the
     same picture ("mug" for "cup").
2. **`concept-picture-prompt`** (image, `gemini-3.1-flash-lite-image`, 1:1).
   - **Variables:** `sourceWord`, `senseKey`.
   - **The style:**
     - the object alone, centred, on a plain white background;
     - a flat sticker style with thick black outlines and bright flat colours;
     - no gradients;
     - suitable for every age.
   - **What's never in it:** text, letters, numbers, logos, real people or
     brands. Text in a picture would give the answer away, or show it in the
     wrong language.
3. **`picture-scene-prompt`** (image, `gemini-3.1-flash-image`, 4:3).
   - **Variable:** `sourceWords`.
   - **The brief:** one cheerful everyday scene in the same style, where each
     listed thing is clearly visible and nothing else prominent could be
     confused with them.
   - **The same "never"** list as the word pictures.
4. **`picture-describe-feedback-prompt`** (text, JSON, scene image attached).
   - **Variables:** `targetLanguage`, `level`, `nativeLanguage`,
     `description`, `foundWords`, `missedWords`.
   - **The feedback:** encouraging and specific, in the player's language, in
     the "practice" voice.

I'll show you the full templates for review before seeding, as with tales.

## Phases

### Phase 0: pictures exist (API first, then frontend)

**API**
- `lib/providers/gemini.ts`: an image branch, the counterpart of the speech
  one.
  - `responseModalities: ['IMAGE']` and `imageConfig`.
  - Returns `{ imageData, mimeType, finishReason }`.
  - A safety block comes back as a typed "blocked" result, not an error.
- `lib/pictures.ts` (new module, not an endpoint): claim, render, the
  picturability check, generate, `sharp`, upload, write. Scenes too.
- `api/ask-ai.ts`: the `picture` mode.
  - It comes before the allowance check, has its own daily cap, and refuses
    guests.
  - The scene rule is unlimited tiers only, 10 a day.
- `lib/types.ts`: the `picture` request shape.
- `lib/collection-policies.ts`: `conceptPictures` and `pictureScenes`
  (read: authenticated, write: admin). **Remove `examImages`.**
- `package.json`: `sharp`.
- Tests:
  - the cache hit costs nothing;
  - the claim race, and "not drawable" skips;
  - a safety block marks it failed;
  - guests are refused, and the cap holds;
  - the scene tier rule;
  - the request can't smuggle a prompt.
- `CLAUDE.md`, `README.md`.

**Frontend**
- `src/services/getImageService.js`, rebuilt. Every old export goes
  (`generateImage`, `generateAndStoreImage`, `findImageBySourceWord`, the
  Imagen constant). The new ones:
  - `getConceptPictures(conceptIds)`: batched reads, returning a Map.
  - `requestConceptPicture(conceptId)`: the ask-ai picture mode, with
    `skipConfirm`; it never throws and returns a URL or null.
  - `fillPictures(conceptIds, { onPicture, max })`: one at a time, like
    icons.
  - `getNextScene()` and `requestScene(conceptIds)`.
- **Only show URLs on our own bucket.** Pictures render only when the URL
  starts with the bucket's public origin, as a second guard.
- Its tests, rewritten.
- TEMPORARY: the prompt seeder, and the "Picture common words" button in
  Admin.
  - The button pictures up to 150 ready nouns that have none, with a progress
    count.
  - Both are removed once run.

### Phase 1: Jogos com Imagens, first three games

- **The tile:** `src/config/dashboardFeatures.js` gets `picture_games` in
  `HAVE_FUN`, after `challenges` (lucide `Images`).
- **The game list:** `src/config/favouritableFeatures.js` gets
  `PICTURE_GAMES`, like `CHALLENGE_GAMES`.
- **The menu:** `GameCard` moves out of `ChallengesMenu.jsx` into `ui/`, so
  both menus share it. Then `PictureGamesMenu.jsx`.
- **Shared parts:**
  - `PictureTile`: the white sticker tile, a skeleton while loading, and the
    report flag.
  - `usePictureRound`: picks words, fills a thin pool, and handles a missing
    translation.
- **Pages:** Liga a imagem, Jogo da memória, Qual é o intruso. They're lazy
  routes in `App.jsx`, which the stale-deploy reload now covers.
- **Translations:** `picture_games.*` strings in pt-PT.
- **Admin › Tiers & Features:** you create the five feature ids, with "show
  in pricing page" set as you like.

### Phase 2: the Caderneta, and reporting wrong pictures

- **The album:** a sticker is saved when a word is answered right in any
  picture game.
- **The report flag:** "Esta imagem não corresponde à palavra" (this picture
  doesn't match the word) on every picture. It adds to `reports` on the
  picture document; this needs one server-side increment, through the same
  picture mode.
- **Admin › Pictures:**
  - pictures with reports, largest count first, sorted in code;
  - "Regenerate" and "Mark as not drawable".
  - A wrong picture teaches the wrong word to everyone, so this is not
    optional for long.

### Phase 3: Descreve a imagem (Maestro)

- **Scenes:** generation, the pool, and seen tracking with reset.
- **The page:** scene, text box, feedback card, and stickers for the words
  found.

### Phase 4, optional: Diz o que vês

- **One call per round:** five recordings in one Gemini audio call, each
  judged against its expected word.
- **Privacy:** the same promises as Voice Practice. No recording stored,
  nothing inferred about the speaker.

## Traps

1. **Text inside pictures.** Image models love adding labels, and a label is
   the answer, or the word in the wrong language. The prompt forbids it. The
   report button and Admin › Pictures catch what slips through.
2. **One picture, two words.** "Cup" and "mug", "sofa" and "couch".
   - **The drawable check** rejects words easily mistaken for a more common
     one.
   - **Distractors** in Liga a imagem never share the answer's `senseKey`.
   - **Reports** catch the rest.
3. **Innocent words blocked by safety filters** ("knife", "gun", body parts):
   - they're marked failed and skipped, never retried in a loop;
   - every 7 days is enough.
4. **A wrong model id** fails the generation and marks the word failed. Check
   the ids in the prompt documents against Google's list before seeding.
5. **Abuse through the free exemption.** Bounded by:
   - one picture per word, ever;
   - the per-account cap;
   - no guests;
   - the server building the prompt.

   Watch `pictures_generated` in Pulse during the first week.
6. **Dark mode:** a picture never sits directly on a dark card, always on its
   white tile.
7. **Old phones caching a regenerated picture:** the hash is in the file
   name, so a new picture is a new URL.
8. **Articles and gender.** The games show the translation's `word` as
   stored ("maçã", not "a maçã"). Adding articles is a separate decision for
   every language.

## Verification

```bash
cd C:/Nuno/Projects/GrasshopperWebSite/proxies/multi-lingo-ai-api && npm run typecheck && npm test
cd C:/Nuno/Projects/GrasshopperWebSite/projects/multi-lingo-ai && npm run lint && npm test && npm run build
```

1. **Phase 0 checks:**
   - **Seed it:** you press the seeder and the picture button. I don't test
     admin features.
   - **Admin › Prompts** shows the four documents.
   - **Storage** has small WebP files under `conceptPictures/`.
   - **Pulse** shows the count.
2. **A guest** (anonymous session on the deployed API):
   - a picture request for an unpictured word is refused;
   - a pictured one returns its URL;
   - nothing is spent either way.
3. **The games, on a phone width (375px) and on desktop:**
   - a round with no missing pictures;
   - a round that fills a thin pool;
   - dark mode, and the practice-language badge.
4. **Descreve a imagem, as Maestro:**
   - a new scene is generated once, then served from the pool;
   - the found words match what the code counted;
   - the feedback never claims something that isn't in the picture.

## Open questions

1. **Server-side pictures** as a new `picture` mode of `/api/ask-ai`, plus
   `sharp`. That's not a new endpoint, but it's the biggest API change in
   this plan. OK?
2. **Pictures free of the daily allowance**, capped at 30 a day per account
   and not for guests. OK, or should they count like icons do today?
3. **The names:** "Jogos com Imagens", "Liga a imagem", "Jogo da memória",
   "Qual é o intruso?", "A Caderneta", "Descreve a imagem", "Diz o que vês".
4. **The first release:** Phase 0 and Phase 1 together, with the Caderneta
   (Phase 2) right after? Or hold the release until the Caderneta is in?
