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

**766 tests across 29 files, ~57% line coverage, blocking in CI.** It started as a dependency guard — two production outages came from bumps that passed `lint` and `build` cleanly — and grew into partial behaviour coverage.

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
- Categories are `transactional` (always delivered, not opt-outable), `announcements` and `reminders`. `reminders` is sent by the API's hourly cron, **push only** — the mail outbox releases a fixed number a day and shares it with transactional mail, so its email channel defaults off and nothing reads it.
- **`PushOptInPrompt` is the only place the app asks for notification permission**, as a line under the tier badge in the dashboard header. It is a button, not an automatic prompt, and that is not a style choice: `Notification.requestPermission()` needs a user gesture, and a dismissal is permanent — once the browser records `denied` no code can ask again. Firing it on load would spend the single chance on someone who was not looking. Granting turns on both optional push categories; turning reminders off in Settings hides the prompt for good, so a warning never outlives the answer to it.
- `ReminderSettings` (content: which reminders, what hour, which weekday) is separate from `NotificationSettings` (channel: push at all). `config/reminders.js` mirrors `lib/reminders.ts` in the API — two copies in two repos that cannot import each other, like `EMAIL_COPY_BASE` and the locale file. `test/unit/utils.test.js` pins the ids and defaults against drift, which nothing else would catch: a mismatch is a switch that appears to do nothing.
- `users/{uid}.timezone` is captured on the first profile load that finds it missing, and **only** when missing — overwriting on every login would undo a deliberate override the moment someone opened their laptop abroad.
- The toggles are a convenience, not the enforcement point — the backend re-checks the stored preference before every send.
- The report button writes to Firestore (`appConfig/config/reports`) via `src/services/reportService.js`, and admins read/triage them in the admin page. It no longer sends to WhatsApp.
- **Broadcast email is queued, not sent.** The composer reports how many were queued and how deep the outbox is; the API releases 75 a day (Resend's free tier is 100/day, and the rest is headroom for transactional mail). Push still goes out immediately. See `lib/mail-queue.ts` in the API repo.

## Email templates are read-only, and there are exactly two copies

`src/components/admin/EmailTemplatesSection.jsx` shows the transactional email
and push-reminder copy as deployed. It **writes nothing**.

It used to edit the `email.*` keys of a pt-PT locale document in Firestore.
That made three copies of the same strings — this bundle, the API's
`EMAIL_COPY_BASE`, and that document — and the database copy was the only one
no pull request could ever be gated on, so it was the one free to drift. It was
also, on inspection, an abandoned partial seed: an exact but stale duplicate of
the bundle, missing the eight reminder keys and carrying junk at its root
(`section4_title`, `section5_text`) from a restructure years ago. **It has been
deleted, and nothing reads a pt-PT locale document any more.**

- `getTranslations` and `seedLanguageTranslations` both read
  `SOURCE_TRANSLATIONS` (the bundled file) and only that. `contentServices2.test.js`
  asserts that a pt-PT document put back in Firestore is still ignored, because
  "translate from the live copy" is the plausible-sounding change that would
  reintroduce all of this.
- `forceOverwriteAllTranslations` filters the base locale out of its targets,
  `fillMissingTranslations` returns `0` for it, and `seedLanguage` returns early
  on an existing language — so nothing recreates the document either. Worth
  knowing: while it existed, the Locales section listed it with a refresh
  button, and pressing that would have AI-round-tripped the canonical file
  pt→pt and stored the result.

**The two remaining copies are kept in step by CI, not by discipline.** The API's
`lib/email-copy.base.ts` is generated from this repo's `email.*` subtree by its
`npm run sync:email-copy`, and `npm run check:email-copy` fails there when the
two disagree — naming the offending strings. This repo runs the mirror check
**advisory** (`continue-on-error`, like the npm audit step): two repos cannot
merge atomically, so blocking both sides would guarantee one master is red
between the two merges. This repo is the source and may move first; the API is
what must catch up, which is why the hard gate and a daily `schedule:` run both
live there.

**Order of operations for a copy change:** edit `translation.json` here, push;
then in the API run `npm run sync:email-copy`, commit, deploy. Until that
second step the API sends the old wording and its CI is red — which is the
pressure working, not a bug.

`TEMPLATE_GROUPS` is an explicit list rather than something derived from the
bundle, because `email.common.*` is shared chrome that appears in every message
and should not look like it belongs to one email. The cost is that a template
added to the base file and forgotten there ships without ever being visible, so
`test/unit/emailTemplates.test.js` asserts the list covers every `email.*` leaf,
and that `TEMPLATE_VARIABLES` names exactly the `{{...}}` placeholders each
shipped string interpolates.

**`email.reminders.*` is push, not email.** It lives under `email.*` because
that is where locale copy is resolved from the same Firestore documents the UI
uses, and a parallel mechanism would be a second thing to keep filled. This
panel is the only place those four messages are visible outside the repo.

Per-language wording is unchanged: other locales are still Firestore documents,
still translated from this file, and still fixed by a force resync.

## The theme saves on click; everything else on that page waits for Save

`/settings` batches its fields behind a Save button, and the theme was in that
batch. It is the one setting whose effect you see immediately, so the screen
had already changed while the stored value had not — reload before pressing
Save and the theme sprang back. `handleToggleTheme` now applies and writes it
on click, and rolls the switch back if the write fails. The header's own toggle
has always behaved this way; this is the same behaviour where people look for
it.

It writes **only** `theme`. PUT `/api/firestore` is `docRef.update()`, a
field-level write, so a one-field payload leaves the rest of the profile alone
— the header toggle sends four fields defensively, which is unnecessary but
harmless. `theme` is out of the Save payload and out of the dirty check, so
changing it no longer makes the form look unsaved.

## Timezone

`users/{uid}.timezone` is an IANA zone, picked in Settings › Profile and
pre-filled from `Intl.DateTimeFormat().resolvedOptions().timeZone`. It exists
for the reminders phase: a fixed-hour UTC job cannot say "practice tonight"
correctly, and this is the field that fixes it.

`utils/timezones.js` builds the option list from
`Intl.supportedValuesOf("timeZone")` (~418 zones) rather than a table in this
repo, for the same reason the TTS accent names come from `Intl.DisplayNames` —
a hardcoded list goes stale whenever the tz database renames a zone and nobody
notices until reminders arrive an hour early. Options carry the current UTC
offset and sort by it, so the list reads west to east; the offset is computed
for **today**, so a DST zone labels differently in July than in January.

Absent until somebody saves it, and hydrated as `null` rather than `"UTC"` — a
reminder job must treat "not set" as its own case, because assuming UTC
delivers at the wrong hour rather than not at all. **Auto-capture on login is
deliberately not built yet**; it belongs with the reminders that consume it.

## Settings cards are closed except Profile, Subscription and Account

Those three start open at every width; every other card on `/settings` starts
collapsed.
It used to open them all on a desktop and close them all on a phone; the
desktop half was wrong for the same reason the phone half was right — nine
expanded forms is a long scroll with no overview, and a wide screen just means
scrolling past more of it. Closed cards are a table of contents.

Five cards open themselves when the URL names them, and scroll there:
`#practiceLanguage` (the practice-language card and badge, and the challenge
theme picker's "choose your interests" — interests live inside that card, not
in one of their own), `#profile` (the reminder card's "change it in your
profile", since the timezone that decides when a reminder lands sits three
cards above the one that depends on it), `#tutorSettings` (the tutor
directory's "Update my profile"), `#personalWidgets` (the dashboard's "choose
what to show") and `#reminderSettings`.

Two of those cards — `#profile` among them — already start open, so their
anchor buys the scroll rather than the expand. Still worth it on a nine-card
page; just do not expect the hash to be what opens them.

A link inside a sentence is three keys (prefix / link / suffix), not `<Trans>`,
because that is what `ChallengeThemePicker` already did and nothing in this app
uses `<Trans>`. Splitting an existing string means other locales keep the old
unlinked wording until a force resync. `openFromHash` is
read once during render, which works for a client-side navigation because React
Router updates the location before the page renders.

The scroll is `hooks/useScrollToHash`, and the browser cannot do it for us: its
own hash handling runs on navigation, before React has rendered the card, finds
nothing and gives up. Two details are load-bearing. **It retries**, because the
most-linked card renders last — `TutorProfileSection` paints nothing until its
fetch settles, so a single look on mount misses exactly the case that matters
most. And **the retry is `setTimeout`, never `requestAnimationFrame`**: a
hidden or backgrounded tab produces no frames, so an rAF loop never runs there
at all — which is how this was caught, in a browser pane that happened to be
hidden. It also does the offset arithmetic itself rather than calling
`scrollIntoView`, which takes no offset and leaves the card flush against the
viewport edge. This replaced a private copy inside `TutorProfileSection`; do
not grow a second one per card.

**The dirty check compares two keys, and they must hold the same fields.**
`buildProfileKey` (`utils/profileKey.js`) builds both — one from the saved
profile, one from the live form — because they were two separate array
literals and drifted: the saved side ended in `isDarkMode` and the draft side
in `timezone`, left over from moving the theme out of the Save batch, so the
sixth slot never matched and Save sat permanently lit with nothing to save.
The same key also decides when the draft is re-synced from the profile, which
is the second reason the theme must stay out of it — toggling dark mode was
discarding whatever the user had typed and not yet saved. Add a field to the
form and it goes in that one function, or nowhere.

**A section component that defaults `defaultOpen` to `true` is a trap.**
`NotificationSettings` did, so dropping the prop silently reopened it while
every sibling stayed shut. All of them default to closed now.

## Tutor directory

`/dashboard/real-person-tutor` (`src/pages/dashboard/TutorsPage.jsx`) lists tutors from a **public top-level `tutors` collection keyed by uid**, not from a map on the user document. That is forced, not chosen: a non-admin cannot query `users` or read another user's `users/{uid}` at all, so a directory sourced from user documents could never be rendered.

- **Publishing is server-gated twice**: `tutors` is `{ read: 'public', write: 'own-doc-id', writeTiers: ['maestro','vip','admin'] }` in the API. The uid lock stops one user claiming another's slot; the tier gate is read from `subscriptionTier`, which users cannot set. `canBeTutor()` in `tutorService.js` is UI-only and is not what keeps anyone out.
- **The Settings editor is hidden until a document exists — it never synthesizes one.** `TutorProfileSection` renders `null` for an eligible-tier user with no tutor doc; there is deliberately no "fill this in and it gets created on Save" path. `createTutorDraft()` (`tutorService.js`) is the *only* thing that creates one — always hidden (`published: false`), name/picture/email from the account, empty description — called from the small "Become a tutor" button at the bottom of the directory page, which then routes to `/settings#tutorSettings`. An ineligible-tier visitor sees "Apply to become a tutor" instead, which routes to the same anchor without writing anything (the application form is what's there). That button is deliberately small and out of the results grid, not a dashed placeholder card — deciding whether to become a tutor isn't a listing, and giving it a whole grid cell overstated it.
- **Deleting is separate from hiding, and deliberately the quieter of the two.**
  `deleteTutorProfile()` removes `tutors/{uid}` through the ordinary
  `DELETE /api/firestore` — no new endpoint, because that path runs the same
  `own-doc-id` + `writeTiers` check as every other write to the collection, so
  a tutor can remove their own document and nobody else's. The confirm spells
  out the difference rather than just asking "are you sure": for almost anyone
  who wants to stop being listed, unchecking "publish" is the right answer.
  **The tier gate cuts both ways**: a user whose subscription has lapsed out of
  `TUTOR_TIERS` can no longer delete their own profile. The webhook has already
  unpublished it so nothing is public, but the document stays until they
  resubscribe or an admin removes it.
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

## NeoDropdown searches itself past eight options

`components/NeoDropdown.jsx` is the app's one value picker, and it had grown
lists it was never designed for: **418 timezones, 102 dial codes, 25
languages**, all of them a scroll through a six-row window.

**The filter box is automatic, not opt-in** (`SEARCH_AFTER_OPTIONS = 8`,
overridable either way with `searchable`). Opt-in was the other option and it
fails the same way this problem arose: the lists that most needed search were
the ones nobody thought to ask for it on. Eight keeps the short pickers — CEFR
level, tone, status — exactly as they were, where a search box is furniture.
Matching is accent- and case-insensitive over **both label and value**, because
one reader types "brasil" and another types "pt-BR".

**"Other" is exempt from the filter and always last.** It is an action, not an
option, and the moment it matters most is when a search has just returned
nothing — which is precisely when somebody needs to add the language they were
looking for. Enter picks the first match; with nothing matched it commits
nothing, because "Other" is a different decision and has to be chosen on
purpose.

**`multiple` keeps the panel open.** Picking four languages was four
open-pick-reopen cycles before. `value` becomes an array and `onChange` gets
the array back.

**The `placeholder` prop means "the button has its own label", not "the empty
state".** Given one, a `multiple` picker always reads it instead of
summarising the selection — because passing one says the selection is displayed
elsewhere. `TutorProfileSection` is the caller: its languages show as removable
chips directly above, so a button reading "Portuguese +2" would repeat them and
cost the control the only text saying what it does. Without a placeholder the
button is the only view of the selection, so it summarises as "First +N".

That picker also stopped filtering already-chosen languages out of its options:
right for a one-at-a-time add control, wrong for a multi-select, where the ticks
against what you already speak are most of what the open panel is telling you.

## Languages are sorted by label, which is also what groups them

`getLanguages` sorts through `sortLanguages` before returning. Unsorted,
Firestore hands them back in document-id order — the BCP-47 code — so the list
reads as arranged by something invisible: "Swiss German" lands between "Irish"
and "Interlingua" because `gsw` sorts there, nowhere near "German".

Sorting on the **label** is what buys the grouping for free. The labels are
already "Language (Country)", so Portuguese (Brazil) and Portuguese (Portugal)
become neighbours and all four French variants form a block — no headings, no
taxonomy to maintain, no admin step for a newly seeded language. Grouping by
*country* was the other option and the live data rules it out: 25 languages
across 20 countries, 16 of them holding a single entry.

Sorted in code, not with a Firestore `orderBy`, which silently drops every
document missing the field — and `label` is optional.

Worth knowing about the free-text "Other" box: a duplicate is already
impossible. `seedLanguage` canonicalises what was typed with the AI and then
re-checks against the existing languages, reusing the match rather than
creating a second document. The cheap pre-check in `SettingsPage.seedIfNeeded`
only compares normalised *codes*, so typing a name misses it and spends one AI
call before the real guard catches it. Deliberately left that way — with search
in the picker, far fewer people reach that box at all.

## A feature page says what it is, and occasionally how it works

`FeatureHeader` renders two optional lines under the title, and **neither is
passed in by the page**. Both are resolved from the route through
`favouritableById(favouriteIdForRoute(pathname))` — the same lookup the heart
already does — so a page gets them by existing in the registry rather than by
declaring anything, and a route the registry does not know (a hub, a
professional sub-tool) simply says nothing.

**The subtitle is the string its dashboard tile already shows.** Reusing
`descKey` rather than writing a second one means there is one description per
feature, already translated, that cannot drift from the tile. Plain weight
against an all-caps black heading: the title shouts, this one talks.

**The instruction line is deliberately rare**, italic, and ruled in the page's
own accent so it reads as a different *kind* of sentence rather than a second
description. It comes from `instructionsKey`, which only a handful of registry
entries carry — today Word Search, Scrambled Word and Word Link. The rule for
adding one: the interaction is non-obvious **and** the page does not already
explain it in place. Hangman needs none; Word Ladder's rule already *is* its
description; the exam exercises ship their own AI-written instructions and a
static second set would contradict them; the story reader teaches tap-and-hold
at the moment a word exists to tap, which beats teaching it beforehand.

Two mechanical traps. `ACCENT_BORDER` duplicates `ACCENT_BAR` because a border
colour and a background colour are different Tailwind classes and **Tailwind
cannot see a class name built by concatenation** — both maps must spell every
class out. And an `instructionsKey` is resolved from a variable, so the i18n
canary (which scans for literal `t("...")` calls) cannot see it; a missing
string would render the raw key as an instruction, which `featureHeader.test.jsx`
checks against the pt bundle instead.

Passing `description` or `instructions` overrides the registry; passing `""`
suppresses either.

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

## "Tale Creator" and "Country Culture & History" — the rename is a pt-PT fix

Readers could not tell the two apart, and the reason is only visible in the
base locale: **in Portuguese both were "história".** "Gerador de Histórias"
next to "História e Cultura" is the same word twice, because *história* is
both a story and history. English hid the collision; pt-PT is the language the
app is actually written in, so the collision was the product.

They are now **"Criador de Contos"** (a *conto* is a tale and nothing else) and
**"Cultura e História do País"** (the country is what it is about, and naming
it moves "história" out of first position). Every reference in the pt bundle
moved with them — the pricing rows, the landing page, the word-bank copy that
says where to collect words.

**Only the copy changed. Not one id, key or route.** `story_generator` and
`history_culture` are *gate keys*: they name documents in
`appConfig/config/features`, appear in each tier's `features` array, and are
stored in users' favourites and `DEFAULT_TODAY_FEATURE_IDS`. Renaming one
would silently un-grant a feature for every subscriber and orphan every
favourite pointing at it. `/dashboard/story-generator` stays for the same
reason — bookmarks and shared links.

Two things this does **not** reach on its own. Other locales keep the old
wording until an admin force resync, because `fillMissingTranslations` only
fills *missing* keys. And `config/seoStrings.js` still says "stories" on
purpose: it is crawler-facing, and "story" is the word someone searches for.

## Tale themes are a bounded list so the pool still works

`config/storyThemes.js` is the world a tale is set in — fantasy, underwater,
sport — picked before generating and sent as `{{theme}}`.

**Bounded on purpose.** A preset is a Firestore equality filter, so ten readers
asking for the same theme at the same level share one pool instead of paying
for ten generations. `any` is the default and filters nothing, which is also
the only way tales written before themes existed are ever served — an equality
filter drops documents missing the field rather than treating it as unset.

**`other` is free text and is therefore gated** like `description` and the
word-bank selection (`canAccess("custom_requests") || cacheExhausted`).
Arbitrary words can never be served from a shared pool, so it always spends a
generation — and an ungated third route to the same AI call would make the
other two gates decorative. It is dropped from the picker when locked rather
than shown locked, since the description box below already renders that
upgrade prompt and two identical locks explain the tier worse than one.

**`getStoryPoolStatus` is deliberately *not* theme-filtered**, unlike
`getStory`. "Exhausted" is what unlocks a paid feature for a free tier, and a
theme nobody has written for is empty the day it is added — so counting per
theme would let anyone unlock custom requests by picking the most obscure
option in the list.

The theme ids are written onto every story document, so they can be added and
retired but **never renamed** — a rename orphans every tale already stored
under it. There is no "history" theme, and `storyThemes.test.js` asserts there
never is: putting *história* back in that list undoes the rename above.

## Practice Text — the grammar hub stops being pt-PT-only

`/dashboard/grammar/text` writes a short passage around whatever the learner
typed they want to work on: a tense, a construction, some vocabulary, plus any
words from their bank. `grammarTextService.js`, prompt
`grammar-text-generate-prompt`.

**It is its own prompt, not a variant of the Tale Creator's, because the two
instructions contradict each other in writing.** `story-generate-prompt` says
*"natural writing, not a grammar exercise in disguise — do not stuff it with
one tense to make a point"*; this one asks for exactly that stuffing. One
template cannot hold both without one of them being a lie, and the one that
would get softened is the Tale Creator's. (`grammar-drill-prompt` uses
`variants` because its six shapes are the same job. This is not that.)

**Nothing is cached and nothing is written.** Every other reading feature is
cache-first against a shared pool, because their requests come from a bounded
set — a level, a language, a theme, a topic id. This request is a sentence
somebody typed, so there is no key to match on and no second reader who wants
the same text. Every press generates; the AI daily limit is what rations it,
the same argument photo capture runs on. That is also why its word-bank
selection is **ungated** where the Tale Creator's is: there, picking words
forces a generation that would otherwise have been free, so it is gated with
the custom-request box; here every press generates anyway.

**The language gate is now per section, not per hub.** `isGrammarSectionAvailable`
reads `needsLibrary` off each entry in `GRAMMAR_SECTIONS`. Structures, Tips and
the drills all render seeded pt-PT material and stay gated by
`GRAMMAR_SUPPORTED_DIALECTS`; Practice Text reads nothing seeded — it asserts
no rule, it produces prose — so it has nothing to be missing in a language
nobody has reviewed. **The flag defaults to "needs the library"**, which is the
safe direction: a section wrongly marked library-free ships unreviewed grammar,
one wrongly marked as needing it is merely absent.

Consequences worth knowing. The dashboard Grammar tile **no longer carries
`isUnavailable`** — leaving it disabled off-pt-PT would have made the one
section that works everywhere reachable only by URL. The hub renders whatever
survives the filter and shows the "library is pt-PT only" banner *above* those
cards rather than instead of them. And `grammar_text` has no document in
`appConfig/config/features` yet, so it resolves to `COMING_SOON` and renders
badged and locked for everyone but admin until it is granted in Admin › Tiers
& Features — which is the right default for something unreleased.

`focusNote` and `highlights` are presentational: a model that skips them
degrades to a plain passage rather than throwing, because throwing would spend
one of the reader's daily calls and show them nothing. `highlights` are
required to be copied character-for-character out of the paragraphs, and the
prompt says to leave the list empty rather than invent an example — an "answer
key" listing forms that are not in the text is worse than no answer key.

## Translations are collapsed, and now fetched only when opened

The bilingual reader shows the target-language paragraph with its translation
**closed**, one toggle per card plus a show-all for the whole story. Open by
default was the original design and it defeats the exercise: with both columns
on screen the eye goes to the language it already knows and the target text is
never really read. The title is the deliberate exception — always translated,
because it is the one line that tells a reader whether the story is worth
starting.

**Closed did not mean unfetched.** `getStoryTranslation` fired the moment a
story loaded, so the call happened whether or not anyone opened a paragraph,
and most readers never do. It is now behind the first reveal, with the in-flight
request held in a ref so opening three paragraphs at once asks once.

Two things that had to move with it. The reveal buttons were gated on the
translation *existing*, which with a lazy fetch means they never render — they
are gated on `showBilingual` now. And a reveal **awaits** the fetch rather than
opening optimistically, so an open paragraph always has something under it.

**History & Culture works the other way round and keeps doing so.** It is read
in the reader's own language — that is the feature — and the practice-language
version is the thing revealed, on a button, under each paragraph. Usually free:
a piece about Portugal was written in pt-PT, so the practice language *is* its
`sourceLocale` and this is a plain read of a document that already exists.
`getFact` now returns `sourceLocale` so the page can ask without a second
lookup to find out which language to ask for.

**`getDocument` resolves to the envelope, and both reading services got this
wrong.** It returns `{ id, data, collection }`, not the fields — and
`_getDocumentOrNull` in `storyService` and `historyCultureService` handed that
envelope straight back. Every caller then read `.title` and `.paragraphs` off
it and got `undefined`.

It was invisible for a long time because it only affected the **cached**
routes. Freshly generated content is returned by the generator directly and
never passes through that helper, so the first read of anything worked
perfectly and the second came back correctly shaped and completely empty: a
pooled story with no paragraphs, a cached translation with nothing in it, and
on the translate path a loud `source.paragraphs.length` throwing instead.

**The unit tests did not catch it because the fixture was wrong, not the
assertion.** `contentServices.test.js` mocked `getDocument` as returning a bare
document, so "serves an unseen cached story without spending an AI call"
passed against a shape production never produces. The mock now builds the
envelope through `asDocument()`. When mocking a service seam, mock what the
real function returns — this is the same trap the tutor directory hit with
`queryCollection` resolving to `{ documents }`.

**Audio is not cached anywhere but memory.** `getTtsService` keeps clips in an
in-memory LRU `Map` that dies on reload, is per-tab, and is shared with nobody
— unlike translations, which are Firestore documents per locale under
`stories/{id}/content/{locale}` and `historyFacts/{id}/content/{locale}`. So a
free tier can spend all three daily calls re-hearing one clip across three page
loads. Fixing it needs a Storage path and a collection keyed by text, locale,
voice and pace; it has not been done.

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

## Personal items live in user subcollections — the first feature to use them

`users/{uid}/personalPhrases`, `/personalMistakes` and `/personalQuestions`
hold lists; `/personalNotes/board` and `/personalSettings/main` are each a
single document. All of it goes through `personalService`. Nothing in the frontend had ever used a user
subcollection, but the backend has always supported them: reads, queries, PUT,
PATCH and DELETE are owner-gated by `usersSubcollectionOwner`, and account
deletion already recurses into them, so this needed no policy entry and needs
no cleanup path.

One subcollection per kind, not one collection with a `kind` field: the
queries need no filter and so no composite index, and the server's page cap
applies per kind instead of across all three lists.

The note board is deliberately **not** a list. A board is somewhere you keep
adding to, and a list of notes would make you name and file every stray
thought before writing it down — which is the friction that sends people to
their phone's notes app instead. One document, no titles, no rows, no delete.

Three rules, each of which fails **quietly** when broken:

- **A single-document subcollection is written with POST and an explicit id,
  never PUT or PATCH.** Both of those 404 on a document that does not exist,
  and neither the settings nor the board exists on a user's first visit.
  POST-with-an-id merges at the root, which makes it a safe upsert.
- **Never send `createdAt`** — the proxy stamps it and overwrites anything sent.
- **Never `orderBy`.** Firestore drops documents missing the ordered field, so
  one row written before a field existed would vanish rather than sort oddly.
  Sorting is in code, as `reportService` does it.

`usePersonalSettings` debounces its writes by 800ms and flushes on unmount and
on `visibilitychange`. That is not a nicety: the lesson counter is a tapping
interaction, and four taps must be one write, not four writes racing.
`usePersonalNoteBoard` does the same at 1200ms, because typing produces a
change every few hundred milliseconds and a paragraph should be one write. It
also reports its save state, since a page that autosaves and says nothing is
asking to be trusted with the only copy of something you wrote.

## The personal dashboard loads once and passes down

`/dashboard/personal` is nine live widgets, not a menu — it replaced
`PersonalMenu`, which was six links to six pages. The pages all still exist and
stay routed; each widget that loses something at card size carries a small
icon-only expand control to its own page. An icon rather than a labelled
button on purpose: a row of "see all" links would put the menu straight back
on the page it replaced.

**`usePersonalDashboard` composing the five hooks is mandatory, and not for
request count.** The lesson counter and the goal both read
`personalSettings/main`; two `usePersonalSettings()` instances on one page
would mean two independent 800ms debounce buffers writing to one document and
two flushes on unmount. Today's patches are disjoint so POST-with-an-id merges
them, but that is a race built on purpose. `test/unit/personalDashboard.test.jsx`
asserts `getDocument` is called exactly once for that document.

Two footguns the widgets have to respect, both already paid for once:

- `usePersonalCollection`'s `add`/`update`/`remove` close over `items`, so
  their identity changes on every list mutation. Never put one in a dependency
  array, don't `React.memo` a widget that receives one, and **never
  `useCallback`-wrap one** — that captures the first `update`, which closes over
  the empty initial `items`, so one failed write rolls the list back to `[]`.
- `getFavouriteIds` hands back a fresh `[]` when the profile has no
  `favWordIds`, so the word bank's `words` is a new identity every render for a
  user who has never saved one. `RecallWidget` derives its card from a seed
  rather than an effect for exactly this reason.

**Layout: a grid, not `TodayPanel`'s rails.** Rails suit a set that is
unbounded, uniform and glanced at; this one is bounded, heterogeneous and
operated. Three classes are load-bearing — `items-start` (without it every
short card stretches to its tallest row sibling and its hard shadow detaches),
`lg:` rather than `md:` (the content area is `max-w-5xl`, so the second column
appears at the exact width the container stops growing — measured at 1023px it
is one column, at 1024px two columns of 481px), and `gap-4` to clear the 6px
offset shadow. Do **not** copy `TodayPanel`'s `px-2 py-3`: that exists only
because `overflow-x: auto` clips vertically and was eating those shadows, and
a grid has no overflow context.

Tap targets here are set with explicit `min-w-[44px] min-h-[44px]`, not with
padding around an icon. Padding lands a 15px icon at 39px, which looks fine and
is not a thumb target — the shared `Breadcrumb` back arrow and `FeatureHeader`
heart are still 14px and 28px, and are the remaining exceptions app-wide.

**Which widgets appear is the user's choice**, in Settings rather than on the
dashboard — a hide control on nine cards is nine controls you look past daily
to reach the one you came for. `config/personalWidgets.js` is the single
registry the page and the picker both render from, so order, column spans and
copy cannot drift. Its `titleKey`/`descKey` are resolved from a variable, so
the i18n canary (which scans for literal `t("...")` calls) cannot see them —
`personalDashboard.test.jsx` checks them against the pt bundle instead.

**`PersonalWidgetCard` takes a `widgetId`, not a title/icon/colour.** It looks
all four up in the registry, so a widget's name, description, icon and chip
colour exist once. Each widget used to pass its own `title`, `icon` and `color`
while the registry held a second copy of the name for Settings; two copies of a
string are two copies to keep in step, and the description now appears in both
places, which would have made it three. An unregistered id throws with a named
message rather than failing as `cannot read icon of undefined` inside the error
boundary.

The stored value is the **hidden** ids (`users/{uid}.hiddenPersonalWidgets`),
never the shown ones. With a "shown" list every widget added later would be
invisible to every existing user until they went and enabled it — a silent
no-ship. It lives on the profile rather than in `personalSettings/main` because
the profile is already in context on every page, so the dashboard and Settings
both read it with no request at all.

Two things that bit while building it, both worth knowing generally:

- **`AppContext`'s `setUser` hydration block is an explicit allow-list.** A new
  profile field left out of it is written correctly and then silently dropped
  on the next load, which reads to the user as a setting that does not stick.
  Adding a field anywhere means adding it there too.
- **Toggles that write are debounced, not disabled while saving.** Disabling
  the panel per write makes turning three things off three round trips you wait
  out; allowing concurrent writes lets two full-array PUTs land out of order and
  leaves the server disagreeing with the screen. Debouncing 600ms and sending
  the whole array once has neither problem — the same shape the lesson counter
  uses.

Mobile sizing is tuned at 360px, which is where it gets used. The inputs, the
card padding, the icon chips, the divider gaps and the two big numerals all
step up at `sm:` rather than being one size everywhere; that took the empty
dashboard from 4.4 screens of scroll to 3.6.

**There are no single-line `<input type="text">` fields left in this area.**
An input's placeholder cannot wrap — it is one line by spec — so a hint longer
than the box is simply cut, and at 360px the next-lesson placeholder lost 91px
of itself in English, with every longer language losing more. The typed value
has the same problem: an input scrolls sideways, so a long phrase becomes a
keyhole. `AutoGrowTextarea` replaces them: one row to start, height recomputed
from `scrollHeight` on every value change (an effect on `value`, so clearing
the draft after an add resets it), Enter submits and Shift+Enter makes a line.
Date and number fields stay real inputs — their native pickers are the point.

**Cards are bounded by height, not by item count.** The lists used to slice to
five, which hid rows the user could just as well have scrolled to. They now
render everything and cap the list region with `max-h-52 sm:max-h-64
overflow-y-auto overscroll-contain scrollbar-hidden` — `.scrollbar-hidden`
already exists in `index.css`, and `overscroll-contain` stops a flick inside a
list carrying on into the page behind it. Row text is `break-words`, never
`truncate`. With no scrollbar, the partially visible row at the cut is the only
cue that there is more; that is deliberate, but it is the thing to revisit if
anyone reports missing content.

## Fala com a IA — the one feature that bypasses the proxy

`/dashboard/ai-tutor` is a spoken conversation with a tutor that corrects as
you go. It fills in the `ai_tutor` stub; the tile was renamed from "Tutor de IA"
in copy only, ids and route untouched.

**It is the single AI feature that does not go through `/api/ask-ai`, and the
reason is structural.** The Live API is a stateful WebSocket and a Vercel
function is an HTTP handler with a maximum duration — it can neither accept an
inbound socket nor hold one open for a lesson. So the session runs
browser-to-Google and the proxy's only part is `POST /api/live-token`, which
checks the Admin grant and mints a token with `uses: 1`, a short life, and
`liveConnectConstraints` locking it to the live model. The API key never
reaches the browser. Consequence to keep in view: **the server cannot meter the
conversation** — not minutes, not content — so "may a session begin" is the
only quantity anyone controls, and `aiCallsToday` is deliberately untouched.

**Nothing from the pronunciation feature transfers, and `pcmAudio.js` exists
because of it.** Live wants raw little-endian PCM16 — 16 kHz up, 24 kHz down —
while `MediaRecorder` produces a *container* (webm/opus, mp4). A container is
right for "record a take and send the file" and useless for "stream what I am
saying now": chunked for storage rather than latency, and the Live API will not
read one. So capture is an AudioWorklet reading raw samples, loaded from a Blob
URL rather than a file so no build asset has to survive Vite, the Pages base
path and anyone moving it. The context's real sample rate is **read back rather
than assumed** — Safari and some Chromium builds ignore the requested 16 kHz —
and that is what decides whether a resample runs.

Playback schedules each chunk where the last one ended. Playing them on arrival
leaves a seam between every one and the model's speech arrives in many small
pieces. A start time is never booked in the past: after a pause the clock has
moved on, and booking behind it plays the whole queue at once.

**`interrupted` must clear the queue.** Being talked over is the normal way a
conversation goes, and everything already sent is a sentence the learner has
moved past — playing it out is the tutor ignoring them.

**The page is a dark field with the transcript floating on it**, and two
controls: the level, and one round button that starts and ends the
conversation. A voice interface with a row of buttons is asking to be operated
instead of talked to, and the talking is the thing being practised. The level
stops being a picker the moment a session opens and becomes a chip that says
what was chosen — it is baked in at connect time, so a dropdown that still
looked live would silently do nothing.

The stage is dark in **both** themes, the same decision the practice-language
flag field made: white on a dark ground is one contrast judgement covering
light and dark at once, where a ground that changes needs two. Controls sitting
on it are passed `isDarkMode` as a constant for that reason.

**`LiveTutorBlob` never re-renders, and that is the design.** Loudness changes
about fifteen times a second while the page holds a growing transcript, so the
level is *pulled* from `getAudioLevels()` inside the canvas's own frame loop
rather than pushed through React state — nothing above the canvas learns that
the shape moved. `isActive` is mirrored into a ref so toggling it cannot tear
the loop down and restart it, which would reset the clock and make the blob
jump at the exact moment somebody pressed start.

**Where each level comes from is not interchangeable.** The microphone's is the
RMS of the frame the worklet already sent — the samples are in hand, so an
analyser would be a second copy of the same signal. The tutor's needs an
`AnalyserNode` in the player, because playback chunks are *scheduled ahead of
time*, sometimes seconds ahead: measuring them at `enqueue` would move the blob
before the sound came out. `scope` is initialised to 128 (silence in a
time-domain byte array) so a browser where `getByteTimeDomainData` does nothing
reads as quiet rather than pinned at full scale.

**Two timeouts end a conversation nobody is having**, and they are the only
brake that exists: the server mints one token and then cannot count minutes,
inspect the call or close it. Ninety seconds of silence on **both** sides ends
the session — long enough to think about a sentence in a language you barely
speak, short enough that walking away ends it. The ceiling comes from the
`expiresAt` the endpoint returns, not from a constant here; the constant that
does exist is a fallback for a deployment old enough not to send one, because
running until Google hangs up unexplained is worse than a ceiling of our own.
The tutor's half of "is anyone there" is taken from audio arriving on the
socket, never from the player's analyser — a backgrounded tab paints no frames,
and an idle check that depended on drawing would end the call mid-sentence.

The countdown appears only under two minutes. A clock running for the whole
conversation turns practice into an exam, and the number is not actionable
until there is something to wrap up.

**A session owns four things and all four must be released**: the socket, the
microphone track, the capture context and the playback context. `stop` is
idempotent, runs on unmount, and takes the **microphone first** — if anything
later throws, the one thing that must not survive is an open mic.

**`@google/genai` is dynamically imported**, the treatment jspdf gets. It is
356 kB in its own chunk, absent from the main bundle, downloaded only by
someone who opens the tutor. Hand-rolling the wire protocol was the
alternative; an evolving protocol is worse to own than a dependency.

**The prompt is spoken, which changes how it is written.** No markdown, no
lists, no headings — it is read aloud, so anything that only works on a page
comes out as noise. Its substance is three rules: correct in passing rather
than in a report, always say the corrected sentence out loud, and **give both
the literal and the colloquial reading whenever a word carries both**, saying
which is which. That last one is the reason the feature exists.

Two things still open before this ships: **§2.6 of the privacy policy** still
says recordings are used "exclusivamente para gerar comentários de pronúncia e
transcrever o que disse", which a live conversation is not — that paragraph
does the BIPA/CUBI work and needs widening rather than stretching. And
`GEMINI_API_KEY` must be set in the API's environment or `/api/live-token`
returns 503.

## Held for later: a place, not a language

Recorded here because it shapes decisions before it is built, and because a
note in a conversation is a note that is lost.

The live tutor ("Fala com a IA") is meant to become **local to a place**: the
learner types a city or region, the model is asked a plain true/false — does
this place exist in the country where the practice language is spoken — and if
so the tutor teaches that area's speech as accurately as it can. Vocabulary,
expressions, the double meanings a word carries *there*, and both the literal
and the colloquial reading of a phrase.

Two constraints that matter now, while nothing is built:

- **It is free text, not a seeded language.** No document in
  `appConfig/config/languages`, no new dialect code, nothing in the pickers.
  The place is validated by AI and kept as a string on the profile. Treat any
  design that would need it to be a language as the wrong shape.
- **The validation is deliberately trivial** — does this place exist in that
  country, yes or no. It is not geocoding, not a gazetteer, not a lookup
  service. One cheap call, one boolean.

Not built. Do not build it as part of anything else; it is listed so that the
live tutor's session config and the profile shape leave room for it.

## Reading aloud, and why the privacy policy wrote the design

`/dashboard/voice-practice` fills in what was a coming-soon stub. Get a passage
for your level, read it aloud, hear yourself, hear how it should sound, then
ask for feedback. `useVoiceRecorder` + `pronunciationService` +
`VoicePracticePage`; no new feature key, no new tile, no new route — the
`voice_practice` feature document already existed, `hidden: true`.

**The two halves have opposite economics, which is why they are two prompts.**
The passage is pooled in `pronunciationPassages`, cache-first exactly like
`stories`: everyone practising pt-PT at B1 wants the same difficult sounds, so
only the first reader pays. The feedback is about one person's reading, so
every submission generates. `seenPassageIds` on the profile stops the pool
handing out a passage twice — a `seen*` field like every other, which means it
also had to go in `AppContext`'s hydration allow-list or it would have been
written and then silently dropped on the next load.

**§2.6 of the privacy policy is a specification, not background reading.** It
promises recordings are used only to produce pronunciation feedback and a
transcript, that no voiceprint is made, that the voice is not analysed to
identify or distinguish anyone, and that no emotion is inferred — and it names
Illinois BIPA and Texas CUBI as what those promises hold off. §6 adds that
audio is kept only as long as it takes to produce the feedback. Three
consequences, all load-bearing:

- **Nothing reaches a server.** The only copy that leaves the device is the one
  attached inline to one `ask-ai` request, which is written nowhere. `reset`
  and unmount both revoke the object URL; `voiceRecorder.test.jsx` pins that.
- **The most recent take is kept in the browser**, in IndexedDB via
  `utils/recordingStore` — a blob does not fit localStorage, and base64-ing it
  in would inflate it by a third against a ~5MB quota. It exists so a reload,
  or a request that failed, does not cost somebody the reading they just did.
  **One record, never a history**: a pile of recordings of somebody's voice on
  their laptop is the opposite of what this feature promises. It is dropped on
  Clear, on asking for a new passage, and after 24 hours — enforced on read,
  since there is no background job. The passage is stored beside it, because a
  recording with nothing to compare it against is no use and there would be
  nothing left to read either. Every call is wrapped: IndexedDB throws outright
  in a private window on some browsers, and losing the ability to restore a
  take must not take the page down.
- **`pronunciation-feedback-prompt` carries the boundaries in its template**,
  and its `description` field says so to whoever opens it in Admin. A prompt
  edited to ask "how confident do they sound" or "where is this accent from"
  walks straight through §2.6. Reword the rest freely; leave those alone.
- **The note is on screen**, not only in the policy. A promise nobody can see
  is one nobody can rely on.

**The policy was updated for the device-local copy** (§2.6, §2.7, §6, and its
date), because §2.7 *enumerates* what the browser holds and that list would
otherwise have been untrue. §6 now distinguishes what **we** retain — nothing —
from a copy on the reader's own device under their control.

**While there: the app sets no cookies at all**, and §2.7 now says so. It
previously said only that there were no advertising or analytics cookies, which
reads as "we use some, just not those". Verified rather than assumed: no
`document.cookie` anywhere, no third-party script in `index.html`, no Stripe.js
on this origin (Checkout is a redirect to Stripe's own domain), Firebase Auth
persisting to localStorage/IndexedDB rather than cookies, and Google Fonts as
the only runtime third-party origin, which is cookieless. Sign-in via a
provider happens in that provider's own window, where their cookies apply —
§2.7 says that too.

**The microphone track is released after every take.** A held-open
`MediaStream` keeps the browser's recording indicator lit, which correctly
alarms people; re-acquiring per take costs nothing once permission is granted.

**Nothing is transcoded.** Gemini accepts `audio/webm` and `audio/ogg`, which
is what `MediaRecorder` produces on Chrome and Firefox (Safari gives mp4, also
accepted). `/api/ask-ai` grew an `audio` field beside `images` — same
`inlineData` path, one clip only — and **strips the codec parameter before
checking the MIME type**, because a browser labels a recording
`audio/webm;codecs=opus` and matching the full string would reject every
recording Chrome makes.

**The model is `gemini-3.5-flash-lite`, the same one almost everything else
here runs on — and it got there the hard way.** It used to default to
`gemini-3.5-transcribe`, on the reasoning that a listening task wants a
listening model. This file recorded that as a risk at the time: *a
transcription model may return a transcript and ignore the rest of the
instruction.* It does. Readers got their own words back with no score, no
summary and no issues — the whole point of the feature, missing — while the
call still spent one of their daily requests.

Two things to take from it. **A model named for the input is not necessarily
right for the output**: the task here is not transcription, it is judgement
about a reading, and it happens to arrive as audio. Gemini's 3.x text models
accept audio exactly as they accept images, so there is no listening model to
pick — the same point already made about photo capture and vision.

And **the degrade-gracefully design was the wrong safety net for this.** The
service renders a missing score as no score and missing issues as an empty
list, which is right for a bad response and wrong as a way to notice a
permanently bad *model*: it made a feature returning nothing look like a
feature having an off day, for as long as nobody complained. The clamp and
the empty-list handling stay, because a model can still wander; what is no
longer acceptable is treating that as the only signal.

Confirmed working by changing the field in Admin before it was changed in
code, which is what that field is for — the fallback constant now matches so
that clearing it cannot quietly restore the broken behaviour.

## Photographing your own notes

`PhotoCaptureWidget` on the personal dashboard sends one photo to Gemini and
proposes what to file where; `PhotoReviewModal` is where a person approves it.
It is gated by `personal_tools` like everything else on that page — no new
feature key, because the AI daily limit already rations it and an Explorer
spending one of their three calls on this is a choice they are entitled to make.

**It reads the student's own material** — a notebook page, an exercise,
corrected homework. That is what makes the `mistakes` section possible at all: a
wrong→right pair has to come from something they wrote, and the prompt says so
explicitly because "list the mistakes" against clean notes is an invitation to
invent them.

**Nothing is written until the review is approved**, and that is the feature
rather than a confirmation step. A model reading handwriting gets some of it
wrong, and the destinations are someone's own notes and their own list of
mistakes — the places a wrong entry is most annoying to find later. Every row is
editable in place and dropping one is a tap.

**The photo is never stored.** It goes into the request, is read, and goes out
of scope with the response. No Storage bucket, no retention rule, no
privacy-policy change — which is also why there is no history to re-run.

Four things that are load-bearing:

- **`/api/ask-ai` grew an optional `images` field** (not a new endpoint) and
  `askGemini` appends `inlineData` parts to the **last user turn**, after the
  text. Images cannot ride in `prompt` — that is capped at 8000 characters and
  a photo is ~1MB of base64.
- **`utils/imageDownscale.js` is what makes the request possible**, not an
  optimisation: Vercel rejects a body over ~4.5MB before the handler runs. It
  also applies EXIF orientation, without which a phone's portrait photo arrives
  sideways and the handwriting is much harder to read.
- **Words are added with one write, never a loop.** `useWordFavourites.addMany`
  exists because `toggle` reads the current list from the captured `user`, so
  N calls from one render all start from the same array and the last write wins
  — a dozen words in, one word out. Each favourites write PUTs the whole array.
- **The three list kinds are added sequentially**, awaiting each, because
  `usePersonalCollection.add` stamps an optimistic id from the clock.
  `pendingSeq` now disambiguates ids created in the same millisecond; before
  it, a batch could give two rows the same temporary id and a single failure
  would remove both.

The prompt is `photo-notes-extract-prompt` in `appConfig/config/prompts`,
admin-editable like every other.

**How a new prompt gets into Firestore, every time:** Admin can edit prompts
but has no create affordance, and pasting a forty-line template by hand invites
typos. So a `src/services/promptSeedService.js` is written, carries a TEMPORARY
banner and its own three-step removal checklist, is pressed once from Admin ›
Prompts, and is then deleted along with its button and its handler. It has
existed and been removed several times — do not be surprised to find it absent,
and do not leave it behind. It creates only: a prompt that already exists is
skipped, so pressing it twice can never clobber an admin's edits.

## The model lives on the prompt, and so does the Explorer split

Every prompt document carries `model` (everyone) and `explorerModel` (the free
tier). Both are free-text fields in Admin › Prompts, and **blank means "the
same model as everyone else"** — which is the state of every prompt nobody has
deliberately split, so this is opt-in per feature rather than a global switch.

`api/ask-ai.ts` does the swap, in four lines, right after the tier it already
resolves for quota. Doing it server-side is not about trust — the model has
always been whatever the client sent — it is that the alternative threads the
tier through a dozen services with no other reason to know it.

**It keys on the stored tier, never the quota tier.** `LIMITS_ENFORCED=false`
pins the quota tier to explorer for *everyone*, which is right for counting
calls and catastrophic for choosing a model: every paying user would silently
drop to the cheap model for the whole of a testing period, precisely while
someone is judging output quality. `api/ask-ai.ts` reads `storedTier` for this,
and `test/api/ask-ai.limits-paused.test.ts` exists to keep the two apart.

Why here rather than a central per-tier config: the model already lived on the
prompt document — it is why photo capture runs on a stronger model than
everything else — so a sibling field needed no new collection, no purpose
taxonomy, no inference rules and no cache. The cost is that there is no single
lever: moving all Explorer traffic means editing each prompt that has one set.
Most should never have one.

The twelve `GEMINI_MODEL` constants stay put. They are the fallback for a
prompt document that names no model, which is a different job from the tier
split. Worth knowing they are two generations behind (`gemini-3.8-flash` is
current): that is what the prompt fields are now for.

## Every live prompt is admin-editable

`tutorUrlValidation` was the last one building its prompt in code — the policy
deciding which links a tutor may show, changeable only by deploying, which is
not how a wrongly-refused tutor gets unblocked. It is now
`tutor-link-validate-prompt` with `{{url}}`, and `buildPrompt` warns if an edit
drops that placeholder, since the model would otherwise judge a link it was
never shown and return confident nonsense. Failure stays soft:
`validateUrlWithAi` never throws, so a broken template degrades to "could not
validate".

It is still deliberately not built from locale strings — a machine-to-machine
instruction, not user copy, and translating it would change the model's
behaviour per language. Moving it into Firestore is not translating it.

**`getImageService` has no callers yet, and that is deliberate.** Nothing in
`src/` imports it; the only references are two tests for
`findImageBySourceWord`. It is kept for planned work — generated images for
exam exercises, and a possible kids section — so **do not delete it** as dead
code on the strength of a call-site grep.

What it does still lack is a prompt document. Its `generateImage` is now the
only `askAI` call in the app with a model hardcoded in source
(`imagen-4.0-fast-generate-001`, already a generation behind
`gemini-3.1-flash-image`), and it takes its prompt text as an argument rather
than from Firestore. Both are worth fixing **when it gains its first caller**,
because that is when there is a real prompt to write: seeding one now would
mean guessing at the wording for a feature nobody has designed, and a guessed
prompt sitting in Admin is indistinguishable from a working one.

## "Estás a praticar mwl-PT" — the practice language, where it matters

`components/ui/PracticeLanguage.jsx`, two variants from one component: a
**card** at the top of `/dashboard/personal`, and a **badge** beside the title
on every page whose output is *in* the practice language.

**The code is the value.** `pt-PT` and `pt-BR` are different practice languages
and read almost identically as names, so the code is the part that actually
distinguishes them at a glance — and it fits beside a page title without
wrapping. **The code is deliberately not `uppercase`** anywhere, unlike every
other heading in this app: BCP-47 casing is part of what makes it precise, and
`MWL-PT` is not the code.

Where the long name goes differs by variant, and that is the whole reason there
are two. The **badge** has no room, so the name is one hover away via the app's
`Tooltip` and repeated in `aria-label`, since a hover tooltip does not exist for
a screen reader. The **card** has room, so it simply prints the name and carries
no tooltip at all — except when `useLanguageLabel` fell back to the code, which
is what happens for a language seeded after this browser loaded the list;
printing it twice reads as a rendering fault.

**The card is a flag field, and only "Trocar" is a control.** The flag stops
being an icon and becomes the card: `fi fi-xx` stretched over it with
`absolute inset-0 w-full h-full bg-cover`, under a left-to-right scrim. Three
things hold that up:

- **`bg-cover` beats `fi`'s own `background-size: contain` on source order
  alone**, because `main.jsx` imports `flag-icons` *before* `index.css`. No
  `!important` — but swap those two imports and the flag silently shrinks back
  to an icon in the corner.
- **The scrim is sized for the worst flag, not for Portugal.** White text needs
  to clear a white flag (Japan) as well as a dark one, so the left end stays at
  `slate-950/90` even though it costs Portugal most of its green. It is also
  fixed rather than theme-dependent: white on dark in both themes is what lets
  one contrast decision cover both.
- **A code with no region gets a gradient, not a hole.** `mwl-PT` flies
  Portugal's flag; `ia` flies none, and an empty field would read as a broken
  image.

**The whole card used to be one button and is not any more.** That made a
~145px flag field a click target for a navigation nobody asked for, and put a
heading, a code and a name inside a control, where a screen reader reads them
as one run-on label. It is a `<section>` with an `aria-label` now, and the
pill is the only actionable thing in it — the card informs, the button acts.
The badge stays a button end to end, because there it *is* the whole control.

**Both variants go to `/settings#practiceLanguage`**, not to `/settings`. The
note raises exactly one question — how do I change this — and landing on a page
of closed cards only half answers it. Named for the app's voice — "practice",
never "learning" — rather than for the section's own
`settings.language_learning` key.

**`utils/flagRegion.js` decides which flag a code flies**, shared by
`LanguageFlagIcon` and the card so the two can never disagree. Two steps, in
order: an explicit **region** subtag wins (`en-GB` → GB, `mwl-PT` → PT), and
failing that `Intl.Locale#maximize` is asked what region the language implies.

That second step is what gets a flag onto a code carrying a **script** where a
region would go — `ja-Hira` and `ja-Latn` (Japanese in hiragana and romaji)
both maximize to JP, and `sr-Cyrl` to RS. It is CLDR data shipped in the
browser, so it needs no table here and cannot go stale, the same argument as
`Intl.DisplayNames` for TTS accents and `Intl.supportedValuesOf` for timezones.

**Reading the language subtag as a country is the trap this exists to avoid.**
It looks like the obvious shortcut and fails at the case that prompts it —
`ja` is not `JP`, so Japanese would still get nothing — while being
confidently wrong elsewhere: `ca` (Catalan) is Canada's code, `ne` (Nepali)
Niger's, `si` (Sinhala) Slovenia's, `sv` (Swedish) El Salvador's. A missing
flag is a small disappointment; the wrong country on a language is not.

A language belonging to no single country maximizes to the UN's `001`
("World") — Interlingua does — and is rejected, because there is no flag for
it and the globe is the honest answer. Numeric M49 regions like `es-419` go the
same way.

**A flag alone stopped being an answer** the moment two seeded languages shared
one. `ja-Hira` and `ja-Latn` both fly Japan's, so any surface showing a flag
with no text beside it became a control that could not say what it was
pointing at. There was exactly one: the drawer's language grid below `sm`,
which is also **the only language picker a phone has** — the header's sits
inside `hidden md:flex` and never renders there at all. It shows the code
beside the flag now, with `normal-case` to survive the button's own
`uppercase`.

Everywhere else already pairs a flag with text and needs nothing: both trigger
buttons, the dropdown lists, `NeoDropdown`, this badge, `TutorCard` and
`TutorProfileSection`. Worth checking that when adding a flag anywhere new.

Known and deliberately left: both trigger buttons print the subtag as
`split("-")[1] || split("-")[0]`, uppercased, which renders `ja-Hira` as
**HIRA** and `sr-Cyrl` as **CYRL** — a script subtag where a country code is
implied. It does distinguish them, it only shows to someone whose *interface*
language is Japanese, and `utils/flagRegion` is where it would go if it is ever
worth unifying.

**It is opt-in per page, via `showPracticeLanguage` on `FeaturePageShell` /
`FeatureHeader`.** Currently on: the story reader, history & culture, the
dictionary, all four exam exercises, the three grammar pages, and all three
professional tools (one line in `ProToolShell`, which they share).

**The professional tools are the strongest case, not an exception.** All three
take `targetLang = user.learningDialect` (`CvToolPage.jsx:47` and its two
siblings) and offer no picker of their own, so the practice language silently
decides which market a CV is judged against and which language an email comes
out in — with nothing on screen saying so.

**The Translator is the one real exclusion.** It keeps its own `sourceLang` /
`targetLang` state with a swap, merely *defaulting* target to the practice
language, and already renders both codes as badges. A third badge claiming a
language the picker contradicts is worse than none.

Also **not** on the coming-soon pages (AI tutor, voice practice) — nothing
there generates anything yet — nor on the menus.

On the personal dashboard it sits above the grid rather than being a registry
widget: it is context rather than content, so it is not hideable in Settings
alongside the nine that are.

`ChallengeSidebar` already showed the dialect and keeps showing the raw code;
it gained the same tooltip, so the two surfaces explain themselves the same
way. Its label comes from the **progress record's** dialect, which is not
necessarily the one currently selected — a stored run keeps the language it was
played in.

Copy note: "praticar", never "aprender", per the app's voice — matching
`settings.language_learning` ("Idioma que Praticas").

`Tooltip` gained an optional `className` (default `w-full`, unchanged for every
existing caller) so an inline target can pass `inline-flex`; without it the
wrapper stretches the title row.

## Professional tools: one tier key, one register, one prompt budget

The three tools at `/dashboard/professional-tools` share the
`professional_tools` key — no per-tool keys, so Admin has one row rather than
four. `ProToolShell` carries the route gate, so no page can forget it.

**The register is a bare value, and there are three of them.** `{{tone}}` is
`"highly formal"`, `"professional"` or `"informal"` and nothing more; what that
*means* in a given language lives in the admin-editable template, not in a map
in the code.

It was two, and `formal` was doing the work of both — one setting covering a
cover letter to a hiring committee and a note to a colleague two desks away,
pitched at the first. The values are **phrases rather than tokens** because
every template interpolates them into "in a {{tone}} register" and **none of
them enumerate the options**, so a register that describes itself needed no
prompt edit to be understood. Check that before adding a fourth: an enumerating
template would silently match none of its branches.

The old stored `"formal"` needs no migration. `useToneChoice` keeps only a
value it still recognises and otherwise falls back to `DEFAULT_TONE`, which is
now `professional` — the register those users wanted when they chose formal.

`ToneChoice` is real `<input type="radio">` in a `<fieldset>`, not buttons with
`aria-checked`: arrow keys, one tab stop and "2 of 3" all come free. `disabled`
is set on each input **as well as** the fieldset, because a disabled fieldset
makes its controls non-interactive while leaving each input's own `disabled`
false, so anything reading the DOM sees an enabled radio. `_assertPlaceholders` warns
when a stored template has no slot for a variable being passed — otherwise the
toggle appears to work and silently changes nothing, the same trap
`{{requiredWords}}` and `{{speechPace}}` already have guards for.

**`fitToPromptBudget` measures the rendered prompt, never an estimate.**
`/api/ask-ai` rejects anything over 8000 characters with a 400 the user cannot
act on, and the template that wraps a CV is admin-editable — so a verbose edit
in Firestore can push a document that fitted yesterday over the line today.
Chunking was rejected deliberately: `askAI` raises the spend-confirm modal per
call, so N chunks is N modals and N of the user's daily allowance for one
document.

`AiNotice` exists because Terms §3.3 already promises AI features are
"identificadas como tal na interface" and that output must be reviewed before
use. It renders in the `input` variant before anything is generated and above
every result. Do **not** put it on the personal pages — a notice on a page with
no AI teaches people to ignore it where it matters.

## Skipped is not seen, and two games have three endings

A learner meeting a script they cannot read — Japanese hangman on day one — was
stuck: no way past a word they could not spell, and no way to find out what it
was. Two controls fix it while the word is still in play, and they end
differently on purpose.

**Skip** (`utils/skippedConcepts`) says "not this one, not yet". The id goes
into `localStorage`, keyed per learning dialect, and **never onto the profile**.
That is the whole distinction: a *seen* id is finished with, permanent and gone
from the pool on every device, while a *skipped* word stays in the pool for
when the learner can read it and is merely declined by this browser. Marking a
skip as seen would quietly delete the words somebody most wants back later — so
if these two ever look like they should be merged, they should not be.

Honoured inside `getWordService.getWord`, not per game, so a word put down in
Hangman is not handed straight back in Scrambled Word. Capped at 200, oldest
first, because an unbounded list in a place nothing prunes only grows — and a
word skipped two hundred words ago deserves another go. The Reset control
clears it alongside the seen ids, since "give me everything again" plainly
means both.

**Show the answer** is a third ending beside won and lost. It reveals the word,
ends the round and **does** mark it seen — you have now met it and had it
explained, so the pool offering it again would waste a turn. Losing still does
not mark it seen; there the word is genuinely unmet. Its banner is sky rather
than rose: asking to be shown a word you cannot read is a reasonable thing to
do, and punishing it in colour would be wrong.

Anything gating on "the round is over" has to name all three —
`isWinner || isLoser || isRevealed` — which is the keyboard, Play Again, the
guess handler, the mark-seen effect and the speaker.

**Scrambled Word has the same pair**, on the same terms: skip writes to
`skippedConcepts` and never to the profile, show-the-answer spells the tiles
out, ends the round and marks it seen. Its tiles go **sky, not emerald** —
green would claim a win the player did not have — and its status is a third
`gameStatus` value, so `isOver` is `isWon || isLost || isRevealed` there too.

Both are **icon-only with tooltips**, sitting beside Reshuffle. Three labelled
buttons under the tiles would compete with the tiles for attention, and these
are escape hatches rather than the thing to do.

**Easy/hard is one component now** (`ui/DifficultyToggle`). There were three
copies: Hangman and Scrambled Word drew the capsule, and the crossword had
grown a pair of separate `rounded-lg` buttons with a yellow fill, which read as
two independent controls rather than one two-way choice. What "hard" *means*
still belongs to each game — an accented letter typed as itself in Hangman and
the crossword, and in Scrambled Word a full re-deal, because the tiles carry
the accents and every one of them is wrong the moment it flips.

**The speaker is available from the first guess, and that is a game-design
decision rather than an oversight.** The word spoken aloud is, strictly, the
answer — so hangman here is not "guess letters blind" but "hear it and spell
it". For language practice that trade is worth making: dictation teaches more
than guessing, and in a script the learner cannot read yet it is the difference
between an exercise and a wall. Anyone wanting the harder game just does not
press it. It sits under the clue and above the scaffold, which is the order a
round is read in — what it means, what it sounds like, how much rope is left.

**It is one speaker, not the row of three.** `TtsControls` takes
`variant="single"`, which collapses to a play/stop toggle like the story
reader's. The part worth losing is the turtle: it plays under
`${ttsKey}-slow`, which is a *separate* clip and therefore a second AI call —
on a challenge that quietly spends a second of a free tier's three for the day,
next to a button that looks like a playback speed. Stop rather than pause,
because one word is not long enough to want to resume in the middle of.

It speaks `spokenWord`, the original casing from the service, not the
uppercased `word` the letter matching needs: some engines read an all-caps
string as an acronym and spell it out.

**It is an ordinary AI call, and that was a decision rather than an oversight.**
`/api/ask-ai` counts every call against `aiCallsToday` for Explorer and Voyager
with no TTS exemption, and `getTtsService` passes `skipConfirm: true`, so a
speaker tap spends one of three daily calls silently. The clip cache is
One press is one call, and replays within a session
come from the in-memory cache, so a round costs at most one — but a free tier
on three calls a day can spend them on three words.

**It has now spread, and the counter was not revisited.** Scrambled Word has
the same single speaker; Word Search has a small one on every word in its list,
and the crossword one on every *solved* clue. A twelve-word Word Search
therefore puts twelve billable buttons on screen at once, any three of which
exhaust an Explorer's day — and speaking one word costs the same quota as
generating a whole story, which is the actual mismatch. Worse, `getTtsService`
caches clips **in memory only**, so the same word is billed again after a
reload. Metering TTS separately from generation is the outstanding piece of
work; until it exists, every new speaker is another way to spend a free tier's
whole day on a single word.

**The crossword's is deliberately limited to solved entries.** Hearing the one
word you are stuck on is the trade Hangman and Scrambled Word make on purpose;
a clue list is nine of them at once, and a speaker per row before they are
solved would simply read the answers out. After an entry is solved it gives
nothing away and is ordinary pronunciation practice.

## The word pool is read whole, and uniqueness is enforced in code

`wordPool` is a shared cache, and two things kept breaking it.

**A prompt is not a uniqueness constraint.**
`get-word-generate-new-concept-prompt` does carry `{{avoidList}}` — every
`normalizedKey` in the pool — and the model is told in as many words not to
repeat. It repeats anyway. One crossword build produced **seven `passport`
concepts in thirteen seconds**, each with its own reworded hint, every one
generated while "passport" sat in the avoid list it had just been handed. A
hard instruction ("must be about travel") against a soft one (a long negative
list, last line, `temperature: 0.9`) is not a fair fight.

So `_adoptOrCreateConcept` looks `normalizedKey` up before writing — one
indexed equality, on the generate path only — and reuses the existing concept
rather than regenerating, because a second AI call to dodge a collision spends
a daily allowance on a word that was already free. The lookup **never throws**:
a failed check degrades to the old behaviour, and a duplicate is a much smaller
problem than costing somebody the word they were waiting for.

**The pool is fetched whole, not paged.** `POOL_LIMIT` was 200 and so was the
API's `MAX_QUERY_LIMIT`, and together they were silently wrong: past 200
concepts every user walked the same arbitrary slice — there is no `orderBy`, so
it is document-id order — exhausted it, and generated past it for ever. The
avoid list only ever named that slice, so the duplicates compounded, and
`getWordPoolCount` read the same capped page, so the sidebar's total plateaued.
Both are now large. That cap was never an abuse control and could not be one:
`startAfter` already lets any caller page past it.

**Consumers must dedupe on the word, not the concept id.** Crossword and Word
Search each draw N words in a loop, excluding the ids already drawn — which is
correct and insufficient, because several concepts can carry one word. Compared
through `normalizeChar`, so `río` cannot come back beside `rio`.

**Collecting words has a time budget** (`utils/wordBudget`), because nothing
was watching the total: Word Search asks for twelve words one at a time, and
when the pool cannot serve them each is an AI generation of about two seconds.
Two rules in order — a floor of `MIN_WORDS` that the clock cannot undercut,
since a two-word crossword is not a puzzle, then `WORD_BUDGET_MS` once the
floor is met, after which the remaining words are a bonus rather than a wait.
The budget is deliberately longer than the floor costs to fill, or it would
never be the thing that stopped the loop. It is checked **before** each
request, never during one: a generation in flight has already been paid for,
so the elapsed time can overshoot by one request rather than waste it.

Two things known and deliberately left. **The dedupe key is English** — a model
returning `valley` and `dale` writes two concepts that are one word in Spanish;
the consumer-side check catches them in a puzzle, the pool still holds both.
And **every `getWord` re-fetches the whole pool**, so one puzzle reads it a
dozen times. Harmless at a few hundred documents and the obvious next lever if
the wait is still too long — it wants the pool passed in rather than fetched
per call, which is a signature change across every caller.

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

**The personal dashboard's `WordBankWidget` is the only place words are
managed.** There used to be a second surface in Settings (`WordBankSection`,
now deleted) from before that dashboard existed — the same list with a smaller
delete. Two places to remove a word is one more than the feature needs, and
Settings is not where anyone thinks about their own material. The widget is a
strict superset: every word, newest first, in a scrolling region, with a
thumb-sized delete and tap-to-look-up. The story sidebar
(`WordBankSidebar`) is unaffected — that is collecting, not managing.

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
