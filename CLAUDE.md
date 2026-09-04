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
```

There is no project test suite configured; do not assume one exists.

**This is the single most important fact about working here.** `lint` and `build` are the only automated checks, and neither one runs the app. A change that compiles and lints can still be broken at runtime, and CI will happily go green on it — after which `deploy-prod` publishes to production. So the verification bar for anything behavioural is: run the dev server and exercise the affected screen in the browser. "It builds" is not evidence.

## Architecture summary

- Vite 8 (rolldown bundler) + React 19 SPA
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

## Dependencies

Dependabot is configured in `.github/dependabot.yml`, grouped so minor/patch updates arrive as two PRs a week and majors arrive individually — because with no test suite, ten green PRs at once is how a real break gets merged.

Two upgrades are currently blocked, and both will keep being proposed:

- **ESLint 10** — `eslint-plugin-react` has no release that accepts it (peer-caps at `^9.7`). Forcing it with `--legacy-peer-deps` is not the answer.
- **firebase-admin 14** in the sibling API repo — unrelated to this app, but the same lesson: it passed every local check and took production down. See that repo's CLAUDE.md.

## Critical repo rules

- Use src/services/apiClient.js and apiFetch for backend requests instead of raw fetch.
- Treat the sibling API repo as the source of truth for backend behavior, Firestore access, storage, AI quotas, and Stripe logic.
- Do not hardcode user-facing strings; use the translation pipeline and existing i18n keys.
- Reuse shared components before creating new UI.
- Follow the route guard and lazy-loaded dashboard patterns already used in src/App.jsx.
- Run npm run lint after frontend edits and resolve warnings before considering the work done, then `npm run build`, then verify the affected screen in a browser against the dev server. The first two do not exercise the app.
- Do not add analytics, tracking, or Sentry features beyond error capture without reading the privacy policy strings in `src/locales/pt/translation.json` first — several of them make explicit promises about what this app does not do.
- Editing an existing locale string does not propagate: `fillMissingTranslations` only fills keys that are *missing*. Changing wording in pt-PT needs the admin force resync, or every other locale keeps the old text.

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

## Do not assume

- that a backend exists in this repo
- that a new endpoint should be created here when the API repo already owns the backend
- that there is a test framework in this frontend
- that user-facing content can be hardcoded without checking translation rules
