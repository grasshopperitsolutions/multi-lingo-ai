/**
 * Centralised single source of truth for static app constants.
 *
 * Language lists are now dynamic from Firestore via AppContext/supportedLanguagesService.
 * Only interest categories remain hardcoded.
 */

// Fixed interest categories
export const INTEREST_CATEGORIES = [
  { value: "general", labelKey: "categories.general" },
  { value: "food",    labelKey: "categories.food" },
  { value: "travel",  labelKey: "categories.travel" },
  { value: "sports",  labelKey: "categories.sports" },
  { value: "tech",    labelKey: "categories.tech" },
  { value: "nature",  labelKey: "categories.nature" },
];
