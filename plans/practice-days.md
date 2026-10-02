# Replace the day streak with "practice days"

## Context
The app has a punishing day streak ("Dias Seguidos", "Melhor Sequência", a "Não percas a tua sequência" push), while the brand's positioning — landing page *what_it_isnt* ("uma sequência de dias que tens de proteger"), post ML-B01-06 (27 Oct), Playbook — says Multi Lingo has no streak to protect. Nuno chose to make the product match the promise: keep the habit motivation, drop the reset-to-zero guilt.

Decisions (Nuno, 1 Oct 2026):
- **A practice day = opening the app** (signed in), exactly as today's trigger. No forced activity.
- Show **days practiced this week** and **days practiced this month**, as a visual calendar/map in the personal space. **Five designs** are mocked first; Nuno picks one.
- **No "highest streak".** Instead **"best month"** (most practice days in a calendar month) and a running total.
- **Weekly goal default 3**, from the existing `weeklyTarget` ("Sessões por semana"); keep it as a reusable parameter for a future scheduler.
- **Reminder:** "save your streak" → gentle **weekly-goal nudge**, default on, opt-out.
- **Migration:** total practice days seeded from `max(highestDayStreak, dayStreak)`.

Deadline that matters: ML-B01-06 posts **Tue 27 Oct**; S05 poll ("Streaks: motivating or stressful?") on 28 Oct.

## What exists today (mapped)
- Single writer: `updateDayStreak` (`src/services/userService.js:510-570`), called once from `loadUserProfile` (`src/contexts/AppContext.jsx:621`), UTC dates, fields `dayStreak`, `lastStreakDate`, `highestDayStreak` on `users/{uid}` (client-written, not protected).
- Readers: `TodayPanel.jsx:120-122`, `PracticeStreakWidget.jsx` (widget id `streak` in `config/personalWidgets.js:44`), admin Pulse (`utils/pulseMetrics.js` 143/283/286-312, `components/admin/pulse/PeopleGroup.jsx`, `MessagingGroup.jsx`, `PulseSection.jsx:178`), API `lib/reminders.ts` (streak_rescue 35/49-57/234-246) via `api/email.ts:483-507`, API `lib/pulse-snapshot.ts:65-85`.
- `lastStreakDate` doubles as "last seen" for Pulse and for the reminders' "practised today".
- `weeklyTarget` lives in `users/{uid}/personalSettings/main` (`personalService.js:149-161`, `usePersonalSettings.js:32`, `GoalWidget.jsx`, `GoalPage.jsx:123`) — subcollection, so the API reminder loop can't see it cheaply.
- No per-day history exists anywhere.

## Data model (users/{uid}, written by the client through the existing `/api/firestore` PUT — no new endpoint)
| Field | Shape | Purpose |
|---|---|---|
| `practiceDates` | `["2026-10-01", …]` local `YYYY-MM-DD`, rolling **last 400 days** | the calendar/map, this week, this month |
| `practiceMonths` | `{ "2026-10": 5, … }` never trimmed (~12 entries/yr) | best month, yearly view, totals |
| `practiceDaysSeed` | number, set once | carried-over history from the old streak |
| `lastPracticeDate` | local `YYYY-MM-DD` | "practised today" + Pulse last-seen |
| `weeklyTarget` | number (mirror of personalSettings) | readable by the API reminder loop; default 3 |

- **Local date** (user's device day), not UTC, so the calendar matches the user's own week. ISO week, Monday start.
- Total practice days = `practiceDaysSeed + sum(practiceMonths)`.
- Old fields `dayStreak` / `highestDayStreak` / `lastStreakDate`: stop writing; leave existing data in place (no deletion pass); readers switch with a `lastPracticeDate ?? lastStreakDate` fallback during rollout.

## Implementation steps

### 1. Pick the visual (before any code)
Build an artifact page with **5 design options** for the personal-space practice visual, in the brand (neo-brutalist, Outfit, light + dark), using realistic sample data (incl. a seeded user). Candidates: (a) GitHub-style month heatmap grid, (b) 7-day week strip + month calendar, (c) ring/donut "3 of 3 this week" + month bar, (d) year "dot map" (12 mini-months, best month highlighted), (e) stamp/passport card that fills per day. Each shows: this week vs goal, this month, best month, total. Nuno picks one (may mix). **Gate: no UI code until chosen.**

### 2. Frontend data layer
- `src/services/userService.js`: replace `updateDayStreak` with `recordPracticeDay(token, uid, profile)` — no-op if today already recorded; otherwise append date (trim to 400 days), increment `practiceMonths[YYYY-MM]`, set `lastPracticeDate`; on first run (no `practiceMonths`) also write `practiceDaysSeed = max(highestDayStreak, dayStreak)`. Pure helpers in a new `src/utils/practiceDays.js`: `localToday()`, `isoWeekDays(dates, today)`, `monthCount`, `bestMonth`, `totalDays` (unit-tested, like `utils/` today).
- `AppContext.jsx:621, 696-697`: call `recordPracticeDay`; hydrate `practiceDates`, `practiceMonths`, `practiceDaysSeed`, `lastPracticeDate` instead of `dayStreak`/`highestDayStreak`.
- `weeklyTarget`: when saved (`personalService.js`, used by `GoalWidget`/`GoalPage`), also write `users/{uid}.weeklyTarget`; read default **3** everywhere (change default 0 → 3 in `usePersonalSettings.js:32`; GoalWidget no longer "intent only" — it can now show progress).

### 3. Frontend UI
- `TodayPanel.jsx:120-122`: "Dias Seguidos"/"Melhor Sequência" → **"Esta semana: 2/3"** and **"Este mês: 9"** (words stat unchanged).
- `PracticeStreakWidget.jsx` → rename component to `PracticeDaysWidget` (keep widget **id `streak`** in `personalWidgets.js` so users' `hiddenPersonalWidgets` still work), render the chosen design: week vs goal, month, best month, total.
- Admin Pulse (`pulseMetrics.js`, `PeopleGroup.jsx`, `MessagingGroup.jsx`, `PulseSection.jsx`): replace streak distribution/longest with "practice days in last 7" distribution + "best month" leader; active/dormant use `lastPracticeDate ?? lastStreakDate`. Admin panels are English (exempt from i18n).

### 4. Copy (pt-PT base only — `src/locales/pt/translation.json`)
- Replace: `dashboard.day_streak`, `dashboard.highest_streak`, `personal.dash_streak_desc`, `dashboard.today_desc` (line 442 "A tua sequência…"), `notifications.reminder_streak(_desc)`, `email.reminders.streak_rescue_subject/_body`, `email.reminders.weekly_review_body` ("Vais em {{days}} dias seguidos…" → practice days this week).
- New keys for the widget (this week, this month, best month, total, goal) with "practice/praticar" voice, never "learn".
- Privacy policy `section2_2_text` (line 298) lists "sequências de dias" as collected data → reword to "os dias em que usas a app" (same data class, no new processing).
- Keep: landing-page lines about *other apps'* streaks (80, 111, 153) and `seoStrings.js:52` — they describe competitors and now become true.
- Then: admin **force resync** of locales (existing wording changes don't propagate); `emailTemplateService.js` `TEMPLATE_GROUPS`/`TEMPLATE_VARIABLES` updated for renamed keys/placeholders (`days`, `target`).

### 5. API repo (`proxies/multi-lingo-ai-api`)
- `lib/reminders.ts`: template `streak_rescue` → `weekly_goal`. Fires only when: pref on, local weekday is **Thu or Sat** (≤2/week by construction), `daysThisWeek < target`, `target − daysThisWeek ≤ daysLeftInWeek` (still reachable), not practised today (`lastPracticeDate === local.date`, fallback `lastStreakDate`). Keep `REMINDER_ORDER` slot; drop `STREAK_RESCUE_MIN_DAYS`. Pref key `streakRescue` → `weeklyGoal`, normaliser maps a stored `streakRescue: false` to `weeklyGoal: false` (respect existing opt-outs). `practice_nudge` switches to the same "practised today" check.
- `api/email.ts:483-507`: pass `practiceDates`, `lastPracticeDate`, `weeklyTarget` (default 3); variables `days` (this week), `target`.
- `lib/pulse-snapshot.ts:65-85`: `streakActive` → `practiceActive` using `lastPracticeDate ?? lastStreakDate`.
- `npm run sync:email-copy` after the frontend copy lands (generated `lib/email-copy.base.ts`; CI blocks until synced).
- Mirror the pref in frontend `src/config/reminders.js` (`streakRescue` → `weeklyGoal`) — `test/unit/utils.test.js:291` drift check pins this.

### 6. Tests to update/add
- Frontend: new `test/unit/practiceDays.test.js` (week/month/best-month/trim/seed/local-date edge cases incl. week across month boundary); update `test/helpers/appContext.js:60-61` (must stay a superset of the real provider), mocks of `updateDayStreak` in `appContext.test.jsx`, `games.interaction.test.jsx`, `dailyLimitProvider.test.jsx`, `sessionToken.test.jsx`; `pulse.test.jsx`, `personalDashboard.test.jsx`, `emailTemplates.test.js`, `utils.test.js`.
- API: `test/lib/reminders.test.ts` (rewrite streak cases: Thu/Sat only, reachable/unreachable, practised today, opt-out migration), `test/lib/pulse-snapshot.test.ts`, `test/lib/email-copy.test.ts`.

### 7. Marketing follow-through
ML-B01-06 and S05 stay as written (now true). Update `social-content/00-playbook` voice rule ("streak only in the negative" stays). No other content changes.

## Rollout order
1. Design artifact → Nuno picks.
2. API PR first (reads new fields with fallbacks, so it's safe before the frontend ships) → `sync:email-copy` after step 3's copy.
3. Frontend PR (data + UI + copy) → deploy → admin force resync of locales.
4. Nuno pushes both repos himself (never pushed by Claude; mind the Vercel "double user" issue on the API repo).
Target: live before **Tue 27 Oct**.

## Verification
- `npm test`, `npm run lint`, `npm run build` (frontend); `npm test`, `npm run typecheck` (API).
- Browser (dev server, normal account — no admin features tested): open app → today recorded once (reload = no second write), Today panel shows week/month, personal widget renders the chosen design in light + dark, weekly goal edit reflects immediately; seeded total visible for an account with an old streak.
- Reminders: unit tests cover the decision logic; after deploy, `curl -X OPTIONS` every API route (repo CLAUDE.md check) to confirm functions still load.
- Grep both repos for `dayStreak|highestDayStreak|streakRescue|streak_rescue` — only fallback reads and the competitor-describing copy remain.
