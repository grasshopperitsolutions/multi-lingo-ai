import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { X, BookMarked } from "lucide-react";

/**
 * WordBankSidebar
 *
 * The reader's collected words, beside the story they were collected from.
 *
 * Two actions live on one chip and they must not be confused for each other:
 * pressing the chip **selects** the word for the next story, the corner X
 * **removes** it from the bank for good. The X is a nested button, so its
 * click is stopped from reaching the chip underneath.
 *
 * Selection is capped (see `maxSelected`) because the words go into a
 * generation prompt: past a handful, the model starts writing a sentence per
 * word instead of a story that happens to use them. Chips beyond the cap are
 * dimmed and inert rather than hidden, so the limit is visible instead of
 * being a click that silently does nothing.
 *
 * Layout follows ExerciseSidebar: a fixed left column on lg+, a strip below
 * the content on smaller screens. It renders in both places from one call.
 */
const WordBankSidebar = ({
  words,
  selected,
  onToggleSelect,
  onRemove,
  maxSelected,
  canSelect,
  isDarkMode,
}) => {
  const { t } = useTranslation();

  const panelBase = `rounded-2xl border-4 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
  }`;

  const atLimit = selected.length >= maxSelected;

  const body = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          <BookMarked size={13} />
          {t("word_bank.title")}
        </span>
        {words.length > 0 && canSelect && (
          <span className={`text-[11px] font-black tabular-nums ${
            atLimit
              ? isDarkMode ? "text-yellow-400" : "text-blue-600"
              : isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}>
            {selected.length}/{maxSelected}
          </span>
        )}
      </div>

      {words.length === 0 ? (
        <p className={`text-xs font-bold leading-relaxed ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {t("word_bank.empty_state")}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {words.map((word) => {
              const isSelected = selected.includes(word);
              const isDisabled = !canSelect || (!isSelected && atLimit);

              return (
                <span key={word} className="relative inline-flex">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(word)}
                    disabled={isDisabled}
                    aria-pressed={isSelected}
                    className={`pl-3 pr-6 py-1.5 rounded-full border-2 font-bold text-sm transition-all active:scale-95 ${
                      isSelected
                        ? isDarkMode
                          ? "bg-yellow-400 border-yellow-400 text-slate-900"
                          : "bg-yellow-400 border-slate-900 text-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
                        : isDarkMode
                          ? "bg-slate-900 border-slate-700 text-slate-200"
                          : "bg-slate-50 border-slate-300 text-slate-700"
                    } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {word}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(word)}
                    aria-label={t("word_bank.remove", { word })}
                    className={`absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
                      isDarkMode
                        ? "bg-slate-700 border-slate-600 text-slate-300 hover:text-white"
                        : "bg-white border-slate-900 text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <X size={9} strokeWidth={3} />
                  </button>
                </span>
              );
            })}
          </div>

          <p className={`text-[11px] font-bold leading-relaxed ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
            {/* Removing a word always works; feeding words to the generator is
                the part that needs the tier, because it forces a fresh story. */}
            {canSelect ? t("word_bank.select_hint", { count: maxSelected }) : t("word_bank.select_locked")}
          </p>
        </>
      )}
    </div>
  );

  return (
    <>
      <aside className={`hidden lg:flex flex-col w-64 shrink-0 ${panelBase} p-4`}>{body}</aside>
      <div className={`lg:hidden order-last w-full ${panelBase} p-4`}>{body}</div>
    </>
  );
};

WordBankSidebar.propTypes = {
  /** Every banked word, already normalised by useWordFavourites. */
  words: PropTypes.arrayOf(PropTypes.string).isRequired,
  /** The subset picked for the next generation. */
  selected: PropTypes.arrayOf(PropTypes.string).isRequired,
  onToggleSelect: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  maxSelected: PropTypes.number.isRequired,
  /** False when this reader's tier can't trigger a generation — chips become
   *  read-only, but the X still removes. */
  canSelect: PropTypes.bool.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default WordBankSidebar;
