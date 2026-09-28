# Plans

A queue of plans agreed but not yet built. One file per plan.

- **Adding a plan:** write a new file here, and add a line under "Queued" below.
- **When a plan is built:** delete its file and its line. The code, CLAUDE.md and git history then describe what was built.
- **When a plan or idea is dropped:** move its line to "Dropped", with the date and a one-line reason, so it isn't proposed again without that context. Its file can be deleted.

## Queued

- None.

## Dropped

- **Pulse: push and email open tracking** (Phase 3 item 12 of App Current Pulse) — 2026-09-28. Low interest until reminders become a focus; it would need provider webhooks and per-message ids.
- **Google / Firebase Analytics** (listed as out of scope in App Current Pulse) — 2026-09-28. It sees guests and the path to sign-up, but costs a consent prompt, a rewrite of privacy policy §2.7 (no cookies, consent before any analytics), a Google script on every page and usage data going to Google. Pulse's first-touch acquisition covers part of the question. Reconsider when the question is "what happens before sign-up".
