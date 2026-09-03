/**
 * conceptIconService.js
 *
 * The little picture some crossword clues show instead of, or above, their
 * text.
 *
 * Icons live on the CONCEPT document, `wordPool/{conceptId}`, not on
 * `wordPool/{conceptId}/translations/{locale}`. A cake is a cake in every
 * language, so one icon serves every locale and every game that ever wants
 * one — and a user practising German pays for the icon a user practising
 * Portuguese already generated.
 *
 * Three fields, all optional:
 *   emoji     - one character, always cheap to render, used when there is no SVG
 *   iconSvg   - flat 24x24 markup, sanitised on render by utils/sanitizeSvg
 *   shortClue - a terse crossword clue, two or three words
 *
 * shortClue exists because getWord's `hint` is a dictionary definition written
 * for games with room for a sentence ("E um documento de identificacao
 * essencial para viajar para fora do pais"). A crossword clue cell is about
 * 45 pixels square. The definition is still shown in full when the player taps
 * the clue, but it cannot be what sits in the cell.
 *
 * Neither is guaranteed. Every concept written before this existed has both
 * missing, which is deliberate: the clue falls back to plain text and the grid
 * ends up with a mix of illustrated and text-only clues.
 *
 * Cost model
 * ----------
 * Generating is an AI call the user did not ask for, so:
 *   - it never blocks the puzzle. Words render first; icons arrive after.
 *   - it is skipConfirm, because a confirmation modal interrupting a puzzle to
 *     ask about a decoration would be worse than the decoration is worth.
 *   - it is generated once per concept, ever. After the first play it is free,
 *     and every other game and locale gets it too.
 *   - failure is silent and falls back to text.
 *
 * There is no per-puzzle cap. Every clue in a grid needs a short clue to be
 * readable at all, so capping would leave most cells showing a clipped
 * dictionary definition. The cost is front-loaded: a first play of an unseeded
 * grid can fire one call per answer, and every play after that is free.
 */

import { getDocument, patchDocument } from "./firestoreService";
import { getPrompt, renderTemplate } from "./promptService";
import { askAI } from "./aiService";
import { parseAIJSON } from "../utils/parseAIJSON";
import { sanitizeSvg } from "../utils/sanitizeSvg";

const CONCEPTS_COLLECTION = "wordPool";
const GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * Ceiling on generations per puzzle. Effectively unlimited: a clue without a
 * short clue is unreadable in a grid cell, so every answer needs one. Kept as a
 * constant so it is one edit away from becoming a real cap again.
 */
export const MAX_NEW_ICONS_PER_PUZZLE = Infinity;

/** Longest clue that still fits a grid cell without being clipped. */
const MAX_SHORT_CLUE = 40;

/**
 * Read whatever icons already exist for these concepts.
 *
 * Also returns `sourceWord`, because generation needs it and the concept doc is
 * the only place it lives — fetching it here avoids a second read later.
 *
 * A failed read resolves to an entry with no icon rather than rejecting: a
 * missing decoration must never take the puzzle down with it.
 *
 * @param {string[]} conceptIds
 * @param {string} token
 * @returns {Promise<Map<string, {emoji: string|null, iconSvg: string|null, sourceWord: string|null}>>}
 */
export async function fetchConceptIcons(conceptIds, token) {
  const unique = [...new Set(conceptIds.filter(Boolean))];

  const entries = await Promise.all(
    unique.map(async (conceptId) => {
      try {
        const doc = await getDocument(CONCEPTS_COLLECTION, conceptId, token);
        const data = doc?.data ?? {};
        return [
          conceptId,
          {
            emoji: data.emoji ?? null,
            iconSvg: data.iconSvg ?? null,
            shortClue: data.shortClue ?? null,
            sourceWord: data.sourceWord ?? null,
          },
        ];
      } catch (err) {
        console.warn(`[conceptIconService] read failed for "${conceptId}":`, err.message);
        return [conceptId, { emoji: null, iconSvg: null, shortClue: null, sourceWord: null }];
      }
    })
  );

  return new Map(entries);
}

/**
 * Ask the AI for an icon and persist it on the concept.
 *
 * The SVG is sanitised before it is written as well as on render. Writing
 * something unsafe and relying on the reader to clean it would leave the
 * dangerous version sitting in shared data for any future reader that forgets.
 *
 * @param {{conceptId: string, sourceWord: string, token: string}} params
 * @returns {Promise<{emoji: string|null, iconSvg: string|null}|null>}
 */
export async function generateConceptIcon({ conceptId, sourceWord, token }) {
  if (!conceptId || !sourceWord || !token) return null;

  const promptDoc = await getPrompt("get-word-generate-icon-prompt");
  const prompt = renderTemplate(promptDoc.template, { sourceWord });

  const providerParams = {
    provider: "gemini",
    model: promptDoc.model || GEMINI_MODEL,
    temperature: 0.4,
    jsonMode: true,
    responseSchema: {
      type: "object",
      properties: {
        svg: { type: "string" },
        emoji: { type: "string" },
        shortClue: { type: "string" },
      },
      required: ["svg", "emoji", "shortClue"],
    },
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams, { skipConfirm: true });
  const parsed = parseAIJSON(data?.text ?? "");
  if (!parsed) return null;

  const iconSvg = sanitizeSvg(parsed.svg);
  const emoji = typeof parsed.emoji === "string" ? [...parsed.emoji.trim()][0] ?? null : null;
  const shortClue =
    typeof parsed.shortClue === "string" && parsed.shortClue.trim()
      ? parsed.shortClue.trim().slice(0, MAX_SHORT_CLUE)
      : null;

  // Nothing usable came back. Returning null rather than writing empty fields
  // keeps the concept eligible for a retry on some later play.
  if (!iconSvg && !emoji && !shortClue) return null;

  const patch = { updatedAt: new Date().toISOString() };
  if (iconSvg) patch.iconSvg = iconSvg;
  if (emoji) patch.emoji = emoji;
  if (shortClue) patch.shortClue = shortClue;

  await patchDocument(CONCEPTS_COLLECTION, conceptId, patch, token);

  return { emoji, iconSvg, shortClue };
}

/**
 * Resolve icons for a puzzle: hand back what exists, then fill a few gaps.
 *
 * `onIcon` is called once per concept that ends up with an icon — immediately
 * for cached ones, later for generated ones. The caller renders on each call,
 * so the grid is playable before any generation finishes.
 *
 * Generation runs sequentially rather than in parallel: three concurrent AI
 * calls for decoration would compete with whatever the user does next.
 *
 * @param {{
 *   conceptIds: string[],
 *   token: string,
 *   cap?: number,
 *   onIcon: (conceptId: string, icon: {emoji: string|null, iconSvg: string|null}) => void,
 *   isCancelled?: () => boolean,
 * }} params
 * @returns {Promise<void>}
 */
export async function loadConceptIcons({
  conceptIds,
  token,
  cap = MAX_NEW_ICONS_PER_PUZZLE,
  onIcon,
  isCancelled = () => false,
}) {
  if (!token || !conceptIds?.length) return;

  const existing = await fetchConceptIcons(conceptIds, token);
  if (isCancelled()) return;

  const missing = [];

  for (const [conceptId, icon] of existing) {
    if (icon.iconSvg || icon.emoji || icon.shortClue) {
      onIcon(conceptId, {
        emoji: icon.emoji,
        iconSvg: icon.iconSvg,
        shortClue: icon.shortClue,
      });
    } else if (icon.sourceWord) {
      missing.push({ conceptId, sourceWord: icon.sourceWord });
    }
  }

  const budgeted = Number.isFinite(cap) ? missing.slice(0, cap) : missing;

  for (const { conceptId, sourceWord } of budgeted) {
    if (isCancelled()) return;
    try {
      const generated = await generateConceptIcon({ conceptId, sourceWord, token });
      if (generated && !isCancelled()) onIcon(conceptId, generated);
    } catch (err) {
      // Includes AiGenerationDeclined and quota errors. A clue without a
      // picture is a working clue.
      console.warn(`[conceptIconService] generate failed for "${conceptId}":`, err.message);
    }
  }
}
