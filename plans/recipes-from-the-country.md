# Food of the country you practise: a hub for recipes and places to eat

**Status:** queued, not started. Written 2026-09-28 and revised twice the same day with the user's answers.
**Where:** the existing **`food`** tile and route **`/dashboard/food`**, which today open a coming-soon stub (`pages/dashboard/coming-soon/FoodPage`). **The key and route stay.** They're gate keys, and renaming either would drop the feature from tier grants and orphan everyone's favourites.
**Model to copy:** History & Culture (`historyCultureService.js`, `HistoryCulturePage.jsx`) for the pool, the language and translation. The grammar hub (`/dashboard/grammar`, `GRAMMAR_SECTIONS`) and the professional tools (one key, `ProToolShell`) for the hub.

## What it is

`/dashboard/food` becomes a hub with three sections, all about **the country of the practice dialect**. `pt-PT` is Portugal, `pt-BR` Brazil, `pt-AO` Angola. **The dialect decides the country**, exactly as in History & Culture.

| Section | Route | Phase |
|---|---|---|
| **Country recipes**: a shared pool of the country's dishes. Browse and search it, or press **"Get me a recipe"** for a random one. Read, save, download or share | `/dashboard/food/recipes` | 1 |
| **Create a recipe**: pick ingredients and cooking techniques typical of the country, and get a recipe to download or share. **Nothing is stored** | `/dashboard/food/create` | 2 |
| **Where to eat**: restaurants in the country, through Google Maps | `/dashboard/food/restaurants` | 3, **optional** |

All three share the one feature key, `food`, as the professional tools share `professional_tools`. That gives Admin one row, and the hub carries the gate. The hub shows only the sections that are built.

**Language, as in History & Culture:** everything is **written in the reader's interface language**. The practice-language version is revealed per section on request, and translated the first time anyone asks for it, then stored for everyone.

## The sidebar: ingredients in and out

It appears on both recipe sections. It sits on the left on desktop and becomes a strip below the content on a phone, like `ExerciseSidebar`. Its three blocks all run on one mechanism: **each recipe records which ingredients it contains**, so the app can filter recipes by ingredients, in or out.

1. **Leave out.** What the reader doesn't want in a recipe.
   - **Quick picks**, each expanding to ingredient groups: vegetarian (no meat, fish or shellfish), vegan (also no dairy, eggs or honey), and single groups (no pork, gluten, dairy, eggs, nuts, shellfish, alcohol).
   - **Free text, like "Other" in interests**, for anything specific ("coentros", "cogumelos"). Each item becomes a removable chip.
2. **Favourite foods.** Ingredients or groups to prefer. The same quick picks and free text, used to rank and choose recipes rather than exclude them.
3. **Saved recipes.** The hearted pooled recipes, newest first.

**Stored in the browser only (`localStorage`), never on the profile.** The reasons are under "Why the leave-out list isn't stored like interests" below.
- Every read and write goes through `try/catch`, and the page works without storage.
- The lists go with a generation request as **values**.
- Saved recipes are the exception: they're ordinary content ids and live on the profile.

**Allergies:** the section is called "Leave out", never "safe for". A notice stays on every recipe, pooled or created: *check every ingredient yourself; recipes are AI-written and may be wrong.* The app never claims a recipe is free of an allergen.

### How "in or out" is stored (easy, and on the recipe itself)

A recipe's language-free data lives on its root document:

- `ingredientKeys[]`: every ingredient as a normalised **English** key (`cod`, `onion`, `chourico`). It's lowercased, trimmed, singular and accent-free, **normalised in code**, not by the prompt.
- `ingredientGroups[]`: the union of bounded groups the ingredients belong to (`meat`, `pork`, `poultry`, `fish`, `shellfish`, `dairy`, `egg`, `gluten`, `nuts`, `alcohol`, `honey`). The schema lets the model tag each ingredient with them.
- **A small map in code backs up the model** for the obvious cases (`bacon`, `ham`, `chourico` imply `pork`). A missed tag is the likeliest failure, and this catches the common ones. It still doesn't make a recipe allergy-safe; the notice stays.

Filtering happens in code:
- **"Leave out"** excludes any recipe whose keys or groups intersect the list.
- **"Favourite foods"** ranks recipes by overlap.
- Firestore allows only one `array-contains` per query, and CLAUDE.md says to filter in code anyway.

**Free-text items get an English key once**, when they're added. One small AI call turns "coentros" into `coriander`, and the chip keeps both. Quick picks need no call, because their keys are fixed. If that call fails, the chip still filters by matching the typed word against the ingredient names in the reader's language.

## Section 1 — Country recipes (Phase 1)

- **"Get me a recipe"**, the main button: a random pooled recipe for the country.
  - It respects the sidebar (nothing on the leave-out list; favourite foods weigh the draw) and prefers recipes the reader hasn't seen.
  - **It generates a new one only when nothing in the pool fits.** A random draw from the pool costs nothing.
- **The list.** Pooled recipes for the country, as cards: name, meal type, time, difficulty.
  - The `SearchBar` search (title, local name and ingredient names) and its filter groups (meal type, difficulty, time) run on the pool already in memory.
  - The sidebar's lists apply on top.
- **The reader:**
  - Name (with the local name under it), intro (where the dish comes from, when it's eaten), servings and times, ingredients, and steps.
  - The practice-language reveal per section, read aloud, and a heart.
  - **Download or share as PDF** (see "Download and share", below), and the practice-language badge (`showPracticeLanguage`).
- **Asking for something specific** ("a Christmas dessert", "bacalhau à brás") goes **through the existing-recipe check first** (below), and only generates when nothing matches. Generating goes through `CustomRequestInput`, gated by `canAccess("custom_requests") || cacheExhausted`, as in History & Culture.

### The recipe

Its shape is enforced by `responseSchema`, as `historyCultureService` enforces a culture piece's. None of it is written into the prompt text.

- **Root document `recipes/{id}`** (language-free):
  - `targetLang` (the dialect, and the pool key).
  - **`localName`**: the dish's name as it's known in the country, in the practice language, whatever the interface language (e.g. "Bacalhau à Brás"). Always asked for, because it's the only name that's the same for every reader.
  - **`dishKey`**: `localName` normalised in code (see below).
  - `title` (denormalised, in `sourceLocale`) and `sourceLocale`.
  - `mealType` (starter, main, dessert, snack, drink, breakfast), `difficulty`, `servings`, `prepMinutes`, `cookMinutes`.
  - `ingredientKeys[]`, `ingredientGroups[]`.
  - **`mainIngredientKeys[]`**: the ingredients that make the dish. The schema asks for each ingredient's `role` (`main`, `supporting` or `seasoning`), and a stoplist in code drops staples the model marks `main` anyway (salt, water, oil, olive oil, onion, garlic, sugar, flour, pepper).
  - **`techniqueKeys[]`**: how it's cooked, drawn from **the country's technique list** (below). The recipe prompt receives that list's keys as values, and the schema limits the field to them plus `other`. Two recipes that stew are then both `stew`, never `stew` and `braised`.
  - `status`, `source`, `createdAt`/`updatedAt`. `createdBy` is stamped by the proxy.
- **`recipes/{id}/content/{locale}`:**
  - `title`, `intro`, `ingredients[]` (`{ quantity, unit, item }`; **metric, quantities as numbers**), `steps[]`.
  - Translations keep the same number of ingredients and steps, as stories keep paragraphs aligned.

### Checking whether a recipe already exists (the safety net)

**One check isn't enough, because the same dish arrives under different names.** One reader generates "Cod à Brás" in English, another "Bacalao a la Brás" in Spanish, and a third asks for "bacalhau a bras". The word pool is the warning here: seven `passport` concepts in thirteen seconds, while "passport" was in the prompt's avoid list. So there are five layers, each catching what the last missed:

1. **Match the request before any AI call.** A specific request is normalised and matched against the pool already in memory: its `localName`, the titles, and the reader's-language content titles when loaded. On a match, the existing recipe is served and nothing is spent.
2. **Hint the prompt.** `{{avoidDishes}}` carries the pool's `localName`s. It's only a hint: it helps, but guarantees nothing.
3. **The document id is the dish, so an exact duplicate can't be written.** A recipe is written at **`recipes/{targetLang}__{dishKey}`**, never at a random id.
   - `dishKey` is `localName` normalised in code:
     - lowercase;
     - accents removed (NFD);
     - text in brackets dropped ("(tradicional)");
     - punctuation turned into single hyphens, and trimmed.
   - "Bacalhau à Brás" and "Bacalhau a Bras (receita tradicional)" both become `bacalhau-a-bras`.
4. **A near-match check, after generating and before writing, using two independent signals.** Either one marks the new recipe as a dish the pool already has:
   - **By name:** the words in the new `dishKey` overlap an existing key above a threshold (for example `caldo-verde` against `sopa-caldo-verde`).
   - **By content, meaning ingredients and technique:** the same `mealType`, **and** the main ingredients overlap strongly, **and** at least one technique is shared.
     - Overlap is the share of main ingredients the two have in common: the shared ones divided by all of them together.
     - Seasonings and staples are left out on purpose. Every Portuguese savoury dish has onion, garlic and olive oil, so counting them would call half the pool the same dish.
     - This catches the case the name can't: the same dish written under another name. It's only possible because both lists share one vocabulary: English keys, and technique keys from the country's list.
   - **Why content alone isn't enough:** a regional variant can differ by one ingredient and still be the same dish, while two different dishes can share most ingredients (*arroz de pato* and *arroz de marisco* share rice and chouriço, but not duck or shellfish). So the content check needs the meal type, a high threshold and a shared technique before it calls two recipes the same.
   - **Both thresholds are constants in one module**, tuned against a fixture set of real pairs: duplicates that must match, and near-neighbours that mustn't (the two *arroz* dishes, *bacalhau à Brás* against *bacalhau com natas*).
   - **A match reuses the existing recipe**, as layer 5 does. The pair is also logged, so wrong matches can be spotted and the thresholds adjusted.
5. **Write-if-absent.** Immediately before writing, read `recipes/{targetLang}__{dishKey}`. If it exists, **serve the existing recipe**, translating it into the reader's locale if that content is missing, and discard the new one.
   - This mirrors `_adoptOrCreateConcept` in the word pool. It means **a paid generation can be thrown away**, but that's cheaper than a duplicate that lives in the pool for ever.
   - If two readers generate the same dish in the same second, they write the same document id. The later write replaces the earlier one, **and there's still one recipe, not two.**

- **None of these checks ever throws.** A failed lookup is logged and the flow continues, as the word pool's lookup does: a rare duplicate is a smaller problem than a reader getting nothing.
- **Tests cover each layer**, with real near-misses: accents, brackets, word order, "Sopa de …".

### The pool (the History & Culture contract)

- **Cache-first:** read what exists, generate only what's missing, write it back.
- **`getRecipePoolStatus` counts without the filters**, as `getStoryPoolStatus` ignores the tale's theme. "Exhausted" unlocks custom requests for free tiers, so counting per filter would let anyone unlock them with the rarest filter.
- **API: one policy row.** `recipes: { read: 'authenticated', write: 'authenticated' }` in `lib/collection-policies.ts`, matching `historyFacts`. That's the only API change, and it isn't a new endpoint. Writing with an explicit id is a POST with that id, which the proxy already supports.

### Favourites and progress

- **A new favourite kind, `RECIPE`, stored as `favRecipeIds`.** It's one entry in `FAVOURITE_FIELDS`. Hydration follows through `ALL_FAVOURITE_FIELDS`, and the heart is `FavouriteButton`.
- **Recipes already seen are recorded in `seenRecipeIds` on the profile**, exactly as the rest of the app's content already is. Tales use `seenStoryIds`, culture pieces `seenHistoryFactsIds`, words `seenConceptIds`, and reading passages, exam exercises and both word puzzles have their own.
  - **`markRecipeSeen(token, uid, recipeId, currentSeenIds)`** and **`resetSeenRecipes(token, uid)`** in `userService`, copying `markHistoryFactSeen` and `resetSeenHistoryFacts`. It's append-only, deduplicated, and removed only by the reset. There's deliberately no "un-see one", per CLAUDE.md's seen-versus-favourites rules.
  - **Marked when a recipe is opened in the reader**, whether it came from "Get me a recipe", the list, a search, a saved recipe or a request. Being listed on a card doesn't count as seeing it.
  - **Used by:**
    - "Get me a recipe" draws unseen recipes first. When every matching recipe has been seen, it generates a new one, which is the History & Culture contract. That also counts towards the "pool exhausted" state that unlocks custom requests.
    - The list can show a small "seen" mark on cards.
    - Pulse can count recipes read.
  - **Add `seenRecipeIds` to AppContext's load allow-list**, next to `seenHistoryFactsIds`. Left off, it would be saved and then silently dropped on the next load, which is exactly how the others once went missing.
  - **The reset** sits with the list's other controls ("show me everything again"), as for tales.
  - **Created recipes (Section 2) have no id and aren't stored**, so there's nothing to mark.

### Prompts (Admin-editable, English, values only)

- **`recipe-generate-prompt`**, with the variables `{{language}}` and `{{region}}` (from the dialect, as TTS names them), `{{locale}}`, `{{mealType}}`, `{{leaveOut}}`, `{{prefer}}`, `{{request}}` and `{{avoidDishes}}`. Each carries a value, or `none`.
- **`recipe-translate-prompt`**, following `history-culture-translate-prompt`.
- **`recipe-ingredient-key-prompt`**, which turns a typed ingredient into its English key. It's tiny, a lookup.
- **`country-food-list-prompt`**, for the country's ingredients and techniques (see its section).
- The recipe prompt also takes **`{{techniqueKeys}}`**, the country list's technique keys, and the schema limits `techniqueKeys` to them.
- Placeholder guards warn when a template drops a variable being passed.
- **Seeded once through a TEMPORARY `promptSeedService`**, then removed.

## Download and share (tales and culture too)

A PDF can already be **downloaded** from tales and culture pieces (`DownloadPdfButton`, `utils/readingPdf`). This adds **sharing** to that same button, for tales, culture pieces and recipes alike:

- **Share** hands the PDF file to the device's share sheet (`navigator.share({ files })`), to WhatsApp, email, AirDrop or anything else installed. It's offered only where `navigator.canShare({ files })` says the browser supports it, which is most phones. **Download** stays everywhere else, unchanged.
- **Nothing is uploaded, and no link is created.** The PDF is built in the browser, as it already is, and handed to the share sheet. No server, no storage, nothing public, so there's no privacy-policy change.
- **Recipes need `readingPdf` to set an ingredients list and numbered steps.** Today it takes `{title, paragraphs}`. The WinAnsi font limit applies as it does now: Latin scripts only, and the button explains when a script can't be printed.
- **This is its own small change, and goes first.** It helps tales and culture pieces immediately, and the recipe section then reuses it.

## The country's ingredients and techniques (built when a language is added)

**What it is.** A list per dialect of about 40 typical ingredients and about 12 typical cooking techniques. For `pt-PT`:
- **Ingredients:** bacalhau, chouriço, azeite, coentros, grão-de-bico, pimentão, amêijoas.
- **Techniques:** refogado, estufado, assado no forno, grelhado na brasa, cataplana.

It's generated **once per dialect** and shared by everyone. Three things use it:
- **Section 2**, where the reader picks from it.
- **Every recipe's `techniqueKeys`**, which draw on its vocabulary so the duplicate check can compare them.
- **The sidebar's favourite foods**, which can suggest from it.

That's why it's built in Phase 1, even though Create comes in Phase 2.

**Storage.** A fixed document id per dialect, so there can only ever be one:
```
countryFoodLists/{targetLang}
  ingredients[]  { key (English), localName (in the practice language), groups[] }
  techniques[]   { key (English), localName }
  status, source, createdAt/updatedAt

countryFoodLists/{targetLang}/content/{locale}
  labels and one-line explanations per key, in that interface language
```
The local names are the practice-language words, which is what makes the list worth reading. The reader's-language labels are translated the first time each interface language needs them, as recipes are. It needs one more policy row in the API, like `recipes`.

**When it's generated:**
- **When a practice language is added.** `seedLanguage` gains an option saying the language is being added as a practice language. It's set only by the practice-language pickers, in Settings and Onboarding, and not by the interface-language picker or the tutor profile's "languages I speak". Those languages may never be practised, and a list for them would be a wasted call.
  - After the language document is written, `seedLanguage` starts the list's generation **without waiting for it**. Adding a language never gets slower, and **a failed list never fails the language**: it's logged and left to the fallback.
- **The fallback, for every language added before this, and for any list that failed.** The first recipe request for a dialect with no list generates it first, then continues.
  - The fixed id means two readers arriving at once write the same document, never two.
  - Existing languages get their list on first use, so there's no batch job and no TEMPORARY seeder. One can be added if you'd rather warm all ~25 at once.

**What it costs, honestly.** It's **one AI call per dialect, ever**, whether made when the language is added or on first use. Generating it at seeding doesn't reduce that number. What it buys:
- The first reader of a new language never waits for the list.
- Tutor-profile and interface-only languages never trigger it.

Two alternatives:
- **Folding it into the seeding call** would save that one call. But it makes adding a language slower and riskier, and it changes `language-metadata-seed-prompt`. Not recommended.
- **Billing:** the call counts against the daily allowance of whoever triggers it, as every AI call does. That's the person adding the language, or the first reader of that country's recipes.

**Prompt:** `country-food-list-prompt` (Admin-editable, English, values only), with the variables `{{language}}`, `{{region}}` and `{{locale}}`.

## Section 2 — Create a recipe (Phase 2)

It uses **the country's list of ingredients and techniques** (below), built in Phase 1.

1. **The reader sees the country's typical ingredients and techniques**, each with its local name and a short explanation in the reader's language.
2. **The reader picks** ingredients and techniques from it, a meal type, and optionally a short note. The sidebar's "leave out" list applies.
3. **A recipe is written** in the same shape as a pooled one, with the allergy notice.
4. **It's shown, downloadable and shareable as a PDF, and not stored anywhere.** It isn't saved to the account, as you asked. It isn't added to the shared pool either. It's the reader's own combination, not one of the country's dishes, and the pool is for real dishes.
   - Every creation generates. **The daily AI limit rations it, not an extra gate**, the same reasoning as Practice Text.
   - A reload loses it, as with Practice Text. The PDF is how it's kept.

## Section 3 — Where to eat (Phase 3, optional)

**In the country the language code names**, never AI-generated. A model invents restaurants, and recommends ones that have closed.

- **3a. Open Google Maps**, with no key, no cost, no data kept and no cookies set on our site.
  - A button builds a Maps search link (`https://www.google.com/maps/search/?api=1&query=…`) for restaurants of that cuisine **in the country from the dialect's region**, for example "restaurante tradicional, Angola" for `pt-AO`.
  - An optional box narrows it to a city or region the reader types ("Luanda"). It's never stored.
  - Maps does the rest on its own site. It's a small change with nothing to add to the privacy policy.
- **3b. A map with listings inside the app**, only if 3a proves too little. It would need:
  - A paid places provider.
  - A server-side key: a new endpoint, or an extension of an existing one. Ask first.
  - An embedded map, which sets third-party cookies. **§2.7 of the privacy policy promises no cookies at all**, so it needs consent and a rewrite.
  - That's a separate plan.

## Other phases

**Phase 2**, alongside Create:
- **Cook mode**: one step at a time on a large screen, read aloud, with the screen kept awake (the Wake Lock API, where it's supported).
- **Tap-and-hold words** in the practice-language view, to look them up and save them, reusing `StoryReader`'s word interaction.
- **Pulse:** recipes generated, read, saved and shared.

**Phase 3, optional:**
- A dish photo per pooled recipe, a planned use for `getImageService`.
- Imperial units, which is conversion in code.

## Why the leave-out list isn't stored like interests

**Interests are harmless. A leave-out list may not be.** "Sport" or "travel" reveals nothing sensitive. "No pork" can reveal a religion, and "no gluten" or "no lactose" can reveal a health condition. Under the GDPR (Art. 9), both are special-category data, which needs **explicit consent** and a stated purpose before it's stored against a person. EU courts read "revealing" broadly: in *OT* (CJEU, C-184/20, 2022), data that only *indirectly* revealed a sensitive fact counted.

That's a conservative reading, not legal advice.

What each option costs:

| | App change | Privacy policy change |
|---|---|---|
| **Browser only (chosen)** | A `localStorage` hook | One clause in §2.7, which lists what the browser keeps: add "your food preferences". Optionally a line in §2.6: those preferences are sent with a recipe request, as typed text already is. Then the Locales force resync. **About 30 minutes.** |
| **On the profile** | The same size: one field, plus the AppContext allow-list | A new data category and purpose (§2, §3), explicit consent as the legal basis (§3.6), and retention (§6). **Plus a consent checkbox** before the first restriction is saved, and deletion when consent is withdrawn. **1 to 2 hours, plus a legal read.** |

## The tile, now a hub

Only the copy changes; the key and route stay. The edited strings need the Locales force resync for other languages.

- **Title (`dashboard.food`):** "Comida" becomes **"Sabores do País"**. It pairs with "Cultura e História do País" and covers cooking and eating out alike.
- **Description (`dashboard.food_desc`)**, until restaurants ship:
  > Descobre os pratos típicos do país da língua que praticas e as suas histórias. Cozinha-os passo a passo ou cria receitas tuas com os ingredientes e as técnicas de lá.

  ("Discover the typical dishes of the country whose language you practise, and their stories. Cook them step by step, or create your own recipes with its ingredients and techniques.")
- **If "Where to eat" ships**, add: *"E encontra onde os comer."* ("And find where to eat them.")
- **Section cards:**
  - "Receitas do País": *"Pratos típicos, com a história e a receita."* ("Typical dishes, with their story and recipe.")
  - "Cria a Tua Receita": *"Junta ingredientes e técnicas de lá e cozinha algo teu."* ("Combine ingredients and techniques from there and cook something of your own.")
  - "Onde Comer", in Phase 3.

## Order of work

1. **Download and share** for tales and culture pieces: `DownloadPdfButton` and `readingPdf`. Useful on its own.
2. **Phase 1**, Country recipes, including the country's ingredient and technique list and the seeding hook.
3. **Phase 2**, Create, cook mode, word lookup and Pulse.
4. **Phase 3**, optional.

**Launch it with `hidden: true`** in Admin › Features until tested, then grant tiers.

## Checks

- **Unit tests:**
  - The recipe schema, and translations staying aligned.
  - Normalising keys, and the pork/gluten backup map.
  - Filtering in code (leave out, prefer, meal type, search).
  - The random draw: respects the sidebar, prefers unseen recipes, and generates only on an empty match.
  - **Each existing-recipe layer, with real near-misses.** The content check gets its own fixture set: duplicates that must match, near-neighbours that mustn't, and staples ignored.
  - The country list: the practice-language seeding starts it without waiting, a failed list doesn't fail seeding, interface-only and tutor-profile seeds don't trigger it, the fallback generates on first use, and the fixed id prevents a second list.
  - Pool status ignoring filters.
  - The favourite kind.
  - `markRecipeSeen` deduplicates, `resetSeenRecipes` empties the list, and `seenRecipeIds` stays after reload (the allow-list).
  - The `localStorage` lists surviving storage being unavailable.
  - Share offered only where `canShare({ files })` is true, and download otherwise.
- **Smoke tests:** the hub and each section mount. Registry strings resolve in the pt bundle.
- **Lint, build, and a browser pass**, including:
  - A `pt-BR` and a `pt-AO` account getting Brazilian and Angolan dishes.
  - Asking for a dish that exists serves it without an AI call (check the network).
  - Generating the same dish twice leaves one document.
  - A "leave out" chip removes matching recipes.
  - Sharing a PDF on a phone.
- **Both CLAUDE.md files, and privacy policy §2.7 (and §2.6)**, with the force resync.

## Effort

- **Download and share:** about two hours.
- **Phase 1:** about two and a half days: the hub, the list, search and random draw, the sidebar, the reader, the pool, the layered existing-recipe check with its fixtures, the country's ingredient and technique list with its seeding hook and fallback, and the policy line.
- **Phase 2:** about a day: Create, cook mode, word lookup and Pulse.
- **Phase 3a:** about an hour. **Phase 3b** is its own plan.
