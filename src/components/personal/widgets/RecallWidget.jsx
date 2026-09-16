import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Eye, Shuffle } from "lucide-react";
import { useAppContext } from "../../../contexts/AppContext";
import WordLookupSheet from "../../WordLookupSheet";
import PersonalWidgetCard from "../PersonalWidgetCard";

/**
 * RecallWidget
 *
 * One item from everything you have collected, front side up. Tap to see the
 * back, tap again for another.
 *
 * The phrasebook, the mistake journal and the word bank are all write-only
 * today: things go in and nothing ever brings them back out. This is the
 * smallest thing that changes that — no AI, no new data, no new storage, and
 * no scoring. Scoring would make it a test, and a test is something you have to
 * be in the mood for; this is something you glance at.
 *
 * Three pools, because the three lists have the same shape underneath: a phrase
 * and its translation, a mistake and its correction, a word and its meaning.
 * The first two carry their own back side. A word does not, so revealing one
 * opens the dictionary sheet — the answer, fetched rather than stored.
 *
 * The chosen item is derived from a seed rather than held in an effect. An
 * effect that picked on mount would need the pool in its dependency array, and
 * `getFavouriteIds` hands back a fresh `[]` on every render for a user with no
 * words — which is exactly the shape that caused an infinite render loop once
 * already.
 */
const RecallWidget = ({ phrases, mistakes, words, isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();

  const [seed, setSeed] = useState(() => Math.random());
  const [revealed, setRevealed] = useState(false);
  const [lookupWord, setLookupWord] = useState(null);

  const pool = useMemo(() => {
    const entries = [];
    for (const item of phrases) {
      if (item.phrase && item.translation) {
        entries.push({ kind: "phrase", front: item.phrase, back: item.translation });
      }
    }
    for (const item of mistakes) {
      if (item.said && item.correction) {
        entries.push({ kind: "mistake", front: item.said, back: item.correction });
      }
    }
    for (const word of words) {
      entries.push({ kind: "word", front: word, back: null });
    }
    return entries;
  }, [phrases, mistakes, words]);

  const shown = pool.length > 0 ? pool[Math.floor(seed * pool.length) % pool.length] : null;

  const next = () => {
    setRevealed(false);
    setLookupWord(null);
    setSeed(Math.random());
  };

  const reveal = () => {
    if (shown?.kind === "word") setLookupWord(shown.front);
    else setRevealed(true);
  };

  const SOURCE_LABELS = {
    phrase: t("personal.phrasebook_title"),
    mistake: t("personal.mistakes_title"),
    word: t("personal.dash_words_title"),
  };

  return (
    <PersonalWidgetCard
      widgetId="recall"
      isDarkMode={isDarkMode}
      count={pool.length > 0 ? String(pool.length) : undefined}
    >
      {!shown ? (
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
          {t("personal.dash_recall_empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <span
              className={`text-[9px] font-black uppercase tracking-widest ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {SOURCE_LABELS[shown.kind]}
            </span>

            <p
              className={`text-xl font-black tracking-tight ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              {shown.front}
            </p>

            {/* The gap is held open so revealing does not jolt the card. */}
            <p
              aria-live="polite"
              className={`min-h-[1.5rem] font-bold ${
                revealed
                  ? isDarkMode ? "text-yellow-400" : "text-blue-700"
                  : "opacity-0"
              }`}
            >
              {revealed ? shown.back : "—"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reveal}
              disabled={revealed && shown.kind !== "word"}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                revealed && shown.kind !== "word"
                  ? isDarkMode
                    ? "border-slate-700 text-slate-600 cursor-not-allowed"
                    : "border-slate-300 text-slate-400 cursor-not-allowed"
                  : isDarkMode
                    ? "border-slate-700 text-slate-200 hover:bg-slate-700"
                    : "border-slate-900 text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Eye size={15} strokeWidth={3} />
              {t("personal.dash_recall_reveal")}
            </button>

            <button
              type="button"
              onClick={next}
              disabled={pool.length < 2}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                pool.length < 2
                  ? isDarkMode
                    ? "border-slate-700 text-slate-600 cursor-not-allowed"
                    : "border-slate-300 text-slate-400 cursor-not-allowed"
                  : isDarkMode
                    ? "bg-yellow-400 border-yellow-400 text-slate-900"
                    : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
              }`}
            >
              <Shuffle size={15} strokeWidth={3} />
              {t("personal.dash_recall_next")}
            </button>
          </div>
        </div>
      )}

      <WordLookupSheet
        word={lookupWord}
        targetLang={user?.learningDialect}
        isDarkMode={isDarkMode}
        onClose={() => setLookupWord(null)}
      />
    </PersonalWidgetCard>
  );
};

RecallWidget.propTypes = {
  phrases: PropTypes.array.isRequired,
  mistakes: PropTypes.array.isRequired,
  words: PropTypes.arrayOf(PropTypes.string).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default RecallWidget;
