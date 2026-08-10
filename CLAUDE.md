# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Production build
npm run preview   # Preview a production build locally
npm run lint      # ESLint (flat config in eslint.config.js); run after every change
```

There is no test suite/framework configured in this project (no `test` script, no Jest/Vitest dependency) — do not assume one exists.

## Companion backend repo

This repo has no backend of its own. Its API proxy lives in a sibling repo at `C:\Nuno\Projects\GrasshopperWebSite\proxies\multi-lingo-ai-api` — a Vercel serverless API backed by Firestore. This frontend reaches it via the `VITE_PROXY_URL` env var (see `.env.example`; defaults to `https://multi-lingo-ai-api.vercel.app` in `src/services/apiClient.js` and `src/services/firestoreService.js`). Adding or changing a backend endpoint means editing that other repo, not this one.

## Architecture

This is a Vite + React 18 SPA (`react-router-dom` v6) — the frontend for "Multi Lingo AI", an AI-powered European Portuguese (and other language) learning app. It has **no backend of its own**: all server-side logic lives in a separate sibling repo, `multi-lingo-ai-api` (deployed on Vercel), which this app talks to as a proxy.

### Backend proxy pattern

- `VITE_PROXY_URL` (env var, defaults to `https://multi-lingo-ai-api.vercel.app`) is the base URL for all backend calls.
- `src/services/apiClient.js` exports `apiFetch(path, options, fallbackErrorMessage)` — the shared fetch wrapper. Every backend endpoint responds with an envelope `{ success: true, data }` or `{ success: false, error }`; `apiFetch` unwraps `data` and throws on failure. **Always** use `apiFetch` for new proxy calls instead of raw `fetch`, to avoid reading from the wrong envelope level.
- `src/services/firestoreService.js` talks to Firestore indirectly through the same proxy (`GET/POST /api/firestore?collection=...&id=...`), not the Firestore SDK directly — Firebase is used client-side only for **Auth** (see `src/firebase.js`, which only calls `getAuth`, no `getFirestore`).
- Since the backend lives in a different repo, adding a new backend endpoint means changing that other codebase — always look for an existing proxy endpoint to reuse/extend before assuming a new one is needed.
- Most service calls need a Firebase ID token. `getToken()` in `firestoreService.js` requires a signed-in user; `getTokenOrAnonymous()` transparently signs the user in anonymously so guest-accessible reads (translations, supported languages, categories) still work before login.

### State management: one global context

`src/contexts/AppContext.jsx` (`AppProvider` / `useAppContext`) is the single global store — there is no Redux/Zustand/etc. It owns:
- Auth/user profile state (merges Firebase Auth fields with the Firestore `users` profile document — see the documented precedence rules for `displayName`/`photoURL` vs. other profile fields in that file).
- Theme (dark/light), persisted to Firestore for logged-in users and `localStorage` for guests.
- Interface language (`interfaceLang`) and the i18next translation-loading pipeline (see below).
- Supported languages/writing systems and interest categories (fetched once on app load, guest-accessible).
- Full Exam session state (`examSession`).
- A periodic Firebase ID-token validation loop (every 50 min) that flags `tokenExpired` and shows a persistent alert if the session can no longer be refreshed.

Feature-specific hooks build on top of this context, e.g. `src/hooks/useTierAccess.js` derives subscription-tier gating (`explorer`/`voyager`/`maestro`/`vip`/`admin`, daily AI call limits from `src/config/tierLimits.js`) from `user` in `AppContext`.

### i18n / dynamic translations (core to this app)

This is not static i18n — translations are seeded and back-filled by AI at runtime and stored in Firestore, then synced into i18next in-memory:

- `src/i18n.js` initializes i18next with **only** `en-US` bundled locally (`src/locales/en/translation.json`) as `resources`. It deliberately sets **no `supportedLngs` allowlist** — the code comments explain that i18next caches `supportedLngs` at `init()` and any locale added later via `addResourceBundle` would otherwise be silently rejected. Do not add a `supportedLngs` list without re-reading that comment.
- `loadRemoteTranslations(locale, translations)` registers a fetched translation bundle into i18next via `addResourceBundle`.
- `registerMissingKeyHandler(fn)` wires i18next's `saveMissingHandler` to `translationService.fillMissingTranslations` (registered from `AppContext`), so that a missing key for a non-English locale triggers an AI translation fill against Firestore, fire-and-forget.
- Flow on language change / app load (`AppContext.loadTranslationsForLang`): clear local cache → `translationService.getTranslations(lang, token)` (Firestore via proxy, falls back to local `en-US`) → `loadRemoteTranslations` → `i18n.changeLanguage(lang)` → background `fillMissingTranslations` to backfill any gaps or seed a brand-new locale document.
- Per `.clinerules/internationalization-guidelines.md`: never hardcode user-facing text in components — always go through the translation system (`useTranslation()`/`t()`), check for an existing key/translation before adding new content, and consider SEO implications per target language (see `src/components/SEOMeta.jsx`, used per-page with a sitewide default set in `PublicLayout` in `App.jsx`).

### Routing structure (`src/App.jsx`)

Two top-level layouts under `AppLayout`:
- **`PublicLayout`** (`/*` catch-all for public routes) — wraps `Header`/`Footer`, marketing/static pages (terms, privacy, contact, pricing, subscription result, home).
- **App/dashboard routes** — rendered without `Header`/`Footer`: `/login`, `/onboarding`, `/settings`, `/admin`, `/app-unavailable`, and `/dashboard/*` (nested under `DashboardLayout`, lazy-loaded).

All `/dashboard/*` feature pages (translator, dictionary, challenges/games, exam-training exercises, "coming soon" pages like grammar/AI tutor/voice practice) are `React.lazy`-loaded for route-level code splitting — follow this pattern for any new dashboard route.

Route guards are plain wrapper components, not a routing library feature:
- `RequireOnboarding` — redirects to `/onboarding` if `user.learningDialect` isn't set yet.
- `RequireAdmin` — redirects to `/dashboard` unless `useTierAccess().isAdmin`.

### Firebase usage

`src/firebase.js` initializes Firebase Auth only (guarded so it no-ops cleanly if `VITE_FIREBASE_API_KEY` is absent, e.g. in an SSG build context). There is no client-side Firestore/Storage SDK usage — all data access goes through the `multi-lingo-ai-api` proxy described above.

### Project conventions (from `.clinerules/`)

- **Component reuse**: check `/src/components/` for an existing component before writing new UI; extend existing components rather than duplicating; extract genuinely duplicated patterns into new shared components under `/src/components/`.
- **i18n**: see the i18n section above — this is treated as mandatory, not optional, for all user-facing content.
- **Lint**: escape quotes in JSX (`react/no-unescaped-entities`); avoid exporting non-component values from component files (`react-refresh/only-export-components`); run `npm run lint` after changes and resolve warnings before considering work done.
- **SVG file creation**: create SVGs as a `.txt` file first, edit the content, then rename to `.svg` — a required two-step workflow in this project.
