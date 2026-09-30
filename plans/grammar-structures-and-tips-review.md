# Grammar Structures and Tips: review, then remove or rework

**Status:** queued. Written 2026-09-29. **Both sections are to be hidden** in the meantime. The code side is done: the grammar hub now honours `hidden`. The switch is yours: Admin › Features, "Hide" on `grammar_structures` and `grammar_tips`. While hidden, admins and VIPs still see them, which is what the review needs.
**Why:** they feel strange next to the rest of the hub, and they're the only grammar sections still pt-PT only. Ask, Practice Text and the drills now work across languages.

## What they are today

**Structures** (`GrammarStructuresPage`, `grammarService.getTopics`, `getTopicContent`):
- A library of grammar topics grouped by family. Each topic shows an explanation, tables, examples and common pitfalls.
- The topic **list** comes from `grammarTopics` for the practice dialect. Only pt-PT has a hand-written list, so every other language gets an empty page.
- Each topic's **explanation** is generated per interface language on first read and cached (`seedTopicContent`, `grammar-topic-seed-prompt`).

**Tips** (`GrammarTipsPage`, `grammarService.getTips`, `generateTip`):
- Tips on pronunciation laws, expressions, proverbs and mnemonics, by category. They were seeded from hand-written pt-PT material, and "ask AI for a new tip" adds more (`grammar-tip-generate-prompt`).
- Tips are matched to the reader by the two-letter prefix of their interface language.
- Tips have their own favourite kind: `GRAMMAR_TIP`, stored as `favGrammarTipIds`.

**Who else depends on them** (check before deleting anything):
- **The drills** (`grammarPracticeService.registerTopic`) write their own topics into the **same** `grammarTopics` collection, with `status: "practice"`. The collection outlives Structures either way.
- **Ask** (`GrammarAskPage`) passes the dialect's topic keys to its prompt so that answers can link into Structures. With Structures hidden, those links lead to a hidden page. For languages without a library, the list is simply empty.
- **Favourites:** `favGrammarTipIds` on user profiles, and `grammar_structures` or `grammar_tips` pinned on the Today rail. The rail already drops hidden features.
- **Routes** `/dashboard/grammar/structures` and `/dashboard/grammar/tips`, and their entries in `GRAMMAR_SECTIONS` and `config/grammarSupport` (`needsLibrary`).

## Step 1 — the review (about an hour, with you)

Walk through both as a learner, in pt-PT and in one other language (Admin sees them there), and write down what actually feels wrong:
- **Place:** is it the content (accuracy, depth, tone)?
- **Shape:** is it a static library in an app where everything else is practice?
- **Duplication:** do they overlap with Ask and the drills?
- **Navigation:** is it a list with nothing to do after reading?

For each section, record in this plan: **keep the idea / merge it / drop it**, and why.

## Step 2, option A — remove both

- Delete the two pages, their routes, their `GRAMMAR_SECTIONS` entries and `needsLibrary` handling, and the page-only parts of `grammarService`: the tips and topic-content functions no other feature uses.
- **Keep `grammarTopics`**, because the drills own it now. Keep `getTopics` too, if Ask keeps its cross-links. Otherwise drop the links, and Ask's topic fetch with them.
- **Retire the `GRAMMAR_TIP` favourite kind** deliberately. Stop reading it, and leave `favGrammarTipIds` on profiles as inert data, or clean it with a one-off admin step. Removing the kind from `FAVOURITE_FIELDS` alone would drop the field from AppContext's hydration, which is fine once nothing reads it.
- Delete the two feature documents in Admin, or leave them hidden.
- Delete `grammarTips` and the pt-PT library content in `grammarTopics` (the rows not marked `practice`) only after a Firestore export.

## Step 2, option B — rework into one "grammar guide" that works in every language

A sketch to judge against the review, not a decision:
- **One section, not two.** A topic page per grammar point, drawn from the topics the **drills already register per dialect**. So every language has topics as soon as anyone practises it, with no hand-written library.
- **Each topic page:**
  - A short explanation, generated once per interface language and cached, as `getTopicContent` already does.
  - Examples in the practice language, tappable for lookup and banking (`TappableParagraph`).
  - Two exits: **"Practise this"**, the drills filtered to the topic, and **"Ask about this"**, Ask pre-filled.
- **Tips** either become a "tip" block on the relevant topic page, or go. Proverbs and expressions may belong in History & Culture or a future vocabulary feature instead.
- **Gate it** with the drills' per-language "tested" switch (`examSupported`, `isStructuredPracticeSupported`), which admins can preview first. Generated grammar in a new language is reviewed the same way drills are.
- **Prompts:** reuse `grammar-topic-seed-prompt`. Only a topic list with no drills behind it would need a new one.

## Questions to settle in step 1

1. Remove, or rework (option B)?
2. If reworked: keep tips, fold them into topics, or drop them?
3. Should Ask keep cross-linking into topics?
4. Keep the pt-PT hand-written topics as the pt-PT content in a reworked guide, or regenerate pt-PT like every other language, for consistency?
