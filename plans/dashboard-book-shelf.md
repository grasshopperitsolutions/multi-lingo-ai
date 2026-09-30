# The dashboard as a shelf of 3D books

**Status:** queued. Written 2026-09-30.
**Why:** the sections were always meant to be books. The tab bar was a step on
the way, and the shelf was built once (August 2026) and parked, not dropped.
Its files are still in the tree. This plan brings it back as the dashboard's
main presentation, **built for a phone first**, with smoothness as the first
requirement rather than a polish pass.

## What we are building, in one paragraph

Under the Today panel, the six sections stand as six books. On a phone they
sit on a turntable you swipe: the book in front turns its cover to you, the
others show their spines. Tap it and it lifts, the cover swings open on its
hinge, and the open book grows to fill the screen: an intro page, then the
feature cards, turned with a swipe. Back, Escape or "Arrumar" closes it, and it
shrinks back into the book, which goes back on the shelf. On a desktop the same
books stand in an arc of spines you can see all at once, lean out under the
pointer, and open into a two-page spread in place.

## What is already there (parked, not dead)

Nothing imports these, so they ship zero bytes today:

| File | What it holds | Keep / change |
|---|---|---|
| `components/books/BookShelf.jsx` | Desktop arc, pull-out + quarter-turn open, hover lean, tooltip | Rework onto the state machine below; keep the arc maths |
| `components/books/Book.jsx` | One book: spine as the hit target, two boards receding | Keep; add a front cover that can swing open |
| `components/books/BookSpread.jsx` | The flat opened book: two-page spread, one page at a time on narrow screens | Keep as the reader's content; rebuild the phone variant |
| `config/dashboardBooks.js` | Skins per section, arc geometry, timings, `shelfAngle` | Keep; add turntable geometry and phone timings |
| `hooks/usePageTurnSound.js` | Web Audio page rustle, no file shipped | Keep |
| `hooks/useDashboardPresentation.js` | Books vs tabs, narrow and reduced-motion media queries | Rewrite as books vs list |
| `components/DashboardTabs.jsx` | The tab bar | Delete once books ship (see Phase 4) |

`users/{uid}.dashboardPresentation` is still hydrated by AppContext and read by
nothing. It becomes the "books / list" choice if we keep one (question 1).

**Three traps this code already paid for. Do not reintroduce them:**

1. The shelf's inner `preserve-3d` wrapper must keep `pointer-events-none`,
   with each book opting back in. The wrapper's own box sits at z = 0, in front
   of every book, and wins every hit test.
2. `<AnimatePresence mode="wait">` deadlocks around these 3D subtrees: the
   exit never reports complete, so the next view never mounts. Use keyed
   elements with entry animations, or explicit sequencing (below).
3. Timers are throttled in hidden tabs. Phase changes are driven by animation
   completion, with a timer only as a backstop.

## Principles

- **Mobile first.** Every decision is made at 360 × 740 first and widened from
  there. The desktop arc is the enhancement, not the base.
- **Smooth before rich.** 60 fps on a mid-range Android phone is the bar. An
  effect that can't hold it on that phone is cut or simplified, not kept for
  desktop only.
- **The theatre is 3D, the content is not.** Cards are never interactive on a
  rotated plane: text blurs, hit-testing drifts, screen readers lose the
  thread. The opened book hands over to ordinary flat DOM (the parked spread
  already does this; keep it).
- **Nothing gets lost.** Every feature stays one tap from the book it is in,
  locked and purchasable tiles still sell, and the list is always there as the
  fallback.

## The experience, by screen

Breakpoints are set by **width and height together**, because a phone on its
side is wide but very short.

### Phone, portrait (up to 639 px wide): the turntable

- **Shelf.** The six books stand on a shallow turntable arc. The one in the
  middle faces you with its **cover** (icon, section name, "4 funcionalidades"
  line). The others show their **spines** and recede. Scene height about 280 px.
- **As a book comes to the middle it turns to face you**, continuously with
  your finger. Rotation, depth and scale of every book come from one number,
  the turntable's position, so dragging is one motion value and no React
  renders.
- **Swipe to turn the table**: it follows the finger, carries momentum, and
  snaps to the nearest book with a spring. A tap on a side book brings it to
  the middle; a tap on the middle book opens it.
- **Under the shelf:** the section's one-line description, and dots showing
  where you are among the six.
- **Opening** (about 900 ms in all, see "Choreography"): the book lifts toward
  you, the cover swings open on the spine, the first page shows, and the open
  book grows to fill the screen.
- **Reading.** A full-screen sheet (`100dvh`, safe-area insets respected):
  - page 1 is the intro (icon, name, description, how many features);
  - page 2 onward are the cards, two columns, as many rows as fit the height.
    Six sections hold at most four features today, so that is one page of
    cards. More spill onto page 3.
  - Swipe left or right to turn a page. The page follows the finger and
    folds on the spine with a moving shadow. Arrows and page dots sit at the
    bottom for anyone who doesn't swipe.
- **Closing.** "Arrumar" at the top, Escape, the phone's back gesture, or a
  swipe down on page 1. The sheet shrinks back into the book, the cover closes,
  and the book settles back on the turntable, still in the middle.

### Phone, landscape (height under 500 px)

- Shelf scene height drops to about 190 px; books scale down to match.
- The reader shows a **two-page spread**, intro on the left and cards on the
  right, with the cards' minimum height lowered so two rows fit.
- The Today panel stays above. The shelf needs one scroll to reach on the
  shortest phones, and that is acceptable.

### Tablet (640 to 1023 px)

- Portrait: the turntable, with bigger books (spine 60 px, height 260 px).
- The reader is a centred open book, not full screen: single page in
  portrait, two-page spread from 900 px wide.

### Desktop (1024 px and up): the arc

- All six spines visible at once in the arc the parked shelf already draws.
  Six books at 13° steps span about 560 px, inside the dashboard column.
- **Hover** (only with `(hover: hover) and (pointer: fine)`): the book leans
  out, lifts, and turns enough to show the edge of its cover. The section name
  shows as a tooltip, drawn outside the 3D subtree.
- **Opening:** pulled out of the row, a quarter turn to bring the cover
  round, the cover swings open, and the book becomes the two-page spread,
  **in place** in the dashboard column rather than as an overlay.
- **Keyboard:** ← → move along the shelf, Home and End jump, Enter opens,
  Escape closes.

## Choreography, with timings

All timings live in `config/dashboardBooks.js`, as now: the felt weight of the
book is almost entirely these numbers. Phone values:

| Step | What moves | Duration | Easing |
|---|---|---|---|
| Press | The book dips 2% and darkens a touch | 90 ms | ease-out |
| Lift | Book comes 60 px toward you and up 12 px; neighbours fall back and fade | 280 ms | `[0.22, 1, 0.36, 1]` |
| Cover swing | Front cover rotates 0 → -165° on the spine hinge; first page shading follows | 380 ms, starts at 180 ms | same |
| Expand | The open book grows from its own rectangle to the sheet's (a FLIP) | 320 ms, starts at 480 ms | spring, no overshoot |
| Reveal | Page content fades up 8 px | 160 ms, starts at 700 ms | ease-out |

Close is the same run backwards, about 30% faster: people want out quicker
than they want in.

**Interruptions** reverse from wherever the book is. Close during an opening
animates home from the current values; there is never a stored "from" to
snap back to.

**Feedback within 100 ms of the tap**, always. The press state is plain CSS on
`:active` plus the pointer-down handler, so it doesn't wait on anything.

## Smoothness: how, specifically

- **Animate `transform` and `opacity` only.** Never width, height, top, left,
  box-shadow or filter while anything moves. The expand step is a FLIP: the
  sheet is laid out at its final size once, then scaled from the book's
  rectangle, measured once at the start.
- **Motion values, not state, for anything continuous.** The turntable
  position, drag offsets and page turns are framer-motion `useMotionValue` +
  `useTransform`. React re-renders only when something settles (a new middle
  book, a new page, a phase change).
- **Layers on demand.** `will-change: transform` goes on the moving book, its
  cover and the sheet when a gesture or flight starts, and comes off when it
  ends. Six books permanently promoted would cost a phone memory it doesn't
  have.
- **Nothing mounts mid-flight.** The reader's pages (including the card grid,
  whose cards carry their own hover animations) are mounted hidden when the
  press begins, so their first render cost lands before the book moves, not
  during it.
- **No layout reads during motion.** `getBoundingClientRect` once at the start
  of an open or close, never per frame. The desktop tooltip measures on hover
  start, not on every move.
- **Small 3D trees.** Each book is a button, a spine, two boards and a cover:
  five elements. No nested `preserve-3d` below what the book needs, and no
  `overflow: hidden` on any element inside a 3D context (Safari flattens it).
  Faces carry `backface-visibility: hidden`.
- **Flat at rest.** When the book is open and still, its transform resolves to
  identity so text renders crisp. The 3D only exists while something moves.
- **Springs for gestures, tweens for choreography.** Swipe release uses a
  velocity-aware spring (stiffness about 260, damping about 30, no visible
  overshoot); the open and close use the timed steps above so they read as one
  gesture every time.
- **One animation engine per property.** Never a CSS transition and a
  framer-motion animation on the same transform; they fight, and the loser
  shows up as a stutter.

**Budgets we measure against** (Chrome DevTools, 4× CPU throttling, and on a
real mid-range Android and an iPhone):

- 60 fps target during drag, open and close; no more than 2 consecutive dropped
  frames anywhere;
- no task over 50 ms from tap to fully open;
- first visual response to a tap under 100 ms; INP under 200 ms on the
  dashboard;
- no layout or paint in the flame chart during a flight, only composite.

## How it is built

- **One state machine**, `useBookShelf` (a reducer), replacing the ad-hoc
  phases: `shelf → lifting → opening → expanding → open → closing → shelf`.
  - Each step advances when its animation's promise resolves (framer's
    `animate()` returns one), with a backstop timeout for hidden tabs.
  - Every transition is a pure function, so it is unit-tested without a
    browser.
- **Two layouts, one book.** `TurntableShelf` (phone and tablet) and
  `ArcShelf` (desktop) both render the same `Book` and hand the same
  `BookReader` the opened section. The choice is a media query on width and
  pointer, not on user agent.
- **The URL knows which book is open.** Opening pushes `?book=have_fun`;
  Back closes it, which is what the phone's back gesture does and what people
  expect. A shared or reloaded link opens that book directly with a short fade,
  no flight.
- **Section data is unchanged.** Books read the groups from
  `config/dashboardGroups.js` and the tiles from `useDashboardFeatures`, exactly
  as the sections list does now. A book with no visible tiles is left off the
  shelf, as an empty section is today.
- **Each book says what is inside.** "4 funcionalidades" on the cover, and a
  small padlock count when some are locked for the reader's plan. A closed book
  hides its tiles, and those tiles are the upsell. The parked tab bar's
  `lockedCount` did the same job.
- **The list stays**, as the fallback for reduced motion (below), for any error
  (an error boundary around the shelf renders the list instead), and possibly
  as a choice (question 1).

## Accessibility

- **The shelf is a list of buttons**, one per book, named by the section.
  Roving tab index; arrow keys move; Enter or Space opens. On the turntable,
  the middle book's name is announced politely as it changes.
- **The reader is a dialog on phones** (`aria-modal`, focus kept inside,
  Escape closes, focus returns to the book it came from) and a labelled region
  on desktop. A page turn announces "Página 2 de 3".
- **Targets** are at least 44 px on touch: spines narrower than that are
  padded out invisibly, as the hit area.
- **`prefers-reduced-motion`**: the books still stand and still open, but
  nothing flies. The book cross-fades into the reader in 150 ms, the turntable
  snaps without momentum, and pages swap without the fold. The sound stays off.
- **Screen reader users** get a "ver como lista" link at the top of the shelf,
  since a turntable says little to them that a list doesn't say better.

## Sound

`usePageTurnSound` stays: a quiet rustle on open, close and page turn,
synthesised, zero bytes. Autoplay rules are met because every sound follows a
tap. Whether it is on by default is question 4.

## Rollout

- **Behind a switch first.** A feature document `dashboard_books`, marked
  `hidden` in Admin › Features, so VIP and admin see the books and everyone else
  keeps the sections list. That is the existing launch switch, no new
  mechanism. Unhide it when the phone budget holds on real devices.
- **Pulse:** count book opens per section (a counter per group id, through the
  existing `open` report), so we learn which books get opened and which only
  get looked at.

## Phases

**Phase 0: groundwork (about half a day)**
- The switch, the list fallback and the error boundary.
- `useBookShelf` with its tests, and URL sync with Back.
- A performance baseline of today's dashboard at 4× throttling, to compare
  against.

**Phase 1: phone first (about 2 to 3 days)**
- The turntable: drag, momentum, snap, tap to centre, cover turning to face you.
- The phone choreography (lift, swing, expand) and its reverse.
- The full-screen reader: swipe pages, arrows, dots, close by Back, Escape,
  "Arrumar" or swipe down.
- Reduced motion and accessibility for all of it.
- Verified at 360, 390 and 412 px portrait, and phone landscape.

**Phase 2: tablet and desktop (about 1 to 2 days)**
- The arc on the state machine, hover lean with fine pointers only, keyboard
  navigation.
- The in-place two-page spread; tablet rules for both orientations.

**Phase 3: polish (about 1 day)**
- The page fold's moving shadow and the paper tone of the pages, in both themes.
- The cover's padlock count, and sound defaults.
- A tuning pass on real devices against the budgets above.

**Phase 4: ship and clean up**
- Unhide `dashboard_books`.
- Delete `DashboardTabs.jsx` and the `?tab=` handling, since books replace
  tabs.
- CLAUDE.md gets a section on the shelf, the traps, and the budgets.

## Verification

- **Unit:** turntable and arc geometry (angle, depth and scale for any
  position), `useBookShelf` transitions including interruptions, pages-per-book
  from a height, URL ↔ open-book sync.
- **Component:** open and close by every route (tap, Enter, Escape, Back,
  "Arrumar"), focus returns to the book, the list fallback on reduced motion
  and on error, locked counts on covers.
- **In the browser**, at 360 × 740, 390 × 844, 412 × 915, 740 × 360 (landscape),
  768 × 1024, 1024 × 768 and 1440 × 900, in both themes: screenshots of the
  shelf, mid-open and open.
- **Performance traces** at 4× CPU throttling for drag, open and close, with
  the budgets above. Then **real devices**, which the in-app browser cannot
  stand in for: an iPhone on Safari (its 3D quirks are the likeliest surprise)
  and a mid-range Android on Chrome.

## Risks

- **Safari's 3D.** Flattening from `overflow` or `filter` on a 3D ancestor,
  and imprecise hit-testing on rotated elements. Mitigated by the rules above
  and by testing on an iPhone early in Phase 1, not at the end.
- **Low-end Android.** If the budgets can't be held there, the turntable keeps
  its drag but drops the depth effect (scale and fade only) below a measured
  device class, rather than stuttering.
- **The cards' own animations.** The wiggle-hover on feature cards costs
  nothing on a flat page, but must not run while the reader is expanding; the
  reader only enables it once open.
- **Discoverability.** A closed book hides what is inside. The cover's feature
  count, the padlock count and the description under the turntable are there
  for this; Pulse's book-open counts will say whether they are enough.

## Questions to settle before building

1. **Books for everyone, or a choice?** Recommended: books by default, with
   "Livros / Lista" in Settings (the stored field already exists), and the list
   also used for reduced motion.
2. **Rollout:** VIP and admin first behind `dashboard_books`, as above?
3. **On phones, full-screen reader or in place?** Recommended: full screen,
   so the cards get the whole height and Back closes it naturally.
4. **Sound on by default?** It is quiet and follows taps only. Recommended:
   on, with a small speaker toggle on the shelf remembered on the device.
