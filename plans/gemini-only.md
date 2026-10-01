# Gemini as the only AI provider

**Status:** queued. Written 2026-10-01.
**Why:** you don't plan to use any provider but Gemini. The API still carries
three, with two keys, two SDK paths and two subprocessors in the privacy
policy that do almost nothing. This plan reviews each one, then removes
OpenAI and Perplexity.

## Where things stand

| Provider | Code (API) | Called by the app | Used for | Default model |
|---|---|---|---|---|
| **Gemini** | `lib/providers/gemini.ts`, `api/live-token.ts` | About 35 calls across every AI service | Everything: text, JSON, images in, audio in, speech out (TTS), the live tutor | `gemini-3.5-flash-lite`, `gemini-3.8-flash-tts` |
| **OpenAI** | `lib/providers/openai.ts` (JSON mode always on) | **One call:** `src/services/tutorUrlValidation.js` | Judging whether a tutor's link is acceptable (`tutor-link-validate-prompt`) | `gpt-4o-mini` |
| **Perplexity** | `lib/providers/perplexity.ts` (built on the OpenAI SDK) | **None** | Nothing. Its one distinct ability, live web search, isn't used anywhere. | `sonar` |

Three things the table hides:

- **An unknown provider is sent to OpenAI.** `api/ask-ai.ts` has
  `case 'openai': default:`, so a typo in `provider` quietly bills OpenAI
  instead of failing.
- **The OpenAI client is created when the module loads, and it throws
  without a key.** `openai.ts` builds `new OpenAI(...)` at the top of the
  file, and the SDK throws "Missing credentials" when `OPENAI_API_KEY` is
  unset. `ask-ai.ts` imports it, so **removing the key from Vercel before
  the code would break every AI feature, not just the tutor check.** The
  order below exists because of this.
- **Images and audio are Gemini-only already.** `ask-ai` rejects them for any
  other provider, so the voice, photo and listening features never had a
  fallback anyway.

## What removing them gains, and costs

**Gains**
- **One key and one bill.** One fewer SDK (`openai`) and simpler types.
- **Two fewer subprocessors** in the privacy policy and Terms (OpenAI,
  Perplexity AI). Tutors' links stop going to a second US company.
- **No silent fallback** to a paid provider.

**Costs**
- **One vendor.** A Gemini outage, or a problem with its key, stops every AI
  feature. In practice that's already true: only the tutor link check runs
  elsewhere. Phase 4 has the cheap mitigation, if it's ever needed.
- **No live web search on hand.** Nothing uses it today. If a feature ever
  needs fresh facts from the web (TV listings, news), Gemini has Grounding
  with Google Search: 5,000 free requests a month across Gemini 3.x, then
  $14 per 1,000. Its terms require showing Google's search suggestions with
  grounded answers, so read them before building on it.

## Phase 0: review (no code)

1. **Prompt documents.** In Admin › Prompts, confirm no document names an
   OpenAI or Perplexity model in `model` or `explorerModel`, especially
   `tutor-link-validate-prompt`.
   - Services set `provider` in code, so a `provider` field on a document is
     ignored anyway; delete any you find so nobody is misled.
   - A `gpt-…` model left on that document would be sent to Gemini after
     Phase 1 and fail.
2. **Vercel logs.** Count `ai_request_start` by `provider` over the last 30
   days.
   - **Expected:** `openai` only from tutor link checks, and no `perplexity`
     at all.
   - **Anything else** is a caller this review missed.
3. **The providers' own dashboards** (you): usage over the last 30 days, and
   any subscription or prepaid credit to cancel or use up.
4. **Tutor link verdicts.** Before switching, write down 10–15 links and the
   verdict each gets today:
   - known platforms;
   - personal sites;
   - a link shortener;
   - a social profile;
   - something plainly wrong.

   The same list is checked after Phase 1.

## Phase 1: move the tutor link check to Gemini (frontend)

- **`src/services/tutorUrlValidation.js`:**
  - `provider: "gemini"`, with `jsonMode: true` and a `responseSchema` for
    the verdict (`ok`, `platform`, `reason`). This replaces OpenAI's
    `json_object` mode, which was always on.
  - `model: promptDoc.model || GEMINI_MODEL`, the same fallback constant as
    the other services. `explorerModel`, `feature`, `skipConfirm` and the
    20s timeout stay.
  - Its comment about OpenAI's defaults goes.
- **Tests:** `test/unit/tutorLinkPrompt.test.js` (line 88 asserts
  `provider: "openai"`).
- **Prompt wording:** the template was tuned on `gpt-4o-mini`. If the
  Phase 0 list gives different verdicts on Gemini, adjust the wording in
  Admin, not in code.
- **What the tutor sees doesn't change.** `validatedBy` records `ai`, not a
  provider name, so stored links need nothing.
- **Ship it, and wait a day** before Phase 2.
  - **Phones catch up first.** Installed apps reload for the new version on
    their next page change (the stale-deploy fix).
  - **A stragglers' request** still sending `openai` after Phase 2 gets a
    400, which this service already turns into "couldn't validate", not an
    error screen.

## Phase 2: remove them from the API

- **Delete** `lib/providers/openai.ts` and `lib/providers/perplexity.ts`, and
  their tests in `test/lib/providers/`.
- **`api/ask-ai.ts`:**
  - the provider `switch` becomes Gemini only;
  - any other value is a **400 "Unsupported provider"**, with no default;
  - the comment at line 131 ("paid OpenAI/Gemini/Perplexity API keys")
    changes;
  - the image and audio "only supported by the gemini provider" checks
    become redundant. They fold into the provider check.
- **Keep `providerParams.provider` required for now.** Every client sends
  `'gemini'`, and making it optional is a later, separate tidy-up.
- **`lib/types.ts`:**
  - `ProviderName` becomes `'gemini'`;
  - `OpenAIParams` and `PerplexityParams` go;
  - `ProviderParams` becomes the Gemini parameters plus the shared hints.
- **`package.json`:** remove `openai`. Only the two deleted files import it;
  confirm with a search before removing.
- **Tests:**
  - **`test/api/ask-ai.test.ts`** uses `provider: 'openai'` as its everyday
    provider in about 15 places. Switch them to Gemini.
  - **The explorer-model test's comment** says the call "runs on OpenAI".
  - **The other two ask-ai test files** mock the deleted modules
    (`ask-ai.limits-paused.test.ts` and `ask-ai.tts-cache.test.ts`).
  - **New test:** an unknown provider gets a 400 and calls nothing.
- **Docs:**
  - `CLAUDE.md` lines 16, 22, 86;
  - `README.md` lines 191 and 267 (env vars);
  - `lib/email.ts` line 10, a comment that points at `perplexity.ts`.

**Then, in this order (you):**
1. Push and let Vercel deploy.
2. **Only after the deploy is live,** remove `OPENAI_API_KEY` and
   `PERPLEXITY_API_KEY` from the Vercel project.
3. Revoke both keys in the OpenAI and Perplexity dashboards.

## Phase 3: the privacy policy and Terms

All in `src/locales/pt/translation.json`:
- **Privacy:**
  - the AI paragraph (around line 306) and the subprocessor list in §4
    (around line 323) drop "OpenAI" and "Perplexity AI";
  - `last_updated` (line 289) moves to the release date.
- **Terms:**
  - the two lists of AI and third-party services (around lines 264 and 269)
    drop both;
  - `last_updated` (line 238) moves too.
- **Other languages:** they live in Firestore, so they need the force resync
  after the push.
- **Keep `errorUtils.js` as it is.** Its list of provider names (OpenAI,
  Perplexity, Anthropic…) only stops any provider name reaching the user,
  and is harmless and future-proof.
- **Release this phase with Phase 2,** so the policy never names a provider
  the app doesn't use, nor misses one it does.

## Phase 4, optional: resilience with one vendor

Only if Sentry starts showing Gemini outages:
- **A sibling model on overload.** On a 503 or a capacity 429 from Gemini,
  retry once on a sibling model (for example flash-lite to flash). That's a
  few lines in `gemini.ts`, logged so it's visible in Pulse.
- **Grounding with Google Search,** as the Perplexity replacement, when a
  feature needs live web facts. Mind its display requirement.

## Traps

1. **Key before code takes down every AI feature,** because the OpenAI client
   throws at module load. Code first, then keys.
2. **An OpenAI model id left on a prompt document** gets sent to Gemini and
   fails ("model unavailable"). That's Phase 0, step 1.
3. **JSON behaves slightly differently.** OpenAI's `json_object` mode versus
   Gemini's `jsonMode` with a schema. The schema is stricter, which is
   better, but compare the verdicts (Phase 0, step 4).
4. **Old phones sending `openai`** get a 400 after Phase 2. That's harmless,
   because the tutor check fails soft.
5. **Old Pulse and log rows** still say `openai`. No migration; they're
   history.

## Verification

```bash
cd C:/Nuno/Projects/GrasshopperWebSite/proxies/multi-lingo-ai-api && npm run typecheck && npm test
cd C:/Nuno/Projects/GrasshopperWebSite/projects/multi-lingo-ai && npm run lint && npm test && npm run build
```

1. **After Phase 1:** the Phase 0 link list gets the same verdicts, through
   the deployed API.
2. **After Phase 2:**
   - a request with `provider: 'openai'` gets a 400 (anonymous session on the
     deployed API);
   - a normal Gemini text call, a TTS clip and a photo capture still work.
3. **After the keys are removed:** the same three Gemini checks again. A cold
   start must not fail.
4. **The privacy and Terms pages** render the new lists and dates in pt-PT.

## Open questions

1. **Keep `provider` required** (always `'gemini'`) for now and drop it later,
   or drop it in this change?
2. **Phase 4's sibling-model retry:** build it now, or wait until outages
   show up?
