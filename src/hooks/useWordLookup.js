import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { useWordFavourites } from "./useWordFavourites";

/**
 * State for a reader whose words can be tapped and held
 * (components/TappableParagraph), with the dictionary sheet it opens.
 *
 * `lookup(word, sentence)` opens the sheet; `bank(word)` toggles the word in
 * the word bank and says so, because a hold has no visible result of its own
 * and without the alert the reader can't tell whether they held long enough.
 *
 * Render `<WordLookupSheet word={activeWord} sentence={activeSentence ?? undefined}
 * targetLang={...} isDarkMode={...} onClose={close} />` beside the text.
 */
export function useWordLookup() {
  const { t } = useTranslation();
  const { showAlert } = useAppContext();
  const { isFavourite, toggle } = useWordFavourites();
  const [activeWord, setActiveWord] = useState(null);
  // The sentence the word was tapped in, so the lookup can describe the sense
  // the reader actually met rather than the word's commonest one.
  const [activeSentence, setActiveSentence] = useState(null);

  const lookup = useCallback((word, sentence) => {
    setActiveWord(word);
    setActiveSentence(sentence ?? null);
  }, []);

  const close = useCallback(() => {
    setActiveWord(null);
    setActiveSentence(null);
  }, []);

  // Not memoised: `toggle` from useWordFavourites changes with the word list,
  // and a stale copy would bank against yesterday's list.
  const bank = (word) => {
    const alreadyBanked = isFavourite(word);
    toggle(word);
    showAlert("success", alreadyBanked ? t("word_bank.removed", { word }) : t("word_bank.added", { word }));
  };

  return { activeWord, activeSentence, lookup, close, bank };
}
