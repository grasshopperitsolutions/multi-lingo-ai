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

## Architecture summary

- Vite + React SPA
- React Router v6
- Single global store in src/contexts/AppContext.jsx
- Firebase Auth only in the frontend; no Firestore/Storage SDK usage on the client
- All backend data access goes through the sibling API repo via apiFetch and the proxy layer

## Critical repo rules

- Use src/services/apiClient.js and apiFetch for backend requests instead of raw fetch.
- Treat the sibling API repo as the source of truth for backend behavior, Firestore access, storage, AI quotas, and Stripe logic.
- Do not hardcode user-facing strings; use the translation pipeline and existing i18n keys.
- Reuse shared components before creating new UI.
- Follow the route guard and lazy-loaded dashboard patterns already used in src/App.jsx.
- Run npm run lint after frontend edits and resolve warnings before considering the work done.

## i18n workflow

This project loads locales from Firestore and then syncs them into i18next. The key rules are:

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

## Do not assume

- that a backend exists in this repo
- that a new endpoint should be created here when the API repo already owns the backend
- that there is a test framework in this frontend
- that user-facing content can be hardcoded without checking translation rules
