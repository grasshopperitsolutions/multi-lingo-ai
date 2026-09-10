import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import {
  FAVOURITE_KINDS,
  getFavouriteIds,
  toggleFavourite,
  favouriteFieldFor,
} from "../services/favouritesService";

/**
 * useWordFavourites
 *
 * The word bank: words a reader collected while practising, stored as the
 * WORD favourite kind (`favWordIds`) so it shares the service, the field
 * naming and the optimistic-write behaviour with every other favourite
 * rather than inventing a parallel mechanism.
 *
 * The id **is** the word, normalised here in code (trimmed, lower-cased) so
 * "Casa" tapped in a title and "casa" tapped in a paragraph are one entry.
 * Normalising at the boundary rather than at each call site is what keeps
 * `isFavourite` honest — a caller asking about the raw tapped token gets the
 * right answer without knowing the rule.
 *
 * The toggle is optimistic for the same reason useFeatureFavourites' is:
 * waiting on a round trip to fill in a heart feels broken. A failed write
 * rolls the list back and surfaces the error.
 *
 * @returns {{
 *   words: string[],
 *   isFavourite: (word: string) => boolean,
 *   toggle: (word: string) => void,
 *   remove: (word: string) => void,
 * }}
 */

/** Trim, collapse inner whitespace, lower-case. Empty in, empty out. */
export function normaliseWord(word) {
  return String(word ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function useWordFavourites() {
  const { user, setUser, showAlert } = useAppContext();
  const { t } = useTranslation();

  const words = getFavouriteIds(user, FAVOURITE_KINDS.WORD);

  const isFavourite = useCallback(
    (word) => words.includes(normaliseWord(word)),
    [words],
  );

  const write = useCallback(
    (word, nextIds) => {
      const field = favouriteFieldFor(FAVOURITE_KINDS.WORD);
      const currentIds = getFavouriteIds(user, FAVOURITE_KINDS.WORD);

      setUser((prev) => (prev ? { ...prev, [field]: nextIds } : prev));

      toggleFavourite({
        token: user.token,
        uid: user.uid,
        kind: FAVOURITE_KINDS.WORD,
        id: word,
        currentIds,
      }).catch((err) => {
        setUser((prev) => (prev ? { ...prev, [field]: currentIds } : prev));
        showAlert("error", err.message || t("settings.errors.save_failed"));
      });
    },
    [user, setUser, showAlert, t],
  );

  const toggle = useCallback(
    (word) => {
      const id = normaliseWord(word);
      if (!user?.token || !user?.uid || !id) return;

      const currentIds = getFavouriteIds(user, FAVOURITE_KINDS.WORD);
      const nextIds = currentIds.includes(id)
        ? currentIds.filter((existing) => existing !== id)
        : [...currentIds, id];

      write(id, nextIds);
    },
    [user, write],
  );

  const remove = useCallback(
    (word) => {
      const id = normaliseWord(word);
      if (!user?.token || !user?.uid || !id) return;

      const currentIds = getFavouriteIds(user, FAVOURITE_KINDS.WORD);
      if (!currentIds.includes(id)) return;

      write(id, currentIds.filter((existing) => existing !== id));
    },
    [user, write],
  );

  return { words, isFavourite, toggle, remove };
}
