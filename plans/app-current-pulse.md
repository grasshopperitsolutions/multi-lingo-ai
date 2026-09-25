# App Current Pulse

**Status:** queued — not started. Written 2026-09-24.
**Where it lives:** a new section in Admin, named **Pulse**. It shows how the app is being used, with metrics and charts. The word "analytics" is avoided on purpose.

## Why

Admins can't currently see what is happening in the app: who is active, what gets generated, which features are used. Most of the answers are already stored in Firestore. Pulse gathers them in one place.

## What makes it possible, and what limits it

- **Every shared pool records when each item was created and by whom.** The API's Firestore proxy stamps `createdAt`, `createdBy` and `updatedAt` on everything written through it, so every pool is already a time series.
- **User profiles hold only the latest value of each field.** `lastStreakDate` is the last day a user opened the app signed in. It answers "active in the last X days", but it can't produce a curve for past days. The same applies to `aiCallsToday` and `aiCallsDate`, which only hold today's count. Phase 3's daily snapshot is what adds trend lines.
- **Anything generated and not saved leaves no trace.** That covers the translator, dictionary lookups, professional tools, Practice Text, reading-aloud feedback, photo capture and live tutor sessions. The `ai_request_start` log doesn't name the feature, and Vercel's log tools only look back about 24 hours, so logs aren't a history.
- **Only signed-in users are visible.** Guests are invisible without Google Analytics (see the end of this plan).
- **Privacy.** §3.4 of the privacy policy already covers first-party usage tracking from our own server records, using aggregated data. Pulse is server-side and sets no cookies, so it needs no consent prompt. **It shows counts only.** It never shows the content of anyone's notes, mistakes, questions or recordings, and it never lists individual people's activity.

## Screen layout (all phases)

- **A row of headline numbers** at the top, each with the change since the previous period once Phase 3 adds snapshots.
- **A period picker:** 1, 7, 30 or 90 days, plus a custom range. The default is 7 days.
- **Cards grouped by area:** People, Plans & money, Content & AI, What people use, Community & support, Messaging.
- **Charts:**
  - Bar charts for counts per day.
  - Stacked bars for breakdowns (for example tales per day by language).
  - Ranked horizontal bars for distributions (languages, interests, tiers).
  - A single gauge or ratio for rates (onboarding completion, pool reuse).
  - Line charts only once Phase 3 provides a real history.
- **Charting library:** to be chosen when building. It should be loaded only when Pulse opens, as jspdf is, so it adds nothing to the main bundle. It must also follow the app's light and dark themes.
- **Access:** admin only, in the existing Admin page, with the same gate as the other Admin sections. No new route permission.
- **i18n:** admin panels are exempt from translation, so the labels are English.

## Phase 1 — ready now, high interest

Everything here is read from what already exists. Nothing new is written anywhere.

| Metric | Source | Chart |
|---|---|---|
| Total users; new sign-ups per day | `users.createdAt` | Headline number + daily bars |
| Active users in the last 1, 7 and 30 days | `users.lastStreakDate` | Three headline numbers |
| Onboarding completion rate | `users.onboardingCompleted` | Ratio / gauge |
| Interface languages in use | `users.interfaceLang` | Ranked bars |
| Practice languages in use | `users.learningDialect` | Ranked bars |
| Users per tier | `users.subscriptionTier` | Ranked bars |
| Subscription health: active, past due, cancelled, renewals due in the next 7 days | `subscriptionStatus`, `currentPeriodEnd` | Headline numbers |
| Free users at today's AI limit | `aiCallsToday` at the tier's `aiCallsPerDay` (tiersConfig) | Headline number (upsell signal) |
| AI calls today, per tier | Sum of `aiCallsToday` where `aiCallsDate` is today | Bars by tier |
| Tales generated per day, by language, level and theme | `stories` (`createdAt`, `targetLang`, `level`, `theme`) | Stacked daily bars |
| Tales read, and pool reuse (reads per tale generated) | Totals of `seenStoryIds` ÷ number of `stories` | Headline number + ratio |
| Culture pieces generated and read | `historyFacts`, `seenHistoryFactsIds` | Daily bars + headline number |
| Exam exercises generated (by type, level, language) and completed | `examExercises`, `seenExerciseIds` | Stacked bars by type |
| Languages added in the period, and by whom | `appConfig/config/languages` (`createdAt`, `createdBy`) | List + count |
| Open problem reports; new this period | `appConfig/config/reports` | Headline number + link to the Reports section |

**How it's built:** the page computes everything in the browser, from Admin queries the app already makes (`listAllUserProfiles`, with a limit of 1000) and from pool queries filtered by `createdAt`. That's fine at today's size, which is under 100 users. The pool queries return whole documents, so ask for the fewest fields and the narrowest date range possible.

**Known limits, shown on the page:** active users is "last seen within X days", not a daily history. AI calls are today only.

## Phase 2 — ready now, medium and low interest

The same approach as Phase 1: read-only, computed in the browser.

**Medium**

| Metric | Source |
|---|---|
| Dormant users (not seen for over 30 days) | `lastStreakDate` |
| Streak distribution and records | `dayStreak`, `highestDayStreak` |
| Where users are (region, from timezone) | `timezone` |
| Interests chosen | `interests` |
| Reading-aloud passages generated and used | `pronunciationPassages`, `seenPassageIds` |
| Grammar topics and exercises created | `grammarTopics`, `grammarExercises` |
| Word pool growth per day, by source; words met | `wordPool`, `seenConceptIds` |
| Word Link and Word Ladder puzzles made and solved | `wordLinkGamePool`, `wordLadderGamePool`, and the matching `seen*` ids |
| Speech clips cached per day, by voice and language; storage used | `ttsClips` (`createdAt`, `voice`, `language`, `bytes`) |
| Interface languages set up | `appConfig/config/locales` |
| Features people favourite | Feature favourites on the profile |
| Word bank sizes | `favWordIds` |
| Tutors: published, hidden, new; languages offered | `tutors` |
| Tutor applications waiting | `appConfig/config/tutorApplications` |
| Contact messages per period | `contactSubmissions` (admin-read policy) |
| Push enabled, reminders on, notification opt-outs | `fcmTokens`, `reminderPrefs`, `notificationPrefs` |

**Low**

| Metric | Source |
|---|---|
| Sign-in method mix | `provider` |
| Theme, compass cursor, chosen AI voice | `theme`, `customCursor`, `preferredVoice` |
| Dashboard layout and hidden widgets | `dashboardPresentation`, `hiddenPersonalWidgets` |
| Translations made per interface language | `*/content/{locale}` subcollections |
| Mail queue depth, sent per day | Mail queue, `cronRuns` |

## Phase 3 — partial data, or needs new fields or code

Each item needs new code, and most need a change in the API. **None needs a new endpoint:** each one extends an existing endpoint or the existing daily cron. Do them in this order:

1. **A daily snapshot (do this first).** The existing daily cron (`GET /api/email`, 06:00 UTC) writes one small document per day, for example `appConfig/pulse/days/{YYYY-MM-DD}`. It holds: active users that day (from `lastStreakDate`), users per tier, sign-ups, onboarding completions, AI calls per tier (read before the daily counters reset), and items created in each pool. **This is what turns "right now" numbers into trend lines**, and it makes Pulse cheap at scale, because it reads about 30 small documents instead of every profile.
2. **AI calls, and later tokens, per feature.** Every AI call already reads its prompt document, so it sends a `feature` value (for example the prompt key) with its request to `/api/ask-ai`. The API adds one to a daily counter document per feature and tier, then records token counts from the provider's response to estimate cost. **This is the highest-value new data.**
3. **Live tutor sessions and minutes.** `/api/live-token` counts each token it issues, which is server-side and trustworthy. Minutes can only be reported by the browser when a session ends, so label them as indicative.
4. **Feature page opens.** A lightweight daily counter per feature page. It needs a write path, so decide first: the Firestore proxy or a batched write from the browser. This also covers the features that generate without saving: translator, dictionary, professional tools, Practice Text, voice feedback and photo capture.
5. **Where each user came from.** Save the referrer or campaign tag once, at sign-up, on the user profile. That gives first-touch acquisition data with no cookies. Add it to AppContext's load allow-list only if the app itself ever reads it.
6. **Account deletions.** `DELETE /api/auth` adds one to a counter before deleting.
7. **Plan changes with detail.** `stripeEvents` only keeps the event type and time. Either store the tier and the direction of each change there, or read Stripe for revenue, monthly recurring revenue and churn.
8. **Attempts to use a locked feature.** Count `tier_access_denied` and `live_token_denied` into the daily counter, which today exist only as log lines.
9. **A more precise "last seen".** Firebase Auth's `lastRefreshTime` moves roughly hourly while the app is open, now that the token is renewed. Only the server can read it, so the daily cron would fold it into the snapshot.
10. **Early retention.** Once snapshots exist: of those who signed up in week N, how many were active in weeks N+1 to N+4.
11. **Personal space use** (counts only): how many users keep phrases, mistakes, questions and notes. This needs an admin-wide query across users' subcollections, so it belongs in the snapshot.
12. **Push and email opens.** Low interest; only if reminders become a focus.

## Checks per phase

- Lint, tests and build.
- Test every number with a fixture: fixed documents in, the expected count out.
- Check the page in the browser against the real data, and spot-check a few numbers by hand against Admin › Users.
- Phase 3: an API test for each counter, and a check that a failed counter write never fails the request that triggered it.

## Not in this plan: Google / Firebase Analytics

It adds the following:
- **Guests.** Visits to the landing, pricing and public pages, which the app can't see today.
- **Acquisition.** Where visitors come from (search, social, referrers, campaign tags), and the full path from landing page to sign-up, onboarding and upgrade.
- **Behaviour.** Page views, navigation paths, time on page, sessions, and a real-time view.
- **Device information.** Device, browser, operating system and screen size, plus country and city.
- **Ready-made analysis.** Retention cohorts, predicted churn and purchase likelihood (with enough volume), a BigQuery export, and Firebase A/B testing.

It costs the following:
- A consent prompt.
- Rewriting privacy policy §2.7, which currently promises no cookies at all and consent before any analytics. §3.4, §3.6 and §4 need updating too.
- A Google script on every page.
- Undercounting, because ad blockers hide some visitors.
- Usage data going to Google.

Phase 3 item 5 covers part of the acquisition question without it. Reconsider it once the question is "what happens before sign-up".
