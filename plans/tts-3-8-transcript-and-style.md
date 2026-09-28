# Gemini 3.8 TTS: the transcript and the style go separately

**Status:** queued, not started. Written 2026-09-28.
**Repos:** both. Most of the work is in the API (`lib/providers/gemini.ts`, `api/ask-ai.ts`, `lib/tts-cache.ts`, `lib/mp3.ts`). The frontend changes `src/services/getTtsService.js`.
**Models:** `gemini-3.8-flash-tts` for everyone. Explorer gets `gemini-3.8-flash-lite-tts`, through `explorerModel` on the prompt document.

## The problem

Every clip now reads the instructions aloud, as well as the text.

The frontend renders the admin-edited `tts-build-prompt` template. It wraps the text in instructions (language, region, pace) and sends the whole string as the one text part (`getTtsService.js` `_buildTtsPrompt`, then `gemini.ts` `_askGeminiTts`). The 2.5 and 3.1 models acted on those instructions. **Gemini 3.8 TTS treats the text field strictly as a verbatim transcript.** It speaks everything in it, except inline `<tags>` and `|backchannels|`. Directions now belong in `speech_metadata.style`, on the same part.

## Verified facts

Checked on 2026-09-28 against Google's docs and the `@google/genai` type definitions. Items marked **Phase 3** are confirmed by calling the deployed API, once Phase 1 is live. The code is written so that none of them can break it in the meantime.

### How the request changes

- **The directions move to a style field on the part.** Google's example puts them in `speech_metadata: { style: "cheerful and friendly" }` on the part, next to `text` (`speechMetadata` in JavaScript). The style accepts "emotions, delivery style, prosody, pacing, volume". Accent and region have to go there too.
- **There is no region setting.** "The TTS models detect the input language automatically." `SpeechConfig.languageCode` exists in the SDK, but it's ISO 639-1 only (`pt`, never `pt-PT`), so the region still has to be in the style. Whether 3.8 accepts `languageCode`: **Phase 3**.
- **The installed SDK would silently drop the style.** `@google/genai` 2.20.0 copies only the part fields it knows (`partToMldev`), and it has no `speechMetadata`. Version **2.24.0** declares `Part.speechMetadata?: { speaker?, style? }`. So upgrade to 2.24 or later. The fallback is a raw REST call, the way `live-token` already calls Google.
- **Voice config:** Google's 3.8 examples use `voiceConfig: { voice: "Kore" }`. We send `prebuiltVoiceConfig.voiceName`, which the 2.24 types still declare. Which one 3.8 accepts: **Phase 3**. Until then, send `prebuiltVoiceConfig` and fall back to `voice` if the API refuses it.
- **Models:** `gemini-3.8-flash-tts` supports 130 languages. `gemini-3.8-flash-lite-tts` supports 101, including Portuguese, Tamil, Japanese, Korean, Russian, Spanish, French, German, Chinese, Thai, Hindi and Arabic. Both accept 8,192 input tokens and support prebuilt voices such as Sulafat and Kore. Lite is described as tuned for "high throughput", while Flash has "maximum voice fidelity, acting nuance, and dialect coverage". **Expect Lite to handle regional accents less well.**

### The audio format

| | 3.1 and earlier (today's code) | 3.8, `generateContent`, unary |
|---|---|---|
| Returned as | Raw PCM, no header | **WAV with a standard RIFF header** |
| MIME type | `audio/L16;codec=pcm;rate=24000` | `audio/wav` (exact string: **Phase 3**) |
| Samples | 24 kHz, mono, 16-bit signed little-endian | The same, inside the WAV |

Other points:
- Streaming returns headerless `audio/l16`. We don't stream.
- **Choosing a different output format isn't available to us.** `GenerationConfig.responseFormat` is documented as "not supported in Gemini API" (Vertex only). MP3 and Ogg Opus appear only in the Interactions API's `AudioResponseFormat`, a different API. Whether that returns MP3 for TTS is unverified, so it's out of scope, and compression stays our job.

**What 3.8 does to today's code:**

- `lib/mp3.ts` `isRawPcm()` matches `/L16|pcm/i`, and `audio/wav` doesn't match. **So nothing is compressed.** The WAV passes through as it is.
- The frontend plays it anyway: `_playAudioBase64` sends anything that isn't PCM straight to a data URL, and browsers play WAV.
- **Uncompressed WAV is 48,000 bytes a second, or 64,000 in base64.** MP3 at the current 48 kbps is 6,000 bytes a second, or 8,000 in base64. So:
  - Responses are about **8 times larger**.
  - The cache limit (`MAX_AUDIO_BASE64_BYTES = 900_000`) fits **about 14 seconds** of WAV, against **about 112 seconds** of MP3. Longer clips aren't cached, so every replay is a paid call.
- **Both `/L16|pcm/i` checks are also fragile.** A WAV labelled with a `codec=pcm` parameter would match, and get a second header wrapped around it. That's harmless in the API's encoder (it would encode the 44-byte header as a click), but in the browser the wrapped file wouldn't play correctly.

## What changes

Three phases. Each of the first two ends with you deploying. The real response is confirmed last, against the deployed API. Nothing here needs a Gemini key.

### Phase 1 — API (then you deploy it)

Written to be safe before the real response has been seen. The audio is recognised by its bytes as well as its MIME type, and the voice config falls back if the first shape is refused. So a detail that turns out differently in Phase 3 costs a small follow-up, not a broken endpoint.


- **SDK:** upgrade `@google/genai` to 2.24.0 or later, and check the provider still type-checks. Afterwards, deploy and send a preflight request to every route. That's the `ERR_REQUIRE_ESM` lesson in CLAUDE.md: `npm test` and `typecheck` can't see packaging failures.
- **`lib/types.ts`:** add `providerParams.ttsStyle?: string`, and point the TTS model docs at 3.8.
- **`lib/providers/gemini.ts`:**
  - Set the default TTS model to `gemini-3.8-flash-tts`.
  - Send the part as `{ text, speechMetadata: { style } }` when a style is present.
  - Use the voice-config shape described under "How the request changes".
  - Leave `speechConfig.languageCode` out until Phase 3 shows it's accepted and helps.
  - Log the MIME type and whether a style was sent.
- **`api/ask-ai.ts`:** validate `ttsStyle` as a string with a length cap (for example 1,000 characters), and reject anything else with a 400, as `images` and `audio` already are.
- **`lib/tts-cache.ts`: add the style to the cache key**, as `sha256(model␀voice␀style␀transcript)`.
  - Without it, the same text read naturally and slowly, or in pt-PT and pt-BR, would share one clip.
  - Store the style on the clip document so it can be inspected. It's admin text, not user data.
  - Update the module comment ("the key is the rendered prompt").
  - Old keys are simply never matched again. They're 3.1 clips of the spoken-instruction era, so nothing should reuse them. Deleting them is optional, later.
- **`lib/mp3.ts`: compress WAV as well as raw PCM.**
  - Replace `isRawPcm` with a check that says which kind the audio is:
    - `audio/l16`, or `codec=pcm` without `wav`, means raw PCM.
    - `audio/wav`, `audio/x-wav` or `audio/wave`, or bytes starting `RIFF`…`WAVE`, means WAV.
    - Anything else is passed through untouched.
  - **Parse the WAV by walking its chunks. Never assume a 44-byte header.**
    - Read `fmt ` and accept only format 1 (PCM), 16 bits, 1 or 2 channels.
    - Take the sample rate from the header, not from the MIME type.
    - Find `data`. Treat a declared size of 0 or `0xFFFFFFFF` as "to the end of the buffer". Respect the padding byte after an odd-sized chunk. Clamp to the buffer's length.
  - Encode mono as today. For stereo, pass both channels to the encoder, or downmix. Google documents it as mono, so this is only a guard.
  - **Anything unexpected returns the original audio unchanged.** That covers a malformed header, a format other than PCM, other bit depths and zero samples. Compression can never fail a request, which is today's rule.
  - Keep the lazy `import()` of lamejs, as CLAUDE.md requires.
  - Log the source kind and the bytes before and after.

### Phase 2 — frontend (then you deploy it)

- **`getTtsService.js`:**
  - `_buildTtsPrompt` becomes `_buildTtsRequest`, returning `{ transcript, style, model, explorerModel, feature }`.
  - `transcript` is the text as the reader sees it. `style` is the rendered template.
  - `askAI` receives the transcript as the prompt and `ttsStyle: style` in `providerParams`.
- **Guards, in the existing style:**
  - Warn when the template still contains `{{text}}`, which would put the transcript into the style.
  - Keep the `{{speechPace}}` warning.
- **Strip inline tag syntax from the transcript** (`<…>` and `|…|`), because 3.8 acts on those instead of speaking them. Normalising in code, as the project rules require. Learner text should never contain them, but AI-generated text could.
- **Fix the playback check.** Change `_playAudioBase64`'s `/L16|pcm/i` so it only matches raw PCM, as in the API. This matters when the encoder is unavailable and a WAV arrives uncompressed.
- **Update the fallback model constant** `GEMINI_TTS_MODEL` to `gemini-3.8-flash-tts`, alongside the API's `DEFAULT_TTS_MODEL`. The comment above it says they must match.
- **The in-memory clip cache** (`voice|lang|pace|hash(text)`) stays as it is. The style is derived from language, pace and template, and a template edit reaching open tabs only after a reload is today's behaviour too.

### Then, in Admin (you)

On `tts-build-prompt`:
- Set `model` to `gemini-3.8-flash-tts` and `explorerModel` to `gemini-3.8-flash-lite-tts`.
- **Rewrite the template as a style only, with no `{{text}}`.** It stays in English with the values as variables, for example:
  > Read aloud in {{language}} with a natural accent from {{region}}, at a {{speechPace}} pace, clearly and warmly, like a native speaker reading to someone practising the language.

### Phase 3 — confirm the real response

**Against the deployed API, with no key.** `/api/ask-ai` accepts anonymous Firebase sessions on purpose ("how API access works for tooling", as the handler's comment says). An anonymous session needs only the project's public web config, the same one every visitor's browser downloads.

Such a caller counts as Explorer. A request that sends only `model`, with no `explorerModel`, is generated by exactly that model, so each 3.8 model can be tested directly. Send `cacheable: false`, so test clips never enter the shared cache.

**Or with a response you capture**, from the browser's network tab, if that's easier on the day.

The API half can run as soon as Phase 1 is live. It doesn't have to wait for Phase 2.

It checks:

1. **The audio, before compression.** Log it on the server for a single test call, or send a request that the encoder will skip. Check:
   - The exact `inlineData.mimeType` string.
   - That the bytes start `RIFF…WAVE`.
   - The `fmt ` fields: format 1 (PCM), channels, sample rate, bits per sample.
   - Where the `data` chunk starts, and whether any other chunk sits before it.
2. **What reaches the browser:** `audio/mpeg`, with the expected size (about 8,000 base64 bytes per second).
3. **Listening, done by you.** I save the clips and send them to you.
   - The style isn't spoken.
   - A pt-PT style sounds European, and a pt-BR style Brazilian, on the same sentence.
   - "Slow" is audibly slower.
   - A one-word transcript (for example "casa") is read in the style's language rather than guessed. Single words are the most common clip in the games.
   - Flash and Lite, one after the other.
4. **Which voice-config shape each model accepted**, from the server log.
5. **Whether `speechConfig.languageCode` is accepted**, and whether it fixes single words if item 3 shows they drift.

Anything that differs from this plan becomes a small follow-up change to the Phase 1 code. Then run the in-app check under "Checks".

## Order of deployment

1. **API (Phase 1).** It accepts `ttsStyle`, and until the frontend sends one it behaves as today. Phase 3's API checks can start here.
2. **Frontend (Phase 2).** From here the transcript is only the text, so **the bug is fixed**. Until the template is edited, the style carries the old wording, which is never spoken.
3. **Admin: the template and both models.**
4. **Phase 3**, finished in the app.

Until this ships, the immediate fix is to set `tts-build-prompt`'s model back to `gemini-3.1-flash-tts-preview` in Admin and clear `explorerModel`. It's a preview model, so this only buys time.

## Consequences worth knowing

- **Explorer and paid users no longer share cached clips.** The cache key includes the model, and the Explorer swap in `ask-ai` runs before the cache lookup (line 339, then line 350). Each clip is generated once per model, not once overall.
- **The design is 3.8 only.** If an admin later sets an older model, the style field is ignored or refused, and the accent and pace are lost. Say so on the prompt's `description` in Admin, and in CLAUDE.md.
- **Every existing server-side clip is left behind**, because both the model and the key change. Each one is regenerated once, on first play.
- **The voice-preview sample in Settings** goes through the same service, so it's covered. Warming the cache means playing each voice once per interface language again.

## Checks

- **API tests:**
  - The style reaches the part as `speechMetadata`.
  - `ttsStyle` validation.
  - The cache key changes with the style.
  - **A WAV fixture compresses to MP3.** Fixtures: a minimal 44-byte header; a header with a `LIST` chunk before `data`; a data size of 0 or `0xFFFFFFFF`; an odd-sized chunk; a truncated file; a non-PCM format; 8-bit samples; stereo. Each has an expected outcome, and the bad ones pass through unchanged.
  - Raw L16 still compresses as today.
- **Frontend tests:** `_buildTtsRequest` keeps the transcript and the style apart, the `{{text}}` warning, tag stripping, and the playback check.
- Lint, `typecheck`, and both test suites and builds.
- **Deployed:** a preflight on every route after Phase 1 (the SDK bump), then Phase 3. In the app, listen to a pt-PT word, a sentence and a paragraph at both paces on an Explorer account (Lite) and a paid one (Flash). Confirm the clip plays, `ttsClips` stores it with a style and an `audio/mpeg` type, and a replay comes from the cache.
- Update both CLAUDE.md files: the model section, the cache-key note and the `ERR_REQUIRE_ESM` checklist.

## Effort

About half a day: roughly two hours in the API (mostly the WAV parser and its fixtures), an hour in the frontend, and the checks. Phase 3 is about 30 minutes, plus your listening.
