import { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import WordLookupSheet from "../../WordLookupSheet";
import PersonalWidgetCard from "../PersonalWidgetCard";

/**
 * WordBankWidget
 *
 * The words you tapped and kept while reading — the purest "your own material"
 * in the app, and until now the only piece of it living outside the personal
 * area. It appeared in the story reader's sidebar, inside fill-the-blanks
 * exercises, and as a housekeeping list in Settings; nowhere you would go to
 * *look at your words*.
 *
 * Costs no request. `useWordFavourites` reads `favWordIds` straight off the
 * loaded profile, so this stays in step with the story page's sidebar without
 * either knowing about the other: bank a word mid-story, it is here when you
 * come back.
 *
 * Tapping a chip opens the same `WordLookupSheet` the story reader uses rather
 * than navigating to the dictionary — you are looking a word up, not leaving
 * the page.
 *
 * The remove control is a `p-2.5` button, thumb-sized, because a too-small
 * delete sitting next to a tap-to-look-up is how you delete a word you meant
 * to read.
 *
 * **This is the only place the word bank is managed.** There was a second
 * surface in Settings — the same list with a 16px corner X — from before this
 * dashboard existed. Two places to remove a word is one more than the feature
 * needs, and Settings is not where you think about your own material. Every
 * word renders here, newest first, inside a scrolling region: nothing is
 * hidden behind a "see all" that no longer exists.
 */
const WordBankWidget = ({ words, onRemove, isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [activeWord, setActiveWord] = useState(null);

  // Newest last in the stored array, and the newest are the interesting ones.
  const visible = [...words].reverse();

  return (
    <PersonalWidgetCard
      widgetId="words"
      isDarkMode={isDarkMode}
      count={words.length > 0 ? String(words.length) : undefined}
    >
      {words.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t("personal.dash_words_empty")}
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/story-generator")}
            className={`px-4 py-2.5 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
              isDarkMode
                ? "border-slate-700 text-slate-300 hover:bg-slate-700"
                : "border-slate-900 text-slate-900 hover:bg-slate-100"
            }`}
          >
            {t("personal.dash_words_cta")}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-40 sm:max-h-52 overflow-y-auto overscroll-contain scrollbar-hidden">
          {visible.map((word) => (
            <span
              key={word}
              // The chip is 44px tall and both halves fill it: the look-up and
              // the delete sit side by side, so the delete cannot be the
              // smaller target.
              className={`inline-flex items-stretch max-w-full min-h-[44px] rounded-full border-2 font-bold overflow-hidden ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-slate-200"
                  : "bg-slate-50 border-slate-300 text-slate-700"
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveWord(word)}
                className="flex items-center pl-4 pr-2 text-left break-words transition-colors hover:underline"
              >
                {word}
              </button>
              <button
                type="button"
                onClick={() => onRemove(word)}
                aria-label={`${t("common.remove")}: ${word}`}
                className={`flex items-center justify-center min-w-[40px] pr-1 transition-colors ${
                  isDarkMode ? "text-slate-500 hover:text-rose-400" : "text-slate-400 hover:text-rose-600"
                }`}
              >
                <X size={14} strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      )}

      <WordLookupSheet
        word={activeWord}
        targetLang={user?.learningDialect}
        isDarkMode={isDarkMode}
        onClose={() => setActiveWord(null)}
      />
    </PersonalWidgetCard>
  );
};

WordBankWidget.propTypes = {
  words: PropTypes.arrayOf(PropTypes.string).isRequired,
  /** useWordFavourites' `remove`. */
  onRemove: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default WordBankWidget;
