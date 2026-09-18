/**
 * storyThemes.js
 *
 * The worlds a tale can be set in. The reader picks one before asking for a
 * tale, and it reaches the model as `{{theme}}` in `story-generate-prompt`.
 *
 * **These ids are stored on every story document**, which is what lets the
 * shared pool be filtered by theme instead of regenerating one per reader.
 * Renaming an id therefore orphans every tale already written under it — add
 * and retire, never rename.
 *
 * Deliberately a bounded list rather than free text. A bounded set can be
 * cached and shared: ten readers asking for a fantasy tale at B1 draw from the
 * same ten tales. Free text cannot be, which is why `other` is gated like any
 * other custom request — see `CustomRequestInput`.
 *
 * `any` is the default and the escape hatch: it filters nothing, so it is the
 * only option that can serve the tales written before themes existed (a
 * Firestore equality filter drops documents missing the field entirely).
 *
 * There is no "history" theme on purpose. Telling the Tale Creator apart from
 * Country Culture & History is the whole reason both were renamed; putting
 * "história" back in this list would undo it.
 */

/** Filters nothing and is what an untouched picker sends. */
export const DEFAULT_STORY_THEME = "any";

/** Free text instead of a preset — always generates, never reads the pool. */
export const CUSTOM_STORY_THEME = "other";

export const STORY_THEMES = [
  { id: "any", labelKey: "story.themes.any" },
  { id: "everyday", labelKey: "story.themes.everyday" },
  { id: "adventure", labelKey: "story.themes.adventure" },
  { id: "fantasy", labelKey: "story.themes.fantasy" },
  { id: "fairytale", labelKey: "story.themes.fairytale" },
  { id: "mystery", labelKey: "story.themes.mystery" },
  { id: "underwater", labelKey: "story.themes.underwater" },
  { id: "animals", labelKey: "story.themes.animals" },
  { id: "sports", labelKey: "story.themes.sports" },
  { id: "scifi", labelKey: "story.themes.scifi" },
  { id: "humour", labelKey: "story.themes.humour" },
  { id: "other", labelKey: "story.themes.other" },
];

/** Every id, for validating a stored or incoming value. */
export const STORY_THEME_IDS = STORY_THEMES.map((theme) => theme.id);

/**
 * What the model is actually told, for a preset theme.
 *
 * English, and not from the locale files, for the same reason the TTS accent
 * names are: this is a machine instruction inside an English prompt, and a
 * reader whose interface is in Thai should still get the tale they asked for.
 * The reader-facing label lives in `labelKey`; these two are not the same
 * string doing double duty.
 */
const THEME_INSTRUCTIONS = {
  any: "(any)",
  everyday: "everyday life — ordinary people, ordinary days, nothing fantastical",
  adventure: "adventure — a journey, a risk taken, somewhere unfamiliar",
  fantasy: "fantasy — magic, invented places, creatures that do not exist",
  fairytale: "a fairy tale — the shape and cadence of a folk tale, with a moral or a turn at the end",
  mystery: "mystery — something is not right, and it is worked out by the end",
  underwater: "underwater — the sea, the coast, boats, divers, what lives below",
  animals: "animals — they can be the main characters, wild or domestic",
  sports: "sport — playing, training, competing, supporting",
  scifi: "science fiction — the future, technology, space",
  humour: "comedy — light, warm and genuinely funny; misunderstandings rather than cruelty",
};

/**
 * Resolve the picker's value into the line handed to the model.
 *
 * @param {string} themeId - An id from STORY_THEMES.
 * @param {string} [customTheme] - The reader's own words, when `themeId` is "other".
 * @returns {string} Never empty — the template always has something to read.
 */
export function describeStoryTheme(themeId, customTheme = "") {
  if (themeId === CUSTOM_STORY_THEME) {
    return customTheme.trim() || THEME_INSTRUCTIONS.any;
  }
  return THEME_INSTRUCTIONS[themeId] ?? THEME_INSTRUCTIONS.any;
}
