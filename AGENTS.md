# AGENTS.md

This repository has a project brief in [CLAUDE.md](CLAUDE.md). Read it before making changes or answering questions.

All AI agents must treat [CLAUDE.md](CLAUDE.md) as the canonical project overview for repo conventions and team-specific rules.

## Critical repo boundary

This is the frontend app only. The real backend lives in the sibling repo:

C:\Nuno\Projects\GrasshopperWebSite\proxies\multi-lingo-ai-api

If a task involves auth, Firestore, storage, AI requests, planning, billing, subscriptions, or data persistence, inspect that API repo before deciding where to implement the fix.

## Standard workflow

- Read [CLAUDE.md](CLAUDE.md) first.
- Check whether the task is frontend-only or backend-related.
- Reuse existing services, components, and route patterns.
- Use the shared API proxy wrapper instead of raw fetches.
- If the task concerns locale loading or translations, follow the i18n skill in [.github/skills/i18n/SKILL.md](.github/skills/i18n/SKILL.md).
- Run lint after frontend edits, then build, then open the affected screen in a browser. There is no test suite here, so lint and build are the only automated checks and neither one runs the app.

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
- that there is a test suite for this frontend
- that a green lint and build mean the app works — verify behavioural changes in a browser
- that user-facing strings can be hardcoded without checking i18n rules
- that editing an existing locale string reaches the other locales; only *missing* keys are auto-filled
- that analytics, Sentry tracing, or Session Replay can be added freely — the privacy policy makes explicit promises about what this app does not collect
- that a new endpoint should be created here when the API repo already owns the backend
