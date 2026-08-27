import { useCallback, useMemo, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "./useTierAccess";

/**
 * The theme handed to the AI when the user has picked nothing at all. It is
 * prompt content, not UI copy, so it stays in English alongside the templates
 * rather than going through i18n.
 */
export const DEFAULT_THEME_LABEL = "generic local noun";

/** How a challenge's subject was chosen. */
export const THEME_KIND = {
  DEFAULT: "default",
  INTEREST: "interest",
  FREE_TEXT: "free_text",
};

/** Matches the other free-text boxes in the app (story, history & culture). */
export const FREE_TEXT_MAX = 200;

/**
 * useChallengeTheme
 *
 * Owns the subject a challenge is generated around: one of the user's own
 * interests, or a free-text theme.
 *
 * Deliberately restricted to interests already on the profile. Letting a user
 * pick any category here would quietly diverge from the interests that drive
 * the rest of the app; changing the set is a Settings decision, not a
 * per-puzzle one.
 *
 * The two inputs are mutually exclusive, and the exclusion is enforced here
 * rather than in the UI so every consumer agrees on what "the theme" is:
 * picking an interest blanks and disables the free text. `resolve()` still
 * prefers free text if both were somehow set, so the priority rule holds even
 * if a caller sets state directly.
 *
 * Cost model, which is why the two are not interchangeable:
 *   interest  — filters the shared word pool by topicIds. No extra AI call.
 *   free text — cannot match a pooled word, so it forces generation. That is a
 *               custom AI call, gated by the same `custom_requests` feature as
 *               the Story Generator's free-text box.
 *
 * @returns {{
 *   interests: Array<{id: string, label: string}>,
 *   hasInterests: boolean,
 *   selectedInterestId: string|null,
 *   selectInterest: (id: string|null) => void,
 *   freeText: string,
 *   setFreeText: (value: string) => void,
 *   canUseFreeText: boolean,
 *   freeTextBlockedByInterest: boolean,
 *   theme: {kind: string, label: string, topicIds: string[], isCustom: boolean},
 * }}
 */
export function useChallengeTheme() {
  const { user, categories } = useAppContext();
  const { canAccess } = useTierAccess();

  const [selectedInterestId, setSelectedInterestId] = useState(null);
  const [freeText, setFreeTextRaw] = useState("");

  // Hoisted out of the memo so the dependency and the body read the same
  // value — the React compiler cannot preserve the memoization otherwise.
  const savedInterests = user?.interests;

  // Only the interests already saved on the profile, resolved to labels.
  const interests = useMemo(() => {
    const saved = Array.isArray(savedInterests) ? savedInterests : [];
    if (saved.length === 0) return [];

    const labelById = new Map(
      (Array.isArray(categories) ? categories : []).map((c) => [c.id, c.label]),
    );
    // A category deleted from appConfig can still be on a profile; fall back to
    // the id rather than dropping the interest silently.
    return saved
      .filter(Boolean)
      .map((id) => ({ id, label: String(labelById.get(id) || id).trim() }))
      .filter((entry) => entry.label);
  }, [savedInterests, categories]);

  const canUseFreeText = canAccess("custom_requests");

  const selectInterest = useCallback((id) => {
    setSelectedInterestId((current) => {
      const next = current === id ? null : id;
      // Selecting clears the free text, so the two can never both be live.
      if (next) setFreeTextRaw("");
      return next;
    });
  }, []);

  const setFreeText = useCallback((value) => {
    setFreeTextRaw(value.slice(0, FREE_TEXT_MAX));
  }, []);

  const freeTextBlockedByInterest = Boolean(selectedInterestId);

  const theme = useMemo(() => {
    const trimmed = freeText.trim();
    if (trimmed && canUseFreeText && !freeTextBlockedByInterest) {
      return { kind: THEME_KIND.FREE_TEXT, label: trimmed, topicIds: [], isCustom: true };
    }

    const interest = interests.find((entry) => entry.id === selectedInterestId);
    if (interest) {
      return {
        kind: THEME_KIND.INTEREST,
        label: interest.label,
        topicIds: [interest.id],
        isCustom: false,
      };
    }

    return {
      kind: THEME_KIND.DEFAULT,
      label: DEFAULT_THEME_LABEL,
      topicIds: [],
      isCustom: false,
    };
  }, [freeText, canUseFreeText, freeTextBlockedByInterest, interests, selectedInterestId]);

  return {
    interests,
    hasInterests: interests.length > 0,
    selectedInterestId,
    selectInterest,
    freeText,
    setFreeText,
    canUseFreeText,
    freeTextBlockedByInterest,
    theme,
  };
}

export default useChallengeTheme;
