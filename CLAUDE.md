# CLAUDE.md

This is the primary project brief for AI agents working in this repository. Read it before answering questions, proposing changes, or editing code.

## Mandatory workflow

1. Read this file first.
2. Decide whether the task belongs in the frontend repo or the sibling API repo.
3. Reuse existing project patterns instead of inventing new ones.
4. Keep backend logic out of this repo unless the change is truly frontend-only.
5. Validate with the smallest relevant command before finishing.

## Project boundary

This repository is the frontend app only.

The real backend lives in the sibling repo:
C:\Nuno\Projects\GrasshopperWebSite\proxies\multi-lingo-ai-api

This frontend talks to that backend through the shared proxy wrapper and the VITE_PROXY_URL value. It is the client/UI layer only.

Any task involving auth, Firestore, AI requests, subscriptions, billing, storage, quotas, or data writes should be checked against the API repo before implementation.

## Commands

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test              # vitest run — blocking in CI
npm run test:watch
npm run test:coverage
```

**710 tests across 27 files, ~57% line coverage, blocking in CI.** It started as a dependency guard — two production outages came from bumps that passed `lint` and `build` cleanly — and grew into partial behaviour coverage.

- `test/canaries/` — one assertion per library behaviour no static check can see: `defaultProps` still applying, routes still resolving, `motion.div` still rendering a div, `t()` still looking keys up, every imported lucide icon still existing, every literal `t()` key resolving in the pt-PT bundle.
- `test/smoke/pages.test.jsx` — 37 pages mount, paint, stay out of the error boundary, and render no raw translation keys. **Feature pages assert the route shell only**: each is a Suspense wrapper, so the assertion passes while the lazy chunk is still loading. The heavy components are covered directly instead.
- `test/unit/` — utils and puzzle generation (~92%), the service layer, AppProvider, the games and exercises mounted directly with fixtures, admin sections and modals, and ErrorBoundary.
- `test/helpers/appContext.js` — a complete inert AppContext value. It must stay a **superset** of the real provider's value; `appContext.test.jsx` compares the two and fails if the fake falls behind, because a page destructuring a missing key breaks in a way that looks like a dependency regression.

Two conventions worth knowing before adding a test:

- `test/setup.js` makes an **unmocked `fetch` reject loudly**, which is right for unit tests — it names the call you forgot. For a component render it is wrong: the component catches the rejection and renders its error state, so the test passes against an error screen. Integration-style files override it with an empty success envelope; copy that pattern rather than removing the strict default.
- Mock **at the seam the code actually uses**. `userService` calls `fetch` directly rather than going through `apiFetch`, and its internal calls go through module-local bindings that a `vi.spyOn` on the namespace never sees.

Coverage is uneven on purpose: `src/utils` is ~92%, `src/services` ~54%, `src/components` ~53%, and interaction paths are thin — most components are asserted to *render*, not to behave. So the verification bar for anything behavioural is unchanged: run the dev server and exercise the affected screen in the browser. "It builds and tests pass" is still not evidence that a feature works.

## Architecture summary

- Vite 8 (rolldown bundler) + React 18 SPA
- React Router v7 (`BrowserRouter` + `<Routes>`; the v6 API this app uses carried over unchanged)
- Single global store in src/contexts/AppContext.jsx
- Firebase Auth only in the frontend; no Firestore/Storage SDK usage on the client
- All backend data access goes through the sibling API repo via apiFetch and the proxy layer
- i18next 26 / react-i18next 17, with pt-PT bundled and every other locale served from Firestore
- Deploys to **GitHub Pages**, not Vercel — only the API is on Vercel. This is why Vercel Web Analytics cannot see this app, and why `deploy-prod.yml` is a Pages workflow.

## Error handling and monitoring

- `src/components/ErrorBoundary.jsx` is mounted twice: at the root in `main.jsx` (above `BrowserRouter`, so it catches a crash in `AppProvider` itself) and around `<Routes>` in `App.jsx` with `resetKey={pathname}`, so navigating away from a broken page recovers without a reload. It depends on nothing the app provides — no context, no `useTranslation`, no router — because it has to work when one of those is what broke; copy goes through the i18next singleton behind a `safeT()` fallback and the theme is read straight from localStorage.
- `src/sentry.js` initializes Sentry. Errors only, and deliberately so: no Session Replay, no tracing, no session tracking, `sendDefaultPii: false`. Two SDK defaults are filtered out in `initSentry()` — `browserSessionIntegration` (it emits a session event per route change, which is per-page-view telemetry the privacy policy rules out) and console breadcrumbs. **Do not add Replay, tracing, or analytics without changing the privacy policy first** — sections 2.7 and 3.4 make specific promises, and section 4 lists Sentry as a subprocessor on the basis that it only does fault-fixing.
- `ErrorBoundary` reports from `componentDidCatch`, because React swallows an error once a boundary handles it and it would otherwise never reach Sentry.
- Inert without `VITE_SENTRY_DSN`, which is why CI passes an empty value and local dev reports nothing.

## Notifications

- `src/services/notificationService.js` + `src/components/NotificationSettings.jsx` own web push (FCM) and the per-category opt-outs. Push is **off by default** and requires an explicit browser permission grant; `public/firebase-messaging-sw.js` is the service worker and `VITE_FIREBASE_VAPID_KEY` is required or `isPushAvailable()` is silently false.
- Categories are `transactional` (always delivered, not opt-outable), `announcements` and `reminders`. Nothing currently sends `reminders`.
- The toggles are a convenience, not the enforcement point — the backend re-checks the stored preference before every send.
- The report button writes to Firestore (`appConfig/config/reports`) via `src/services/reportService.js`, and admins read/triage them in the admin page. It no longer sends to WhatsApp.
- **Broadcast email is queued, not sent.** The composer reports how many were queued and how deep the outbox is; the API releases 75 a day (Resend's free tier is 100/day, and the rest is headroom for transactional mail). Push still goes out immediately. See `lib/mail-queue.ts` in the API repo.

## Email templates

`src/components/admin/EmailTemplatesSection.jsx` edits the transactional email copy. It is **not** a separate template store: it writes the `email.*` keys of the pt-PT locale document, the same keys the API resolves through `lib/email-copy.ts`. That is deliberate — a standalone template collection would sit outside the AI-fill pipeline and every language but one would go stale.

Two consequences worth knowing before touching it:

- Edits land on the base locale only. Reaching the other languages is the existing force resync in the Locales section, which re-translates from pt-PT and **overwrites hand-tuned per-language wording**. The editor says so on screen.
- `saveEmailTemplates` patches only the keys that actually changed, using dot-notation paths through the same `patchDocument` the translation pipeline uses. Writing the whole `email` object back would clobber any key not listed in `TEMPLATE_GROUPS`.

`TEMPLATE_GROUPS` is an explicit list rather than something derived from the bundle, because `email.common.*` is shared chrome that appears in every message and should not look like it belongs to one email. `TEMPLATE_VARIABLES` mirrors the `{{...}}` placeholders actually present in the base copy — dropping one renders a literal `{{tier}}` in a real email.

## Tutor directory

`/dashboard/real-person-tutor` (`src/pages/dashboard/TutorsPage.jsx`) lists tutors from a **public top-level `tutors` collection keyed by uid**, not from a map on the user document. That is forced, not chosen: a non-admin cannot query `users` or read another user's `users/{uid}` at all, so a directory sourced from user documents could never be rendered.

- **Publishing is server-gated twice**: `tutors` is `{ read: 'public', write: 'own-doc-id', writeTiers: ['maestro','vip','admin'] }` in the API. The uid lock stops one user claiming another's slot; the tier gate is read from `subscriptionTier`, which users cannot set. `canBeTutor()` in `tutorService.js` is UI-only and is not what keeps anyone out.
- **The Settings editor is hidden until a document exists — it never synthesizes one.** `TutorProfileSection` renders `null` for an eligible-tier user with no tutor doc; there is deliberately no "fill this in and it gets created on Save" path. `createTutorDraft()` (`tutorService.js`) is the *only* thing that creates one — always hidden (`published: false`), name/picture/email from the account, empty description — called from the small "Become a tutor" button at the bottom of the directory page, which then routes to `/settings#tutorSettings`. An ineligible-tier visitor sees "Apply to become a tutor" instead, which routes to the same anchor without writing anything (the application form is what's there). That button is deliberately small and out of the results grid, not a dashed placeholder card — deciding whether to become a tutor isn't a listing, and giving it a whole grid cell overstated it.
- **Visibility is one checkbox, not a delete.** "Publish my profile" — checked = `published !== false`. Toggling it calls `saveTutorProfile({ published: true, ... })` or `unpublishTutorProfile()` (which only flips the flag), immediately, not gated behind Save. The same flag the Stripe webhook sets when a subscription lapses, so a lapsed-then-renewed tutor's description and links come back rather than needing to be re-entered.
- **The viewer's own listing is pinned first on the directory page, published or not.** `TutorsPage` fetches `getTutorProfile(user.uid)` alongside the public `listTutors()` and dedupes it out of the public list — a hidden profile never appears in `listTutors()` (published-only), so this second fetch is the only way the owner ever sees their own draft, badged "Hidden" with an "Update my profile" button to `/settings#tutorSettings`.
- **Languages spoken** (`languages: string[]` on the tutor doc) use the same known-list-plus-Other pattern as the interface/learning-language pickers in Settings (`NeoDropdown` + `seedLanguage`), but add to a list rather than replace a single value. Not required to publish.
- **Search and the language filter are entirely client-side**, over the already-fetched full list (`listTutors()` has no server-side filter). `Pagination` (`components/ui/Pagination.jsx`) slices that filtered array; it is written generic — no tutor-specific prop — for reuse once another list needs paging. The trailing "more tutors are applying" placeholder is a single generic card, hidden while a search or language filter is active (it would otherwise read as a false match) and shown only on the last unfiltered page.
- **The language filter renders as a dropdown, not chips** — one option per known language is well past the five-option threshold where `SearchBar` switches shape (see `components/ui/SearchBar.jsx` below). This is the caller that shape exists for.
- **Link validation is derived, never stored for the free path.** `linkValidation(link)` in `src/services/tutorUrlValidation.js` is a pure function of the link: a hostname in `src/config/tutorPlatforms.js` validates instantly and free. Only the AI verdict is persisted, and only while `validatedUrl` still matches the current URL. An earlier version computed the local match in an `onBlur` handler and a recognised host could stay marked unvalidated, because the handler closed over a stale `links` array — do not move this back into an event.
- Hostname matching walks the label boundaries, so `nuno.youcanbook.me` matches `youcanbook.me` but `notpreply.com` does **not** match `preply.com`.
- Save is blocked until every link validates. Re-checked in `saveTutorProfile` as well as the form, so stale component state cannot publish an unvalidated URL.
- **Brand icons for known link platforms** (`config/platformIcons.jsx` + `platformIconMap.js`) are hand-drawn, not from a package — lucide-react 1.x carries no brand icons at all (see Dependencies below), and a library like simple-icons ships every brand's mark to cover the eight used here. Split into two files on purpose: `platformIcons.jsx` exports only components (each icon), `platformIconMap.js` exports only the lookup object — mixing the two in one file trips `react-refresh/only-export-components` on every icon export. Two platforms (Threads, Bluesky) have no icon; their mark doesn't reduce to something drawable with confidence at 16px, and a wrong-looking glyph is worse than the generic fallback already there.
- Applications (`appConfig/config/tutorApplications`) mirror the reports pattern exactly. There is **no approved flag** — approval is granting the applicant the `vip` tier in Admin → Users, which is what the server actually checks.
- `queryCollection` resolves to `{ documents, ... }` and `getDocument` to `{ id, data, collection }`. Neither is a bare array or a bare document; forgetting that is how the first version of the directory threw `docs.map is not a function`.

## SearchBar — one filter API, chips or a dropdown depending on size

`src/components/ui/SearchBar.jsx` takes `filterGroups`, an array of independent filter dimensions (`{ id, label, options, activeValues, onToggle }`), not a single flat `filters` list. A group with `FILTER_DROPDOWN_THRESHOLD` (5) options or fewer renders as the original one-tap chip row; past that it renders as a multi-select dropdown instead, because a long chip row wraps into several lines and turns "which are active?" into a hunt — the tutor directory's language filter (one option per known language) is the caller this exists for. A group's own `label` is shown only once there's more than one group; every existing single-dimension caller (Users' tier filter, Prompts' category filter, Tutors' language filter) reads exactly as before, just capable of collapsing.

The clear button — the small × inside the search input, shown once there is search text or any active filter — is not a new callback SearchBar invented. It calls `onSearchChange("")` and then, for every group, calls that group's own `onToggle(value)` once per currently-active value — the same thing a second click on an active chip already does. This only works because every caller's toggle uses a functional state update (`setX(prev => ...)`); keep that when wiring a new group, or repeated synchronous toggles in one tick will race each other instead of clearing.

Migrating a caller from the old `filters`/`activeFilters`/`onFilterToggle` shape is mechanical: wrap the three into one `filterGroups={[{ id, label, options: filters, activeValues: activeFilters, onToggle: onFilterToggle }]}`. `PromptsSection`'s separate hand-rolled "Clear filters" link was removed when it migrated — the bar's own clear button now covers it (and also clears the search text, which the old link didn't).

## RequireAuth — every /dashboard/* route needs a signed-in user

`src/components/RequireAuth.jsx` wraps the `/dashboard` route in `App.jsx`, alongside the existing `RequireOnboarding`. It redirects a signed-out visitor to `/` once `isLoadingUser` settles.

This replaced a real bug: `DashboardLayout` used to render `if (!user) return <Loader fullScreen .../>` with nothing that would ever change that — no redirect, no timeout. A guest opening any `/dashboard/*` URL (a shared tutor-directory link, a bookmark, a second tab after signing out) got a spinner that never resolved. `DashboardLayout`'s own `!user` branch now returns `null` — defensive only, since `RequireAuth` should mean it's unreachable — rather than repeating the same shape of bug at a second layer. Do not add a full-screen loader anywhere that has no corresponding path back out; a loading state needs a guard that eventually decides "yes" or "no", not just "wait".

## Dependencies

Dependabot is configured in `.github/dependabot.yml`, grouped so minor/patch updates arrive as two PRs a week and majors arrive individually — ten green PRs at once is how a real break gets merged. `npm test` now runs blocking in CI ahead of `build`, so a bump that breaks rendering fails the PR instead of reaching Pages.

Three upgrades are currently blocked, and all three will keep being proposed:

- **React 19** — blocked by this repo, not by upstream. 41 components still declare defaults via `Component.defaultProps`, which React 19 **removes for function components**. Every one of those defaults silently becomes `undefined`: the first symptom seen was the dashboard feature grid losing its `gridClassName` and collapsing to a single column, but the blast radius is every component that declares one. React 18.3 already logs a deprecation warning for each one. The fix is to convert them to default parameter values in the destructuring — `({ gridClassName = "grid grid-cols-2 lg:grid-cols-3 gap-4" })` — after which React 19 is a normal upgrade. Do that as its own change, not bundled with anything else.

  **Standing decision: stay on React 18 and let CI reject the bump.** `test/canaries/react-defaultprops.test.jsx` fails the moment React stops honouring defaults, and also reproduces the single-column dashboard symptom directly. That PR failing is the guard working — never make it pass by weakening the test.
- **jspdf** is the one runtime dependency added for a feature rather than the
  toolchain. Pinned by the usual caret; it is loaded dynamically, so a broken
  bump degrades the export rather than the app.
- **ESLint 10** — `eslint-plugin-react` has no release that accepts it (peer-caps at `^9.7`). Forcing it with `--legacy-peer-deps` is not the answer.
- **firebase-admin 14** in the sibling API repo — unrelated to this app, but the same lesson: it passed every local check and took production down. See that repo's CLAUDE.md.

`defaultProps` is a trap worth naming: no *static* check catches it. It type-checks, lints, builds, and renders — the component just quietly uses `undefined` instead of the default. Only the canary above catches it, and only because it renders a component and asserts on the result. `grep -rn "\.defaultProps" src/` is the inventory.

## Critical repo rules

- Use src/services/apiClient.js and apiFetch for backend requests instead of raw fetch.
- Treat the sibling API repo as the source of truth for backend behavior, Firestore access, storage, AI quotas, and Stripe logic.
- Do not hardcode user-facing strings; use the translation pipeline and existing i18n keys.
- Reuse shared components before creating new UI.
- Follow the route guard and lazy-loaded dashboard patterns already used in src/App.jsx.
- Run npm run lint after frontend edits and resolve warnings before considering the work done, then `npm run build`, then verify the affected screen in a browser against the dev server. The first two do not exercise the app.
- Do not add analytics, tracking, or Sentry features beyond error capture without reading the privacy policy strings in `src/locales/pt/translation.json` first — several of them make explicit promises about what this app does not do.
- Editing an existing locale string does not propagate: `fillMissingTranslations` only fills keys that are *missing*. Changing wording in pt-PT needs the admin force resync, or every other locale keeps the old text.

## Story translations are collapsed, the title is not

The bilingual reader shows the target-language paragraph with its translation
**closed**, one toggle per card plus a show-all for the whole story. Open by
default was the original design and it defeats the exercise: with both columns
on screen the eye goes to the language it already knows and the target text is
never really read. The title is the deliberate exception — always translated,
because it is the one line that tells a reader whether the story is worth
starting.

## i18n workflow

This project loads locales from Firestore and then syncs them into i18next. The key rules are:

- pt-PT is the base locale: `src/locales/pt/translation.json` is the ONLY locale
  bundled with the code, and it is the source every other locale is translated
  from. The constant is `BASE_LOCALE`, exported from `src/i18n.js` — use it
  rather than writing the literal. Add new UI strings there and nowhere else.
- en-US is not special any more. There is no local English locale file; en-US is
  an ordinary Firestore target locale, translated from pt-PT like the rest.
- The one hardcoded English left is `src/config/seoStrings.js` — crawler-facing
  head copy and FAQ structured data for the 5 public routes, baked into static
  HTML by `scripts/generate-seo-pages.mjs`. It is deliberately NOT a locale file:
  that audience does not follow the interface language. The locale files still
  carry `seo.*_title` for the browser tab (usePublicPageTitle); reword both.
- Keep locale loading dynamic; do not assume a static list is enough.
- Use the existing translation loading flow instead of inventing a new one.
- Do not add a hardcoded supportedLngs list unless the existing behavior is deliberately reworked.
- Use the translation service and existing keys before adding new strings.
- When working on locale loading, follow the i18n skill in .github/skills/i18n/SKILL.md.

### Translating a locale: chunked, parallel, and tolerant of a bad chunk

`seedLanguageTranslations` (a brand-new language) and `fillMissingTranslations`
(new keys added to an existing one) both go through `translateChunks`. The base
document is ~56KB, well past the backend's hard `MAX_PROMPT_LENGTH = 8000`, so
it is split by `splitIntoChunks` into subtrees of `CHUNK_SIZE_BUDGET_BYTES` and
each is translated by its own `ask-ai` call.

Those calls run **`CHUNK_CONCURRENCY` (4) at a time**. They used to run one
after another, which made adding a language take the sum of ~14 round-trips —
long enough that people navigated away mid-run. Four is chosen against Gemini's
rate limit on the shared API key, not against Vercel concurrency, which is far
higher on Pro: firing all fourteen at once would earn a 429 for every other AI
feature in the app at the same moment.

**A chunk that fails is skipped, not fatal.** `requestTranslatedChunk` still
escalates the output budget and then bisects the chunk, but when even that
fails, `translateChunks` records the failure and moves on. Its keys are simply
absent from the document — and *missing* is the state this app already handles:
i18next falls back to the base-locale string, `saveMissingHandler` reports it,
and the next `fillMissingTranslations` run translates it. Do not "fix" this by
writing empty strings instead: `findMissingDeep` tests `key in target`, so a
`""` counts as present and would never be repaired, and i18next renders it as a
legitimate (blank) translation. The two guards on top of the skip are that a
seed where *every* chunk failed throws rather than creating an empty document
that looks seeded, and that the prompt-length check runs over all chunks up
front — it trips on a misconfigured prompt template, not on content, so it
would fail identically for all of them.

## Backend contract to remember

If a task touches any of the following, inspect the sibling API repo before deciding on the fix:

- /api/auth
- /api/firestore
- /api/storage
- /api/ask-ai
- /api/stripe

## User-scoped list data: "seen" vs "favourites"

Two different mechanisms keep arrays of ids on the user's own `users/{uid}`
document. Do not conflate them or share fields between them.

**Seen ids** — `src/services/userService.js`, fields named `seen*`
(`seenConceptIds`, `seenStoryIds`, `seenHistoryFactsIds`, ...). Append-only
progress tracking, so the app can stop serving content a user has already had.
Ids go in one at a time and only come out via a wholesale reset. There is
deliberately no "remove one" — un-seeing a single item is meaningless.

**Favourites** — `src/services/favouritesService.js`, fields named `fav*`
(`favGrammarTipIds`, `favStoryIds`, `favWordIds`). A user-curated list behind a
heart toggle, so ids must go in *and out* one at a time. That add/remove
requirement is the reason it is a separate service rather than more `mark*Seen`
helpers.

Rules for favourites:

- Go through `favouritesService`; never write a `fav*` field directly.
- Kinds live in `FAVOURITE_KINDS`; the kind → field mapping lives in that
  service. Adding a new favouritable thing means adding one entry to
  `FAVOURITE_FIELDS` and nothing else — fields are created lazily on first
  write, so there is no migration or seeding step.
- Read with `getFavouriteIds(user, kind)` off the AppContext user (synchronous,
  no network). Only use `fetchFavouriteIds` when there is no loaded profile.
- After a `toggleFavourite`, update the AppContext user with
  `favouriteFieldFor(kind)` so the state survives navigation without a re-read.
- Persisting is a whole-array write through the existing `/api/firestore` PUT
  (`updateUserProfile`) — no new endpoint. Concurrent writes from two devices
  can lose one change; that is an accepted trade-off for a favourites list.
- The UI control is `components/ui/FavouriteButton` (controlled: the caller
  owns the state and does the persisting).

## Feature gating: `hidden` vs "granted to nobody"

Features live in `appConfig/config/features` and are gated two independent ways.
Do not conflate them:

- **Grants** (`features` array on each tier in `tiersConfig`) decide who may
  *use* a feature. A feature granted to nobody is still advertised — it renders
  with a "Coming Soon" / "Incoming" badge, because the dashboard doubles as the
  upsell surface.
- **`hidden: true`** on the feature document keeps it out of every listing for
  tiers below VIP: no dashboard tile, no pricing row. This is the launch switch
  for something still under test. VIP (beta channel) and Admin are unaffected.
  It is a listing filter only — it does not gate `canAccess`, so a hidden
  feature stays reachable by direct URL for anyone whose tier grants it.

Anything that lists features must filter first: `useTierAccess().isVisible(key)`
for the viewer, or `isFeatureVisible(feature, tierId)` from
`utils/featureAccess` when asking about a tier other than the viewer's (the
pricing page). Adding a dashboard tile without that filter leaks hidden
features. Toggle the flag in Admin > Features.

## PDF export reaches exactly as far as the font does

Stories and history/culture pieces export through `utils/readingPdf` — one
builder, because both hand over the same `{title, paragraphs}` shape. It runs
entirely in the browser: no AI call, no request, nothing billed, which is why
it is offered to every tier rather than gated.

**The limit is the font, and it is not a detail.** jsPDF's built-in Helvetica
encodes WinAnsi (CP1252): Portuguese, Spanish, French, German, Italian, Dutch
and Catalan print correctly, accents and curly quotes included. Cyrillic,
Greek, Thai and CJK have no glyph and would come out blank — and this app
seeds Russian, Thai, Japanese and Chinese. So `findUnsupportedCharacters`
answers the question *before* anything is generated: `DownloadPdfButton` asks
it and renders disabled with a reason, and `buildReadingPdf` throws
`UNSUPPORTED_SCRIPT` if called anyway. A file full of blanks is worse than no
file.

Lifting the limit means embedding a real Unicode TTF via
`addFileToVFS`/`addFont` — a font per script, several hundred KB each, fetched
on demand rather than bundled. The seam is `selectFont()`; register a font and
everything else in that module keeps working.

The page is set in **Times**, jsPDF's built-in serif — a story should read
like one, and it costs nothing and carries the same WinAnsi limit. Small
uppercase running text (masthead, meta line, footer) stays in the sans, which
is what `selectFont`'s `role` argument is for.

**The opening capital is hand-laid.** jsPDF has no float and no text flow, so
`drawDropCap` sizes a capital to span `CAP_LINES` body lines, wraps that many
lines at a width narrowed by the capital, and hands the remainder back to be
set normally. Two details are load-bearing: it shrinks the capital to the
lines actually beside it (a three-line capital next to a two-line paragraph
hangs in a hole), and it **declines** — returning null, so the paragraph is
set plainly — when the text opens on punctuation or when the wrapped lines
cannot be rejoined to the original prefix. Losing a flourish is fine; losing
or duplicating a sentence is not. Only the first paragraph gets one, per book
convention; `CAP_ON_EVERY_PARAGRAPH` flips that.

**Two things keep the file small, and both were learned the hard way.** jsPDF
stores an image's *decoded* pixels, so embedding the 512x512 app icon whole
added 1MB — exactly 512 x 512 x 4 — to a one-page document. `loadLogo`
re-encodes it at `LOGO_PIXELS` (128, generous for an 11mm mark at 300dpi), and
the document is constructed with `compress: true`. Together those took a
typical story from 1,054KB to 8KB. A missing icon degrades to a PDF without
one rather than a failed export.

Two structural notes. `buildReadingPdf` returns the document and
`exportReadingPdf` saves it — split that way because `save()` returns nothing
to assert on, so the layout would otherwise be untestable. And jsPDF is
imported dynamically: it is its own ~130KB gzipped chunk that only downloads
when somebody exports.

## The word bank is the WORD favourite kind, not a new mechanism

Words a reader collects while practising are `FAVOURITE_KINDS.WORD` in
`favouritesService` — the `favWordIds` array on `users/{uid}` that had been
declared and unused since the favourites service was written. `useWordFavourites`
wraps it exactly as `useFeatureFavourites` wraps the FEATURE kind: optimistic
write, roll back and surface the error if the write fails. Do not add a
parallel "wordBank" field.

The id **is** the word, normalised in the hook (`normaliseWord`: trim, collapse
inner whitespace, lower-case) so a word tapped in a title and the same word
tapped in a paragraph are one entry. Normalising at that boundary rather than
per call site is what lets a caller ask `isFavourite(rawToken)` and get the
right answer.

**Tap and hold are two actions on one word.** Tap opens the dictionary sheet,
hold (500ms, `useLongPress`) banks the word. A double tap was the other option
and was rejected: disambiguating it costs the tap a ~300ms delay, and the tap
is the primary action. The hook fires its click from `pointerup` — by then it
knows whether the hold already fired — and suppresses `contextmenu`, which
otherwise raises the selection UI over the word being held on touch. The word
spans carry `select-none` for the same reason.

**`getFavouriteIds` returns a fresh `[]` when the field does not exist yet.**
The array is returned by reference when it is there — deliberately, so
callbacks keyed on it are stable — but a profile with no `favWordIds` gets a
new empty array on every call. An effect that depends on that array therefore
re-runs on every render; if it also sets state with a newly built array, the
result is an infinite render loop that hangs anything mounting the page. Key
such effects on the contents (a joined string), and return the previous state
unchanged when nothing moved so React can bail out.

**Selected words force a generation.** No cached story can be guaranteed to
contain the reader's own words, so `getStory` treats `requiredWords` exactly
like a custom `description`: skip the pool, generate, and let the result land
in the shared pool anyway. That is why the sidebar's selection is gated on the
same rule as the custom-request box (`canAccess("custom_requests") ||
cacheExhausted`) — a second unlocked route to the same AI call would make the
tier gate meaningless. Removing a word is never gated; it is housekeeping.

The words reach the model through `{{requiredWords}}` in the admin-edited
`story-generate-prompt`. A template without that placeholder drops them
silently, so `_generateStory` warns when words were requested and the
placeholder is absent — same guard as `{{speechPace}}` in `getTtsService`.

## Two things the signed-out visitor breaks if you forget them

The public surface (landing page, pricing, contact) is browsed by people with
no account, and two habits keep biting:

- **`user` is `null` for a guest, and "default them to explorer" is wrong.**
  `PricingPage` used `user?.subscriptionTier ?? "explorer"`, which badged the
  free tier "current plan" and *disabled its button* — for the exact visitor
  the landing page's CTAs send there to register. Treat "no plan" as its own
  state (`user ? … : null`), not as the lowest tier.
- **A guest still carries a Firebase uid.** `getTokenOrAnonymous`
  (`firestoreService`) signs them in anonymously so public reads and the
  contact form can pass the API's `verifyAuth` — that is what stops
  `/api/email` being an open relay, and it is why the landing page can read
  `tiersConfig` and locale documents at all. **Do not remove anonymous auth**
  without giving the API an unauthenticated read path first. The uid it mints
  is per-browser and per-visit, so it identifies nothing: the backend decides
  guest-vs-user from the token's own `firebase.sign_in_provider`
  (`verifyAuthSession`), never from anything the client sends.

## TTS locale names come from the code, not a table

`getTtsService` builds its accent instruction ("read this in European
Portuguese, as spoken in Portugal") with `Intl.DisplayNames` off the BCP-47
code. It used to be a hardcoded `LOCALE_METADATA` map, which meant every
language added through Admin > Languages arrived with no region and fell back
to "the appropriate region" — missing for exactly the languages nobody had
hand-edited the file for. CLDR already knows the dialect names ("pt-PT" →
European Portuguese, "es-MX" → Mexican Spanish), so a new language works the
day it is seeded. Names resolve in **English** on purpose: the prompt around
them is English, and `supportedLanguages.label` holds the language's name in
its own tongue, which reads as an instruction to switch languages mid-sentence.

## Do not assume

- that a backend exists in this repo
- that a new endpoint should be created here when the API repo already owns the backend
- that a passing `npm test` means a feature works — most components are only asserted to render
- that user-facing content can be hardcoded without checking translation rules
