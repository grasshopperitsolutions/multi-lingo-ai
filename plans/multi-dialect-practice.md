# Multi-dialect practice

**Status:** Phase 1 built on 2026-09-25, apart from deleting the old exam data. Phase 2's code built on 2026-09-25; its testing and flag steps are still open (see below). Phase 3 queued. Written 2026-09-25.
**Covers:** Exam Training and Grammar Practice, which open to new dialects and languages together.

## Why

Both features write their exercises with AI into shared pools. Grammar Practice was built on a model that separates the language, the dialect and the reader's language. Exam Training was still one pool per dialect. Putting both on the same model means one exercise can be reused across the dialects of a language (adapted, never translated), and the two features can be opened to a new dialect or language with one switch.

## The switch (all phases)

`examSupported` on each language document in `appConfig/config/languages` (Admin › Languages). It is read through `isStructuredPracticeSupported()` in `src/config/structuredPracticeSupport.js`, by both the Exam Training tile and the Grammar Practice section. Turning it on for a dialect opens both features for it. It stays the gate in every phase, so languages are added one at a time, after testing, never all at once. **Admins get through for any dialect** regardless of the flag: that's how a dialect is tested before it opens.

## The shared data model

```
{pool}/{exerciseId}                  one exercise, at language level
  language: "pt"                     base language (query key)
  originDialect: "pt-PT"             where it was first written
  dialects: ["pt-PT"]                dialects that have content (filtered in code)
  portability: "unknown" | "portable" | "dialect-specific"
  type, level, ...                   feature-specific fields
  fingerprint(s)                     for the duplicate check
  status: "ready" | "draft" | "blocked"
  source: "ai", verified: false, qualityScore: null, createdAt, updatedAt

{pool}/{id}/content/{dialect}        the exercise and its answer key, per dialect
  dialect, adaptedFrom: null | "<dialect>"

grammarExercises/{id}/gloss/{dialect}__{lang}   Grammar Practice only
```

- **Queries use equality filters only:** `language`, `level`, `status`, plus type fields. There is no `orderBy`, range or `array-contains`, so no composite index is ever needed. Dialect availability is filtered in code from `dialects`.
- **Writes go children first, root last.** A failed write leaves an orphan nobody can see, never a root pointing at missing content.
- **Missing collections and documents are normal:** an empty result means "nothing yet".
- **Exams have no gloss.** An exam is read entirely in the practised dialect, as a real one would be. The one part in the reader's language, the writing feedback, is generated per attempt and never stored.

## Phase 1: exam prep on the shared model (built 2026-09-25)

- Rewrite `src/services/examExerciseService.js` on the model above: `examExercises/{id}` at language level with `content/{dialect}`, through `firestoreService` rather than raw `fetch`.
- A fingerprint per exercise (the normalised opening of the passage, transcript or writing prompt), compared with the Grammar Practice duplicate check. A new exercise too close to one already in its pool cell is still served, since the learner paid for it, but is not written to the pool. No second AI call is spent.
- **No migration.** Delete the existing `examExercises` documents in Firestore; the pool refills on demand. **Still to do, by hand:** the new code never matches the old documents (they have no `language` field), so they are dead weight until deleted. Old ids in `seenExerciseIds.{reading,listening,writing}` never match anything and are harmless.
- Shared pool helpers (`baseLanguage`, id generation, safe document reads) move into one module used by both services.
- The call sites (Reading, Listening, Writing, Full Exam) keep the same `getExercise` signature, so they don't change.

## Phase 2: open to the Portuguese dialects (code built 2026-09-25)

**Built:**

- **The order of a request** in both services: first an unseen exercise that already has content in the learner's dialect. Then one attempt to adapt an unseen exercise from a sibling dialect. Only then generate a new one. When an adaptation succeeds, `content/{dialect}` is written, the dialect is added to `dialects`, and `portability` becomes `"portable"`. When the model refuses, `portability` becomes `"dialect-specific"` and that exercise is never tried again. Any other failure falls through to generating.
- **Grammar Practice** uses `grammar-practice-adapt-prompt`. The exercise is sent with its explanations merged in (in the learner's language), because explanations quote forms and have to change with them. The result goes through the same validation as a new exercise and must keep the original item ids. It also writes `gloss/{dialect}__{lang}` and registers the topic for the new dialect.
- **Exam Training** uses its own `exam-adapt-prompt`, because a passage adapts differently from a list of grammar items. `src/utils/adaptShape.js` rejects any adaptation that changes the exercise's keys, ids, list lengths, true/false values or numbers, empties a text, or leaves a `correctAnswer` outside its options or word bank.
- **Glosses never cross dialects.** A missing reader-language gloss is translated from another gloss *of the same dialect* only. A sibling dialect's gloss quotes that dialect's forms.
- **Admin preview:** admins can reach both features in any dialect before its flag is on.

**Still open:**

- **Seed `exam-adapt-prompt`** with the temporary button in Admin › Prompts, then remove `src/services/promptSeedService.js` with its button and handler.
- **Edit `grammar-practice-adapt-prompt`** in Admin. Replace the line *"Leave explanations, instructions and labels in the language they are written in."* with: *"Keep explanations, instructions and labels in the language they are written in, but change every example they quote to how it is said in {{targetDialect}}."*
- **Test pt-BR as an admin** (switch your practice language). pt-BR is the dialect furthest from pt-PT. Check the adapted grammar items and exams, the refusals, and the topic list: `grammarTopics` is per dialect, so pt-BR starts with only the keys it gets. Then turn on `examSupported` for pt-BR.
- Then pt-AO and pt-MZ, one at a time.
- **Known gap:** `getGrammarDescription()` uses pt-PT terms ("presente do conjuntivo"), which Brazilian learners call "subjuntivo". The model copes, but Phase 3's fix covers this too.

## Phase 3: open to any language, English first

- **Remove the Portuguese that is hardcoded in code.** `getGrammarDescription()` in `examPromptTemplates.js` describes level grammar in Portuguese terms (presente do indicativo, pretérito perfeito…) and is sent to every exam and tale prompt. For another language it is wrong. Move the level guidance into the prompt documents in language-neutral terms, or have the model derive it from the level. Code must not carry prompt text.
- English (en-US, en-GB) first, then other languages one by one, each behind `examSupported`.
- Check the per-language pieces: the accent bar (`src/utils/accentCharacters.js`) has no entry for many languages, which is fine for English. Also review exam type labels, which are hardcoded English in `ExerciseSidebar`.

## Later, not phased

- **Review the exam exercise types** against the Grammar Practice catalogue. The goal is practice, so reading and listening can borrow types such as judge-and-correct and contrast gaps, and the one-item-at-a-time feedback.
- **Topic labels:** the Grammar Practice picker shows English keys tidied up ("Verbs past imperfect"). A label per topic in the reader's language would fix it.
