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
- Run lint after frontend edits.

## Do not assume

- that a backend exists in this repo
- that there is a test suite for this frontend
- that user-facing strings can be hardcoded without checking i18n rules
- that a new endpoint should be created here when the API repo already owns the backend
