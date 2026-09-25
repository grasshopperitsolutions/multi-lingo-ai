# Multi-dialect practice

**Status:** Phase 1 done on 2026-09-25. Phase 2's code built and set up on 2026-09-25; testing pt-BR and turning on its flag are still open (see below). Phase 3's code built on 2026-09-25; its prompt edits, testing and flags are still open. Written 2026-09-25.
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

## Phase 1: exam prep on the shared model (done 2026-09-25)

- Rewrite `src/services/examExerciseService.js` on the model above: `examExercises/{id}` at language level with `content/{dialect}`, through `firestoreService` rather than raw `fetch`.
- A fingerprint per exercise (the normalised opening of the passage, transcript or writing prompt), compared with the Grammar Practice duplicate check. A new exercise too close to one already in its pool cell is still served, since the learner paid for it, but is not written to the pool. No second AI call is spent.
- **No migration.** The old `examExercises` documents were deleted on 2026-09-25 and the pool refills on demand. Old ids in `seenExerciseIds.{reading,listening,writing}` never match anything and are harmless.
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

- Done on 2026-09-25: `exam-adapt-prompt` seeded (the seeder has been removed), and `grammar-practice-adapt-prompt` edited so that explanations update the forms they quote.
- **Test pt-BR as an admin** (switch your practice language). pt-BR is the dialect furthest from pt-PT. Check the adapted grammar items and exams, the refusals, and the topic list: `grammarTopics` is per dialect, so pt-BR starts with only the keys it gets. Then turn on `examSupported` for pt-BR.
- Then pt-AO and pt-MZ, one at a time.
- **Known gap:** `getGrammarDescription()` uses pt-PT terms ("presente do conjuntivo"), which Brazilian learners call "subjuntivo". The model copes, but Phase 3's fix covers this too.

## Phase 3: open to any language, English first (code built 2026-09-25)

**Built:**

- **No prompt text in `examPromptTemplates.js` any more.** Gone:
  - `getGrammarDescription()`: level grammar in Portuguese terms, sent to six prompts.
  - `getExamPhrasing()`: ready-made Portuguese exam instructions, sent to every reading exercise.
  - The English label maps with Portuguese glosses ("phone message/recado", "short story/relato").
  - The listening field list and `topicLine`.

  The code now sends only values: level, dialect, counts, word bounds, durations and raw type keys.
- **Tale Creator, Practice Text and pronunciation** no longer send `grammarDescription` either.
- **Exam type labels in `ExerciseSidebar`** now come from `exam.types.*` in the locale files instead of hardcoded English.
- **The Admin › Prompts search** now searches template text, so words like "Portug" can be found across every prompt and variant.

**Prompt edits (by hand, in Admin › Prompts).** `renderTemplate` leaves any placeholder it isn't given in the text, so **make these edits at the same time as deploying the code**: an old placeholder would reach the model as literal text. Keep any tuning of your own; only these lines change.

The level line used below:
> Use only the grammar, tenses and vocabulary a learner of {{targetLang}} at CEFR {{level}} is expected to know.

1. **`exam-reading-prompt`** (every variant):
   - Anything naming Portuguese ("a Portuguese language examiner", "European Portuguese (pt-PT)") becomes neutral: "a language examiner", "{{targetLang}}".
   - The `{{grammarDescription}}` line becomes the level line.
   - Delete the `{{topicLine}}` line.
   - `Official phrasing: "{{examPhrasing}}"` becomes: *Write the instruction line in {{targetLang}}, worded the way an official {{targetLang}} language exam words this task at level {{level}}.*
   - `"instructions": ["{{examPhrasing}}"]` becomes `"instructions": ["<the instruction line, in {{targetLang}}>"]`.
   - **true-false variant:** delete the `"questions"` array with "Verdadeiro"/"Falso" (the code reads `statements` only), and change "true (V) and false (F)" to "true or false".
2. **`exam-listening-prompt`**:
   - `{{audioFormatLabel}}` becomes `{{audioFormat}} (dialogue, monologue, phone-message, announcement or interview)`.
   - `{{listeningTypeLabel}}` becomes `{{questionType}}`.
   - `"tone": "{{toneDescription}}"` becomes `"tone": "<a few words on how the voice should deliver it>"`.
   - Replace the `{{listeningFieldList}}` line with:
     ```
     Depending on the exercise type, also return:
       - multiple-choice: "questions": array of { id, text, options[], correctAnswer }, with correctAnswer copied exactly from options
       - true-false: "statements": array of { id, text, isTrue }
       - fill-blanks: "passage": the transcript with the key words replaced by ___ (three underscores); "wordBank": array of words in {{targetLang}} (the correct answers plus plausible distractors); "blanks": array of { id, position, correctAnswer }
     ```
3. **`exam-writing-prompt`**:
   - The Portuguese examiner line, and both "European Portuguese (pt-PT)" lines, become neutral with `{{targetLang}}`.
   - The `{{grammarDescription}}` line becomes the level line.
   - `{{textTypeLabel}}` becomes `{{textType}} (email, message, story, article, opinion, letter or essay)`.
   - Delete the `{{topicLine}}` line.
4. **`exam-oral-prompt`** (no caller yet, so optional): the same examiner and level-line edits; `{{oralTypeLabel}}` becomes `{{oralType}}`.
5. **`story-generate-prompt`**, **`grammar-text-generate-prompt`** and **`pronunciation-passage-prompt`**: the `{{grammarDescription}}` line becomes the level line. In the story prompt the whole "Language constraints for {{level}}:" block becomes: *Language constraints: use only the grammar, tenses and vocabulary a learner of {{targetLang}} at CEFR {{level}} is expected to know.*
6. **Then search Admin › Prompts** for "Portug", "pt-PT", "europeu", "Verdadeiro" and "Falso", and neutralise anything left in any other prompt.

**Still open after the edits:**

- **Test English as an admin**: switch your practice language to en-US, then en-GB. Try every exam type, grammar practice, and adaptation between en-US and en-GB. Then turn on `examSupported` for each, one at a time.
- Then other languages, one at a time, each behind `examSupported`. The accent bar (`src/utils/accentCharacters.js`) has entries for pt, es, fr, it, de, ca, ro, pl, nl, sv and tr; other languages simply show none.
- **Allowed, and not a problem:** values that fill a variable, such as the Tale Creator's theme descriptions (`config/storyThemes.js`), may be English phrases. Prompts are always written in English, and the model writes content in the requested language. What gets translated is the labels a learner sees, in their interface language or their practice language.

## Later, not phased

- **Review the exam exercise types** against the Grammar Practice catalogue. The goal is practice, so reading and listening can borrow types such as judge-and-correct and contrast gaps, and the one-item-at-a-time feedback.
- **Topic labels:** the Grammar Practice picker shows English keys tidied up ("Verbs past imperfect"). A label per topic in the reader's language would fix it.
