# Plans

A queue of plans agreed but not yet built. One file per plan.

- **Adding a plan:** write a new file here, and add a line under "Queued" below.
- **When a plan is built:** delete its file and its line. The code, CLAUDE.md and git history then describe what was built.
- **When a plan or idea is dropped:** move its line to "Dropped", with the date and a one-line reason, so it isn't proposed again without that context. Its file can be deleted.

## Queued

- [Food of the country you practise](recipes-from-the-country.md): turn the `food` coming-soon stub into a hub. It opens with PDF sharing for tales and culture pieces. Phase 1 is country recipes: a pooled list, "Get me a recipe", a layered duplicate check by name and by ingredients and technique, the country's ingredient and technique list (built when a practice language is added, generated on first use otherwise), favourites, and a leave-out and favourite-foods sidebar kept in the browser. Phase 2 is creating a recipe from the country's typical ingredients and techniques, downloaded or shared, never stored. Phase 3, optional, is where to eat through Google Maps. Written 2026-09-28.
- [Grammar Structures and Tips: review, then remove or rework](grammar-structures-and-tips-review.md): both hidden in the meantime. A review with you, then either removal or one guide built on the drills' topics that works in every language. Written 2026-09-29.
- [The dashboard as a shelf of 3D books](dashboard-book-shelf.md): the six sections as books, built for phones first. A swipeable turntable on phones, the arc of spines on desktop, and a lift, cover swing and expand into the reader, all held to 60 fps on a mid-range Android. The list stays as the fallback. Reuses the parked shelf code and its three recorded traps. Written 2026-09-30.
- [Every sign-in method worth offering](login-providers.md): only Google works today; Apple, Facebook and X are wired in the frontend but the API answers 501. One provider-agnostic API path with the Admin switch as the real gate, linking for the same email across methods, and a redirect fallback for in-app browsers. Then email and password with Microsoft, then Apple (watch the Hide My Email relay), then Facebook and X. Phone, GitHub, Yahoo and OIDC providers are left out, with reasons. Written 2026-10-01.
- [Picture games](picture-games.md): a "Jogos com Imagens" tile in Diverte-te, for every age. One picture per word, made once on the server through a new `picture` mode of ask-ai (Gemini 3.1 Flash-Lite Image, shrunk to WebP, stored where only the server writes), free of the daily allowance but capped and never for guests. Games: Liga a imagem, Jogo da memória, Qual é o intruso, A Caderneta (a sticker album), then Descreve a imagem for Maestro (scenes on 3.1 Flash Image, found words counted in code, AI feedback) and, optionally, Diz o que vês. Rebuilds the never-working `getImageService`. Written 2026-10-01.
- [Gemini as the only AI provider](gemini-only.md): OpenAI does one thing (the tutor link check) and Perplexity nothing. Review first, move the tutor check to Gemini, then remove both from the API, the `openai` package and the privacy policy and Terms. The OpenAI client throws at startup without its key, so code before keys. Written 2026-10-01.

## Dropped

- **Pulse: push and email open tracking** (Phase 3 item 12 of App Current Pulse) — 2026-09-28. Low interest until reminders become a focus; it would need provider webhooks and per-message ids.
- **Google / Firebase Analytics** (listed as out of scope in App Current Pulse) — 2026-09-28. It sees guests and the path to sign-up, but costs a consent prompt, a rewrite of privacy policy §2.7 (no cookies, consent before any analytics), a Google script on every page and usage data going to Google. Pulse's first-touch acquisition covers part of the question. Reconsider when the question is "what happens before sign-up".
