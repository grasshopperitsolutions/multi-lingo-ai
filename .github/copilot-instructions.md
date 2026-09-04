# Copilot instructions

Always read [../CLAUDE.md](../CLAUDE.md) before answering questions, proposing changes, or editing code in this repository.

This file is the project brief for AI agents working in this repo. Treat it as the canonical source for architecture, workflow, conventions, and repo boundaries.

## Required workflow

- Read [../CLAUDE.md](../CLAUDE.md) first on every task.
- Before making architectural or API decisions, confirm whether the work belongs in this frontend repo or in the sibling backend repo.
- Prefer existing project patterns over inventing new ones.
- When an issue touches auth, Firestore, storage, AI requests, onboarding, billing, or subscription logic, inspect the sibling API repo at C:\Nuno\Projects\GrasshopperWebSite\proxies\multi-lingo-ai-api before assuming it should be implemented here.
- The frontend repo is the UI/client layer only; the API repo is the backend source of truth.
- Use the shared proxy wrapper and existing service patterns instead of raw fetch calls.
- Do not assume a test suite exists; run lint and build after changes, then verify behavioural changes in a browser against the dev server. Neither automated check runs the app.
- Error reporting is errors-only by design (`src/sentry.js`); do not enable Session Replay, tracing, or analytics without a privacy policy change.

## Project boundary

This repo is a Vite + React frontend. It talks to the API repo via the VITE_PROXY_URL environment variable and the shared fetch wrapper in the frontend services layer.

Any real backend logic belongs in:
- C:\Nuno\Projects\GrasshopperWebSite\proxies\multi-lingo-ai-api

That API repo contains the actual endpoints for:
- /api/auth
- /api/firestore
- /api/storage
- /api/ask-ai
- /api/stripe

## Priority rules

1. Read the project brief in [../CLAUDE.md](../CLAUDE.md).
2. Follow repo conventions in the frontend code.
3. Reuse existing components, services, and routing patterns.
4. Keep backend work in the sibling API repo.
5. If the task involves translation or locale loading, follow the focused i18n skill at [../.github/skills/i18n/SKILL.md](../.github/skills/i18n/SKILL.md).
6. Validate with the smallest relevant command, typically npm run lint for frontend changes.
