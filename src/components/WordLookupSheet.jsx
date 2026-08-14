import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { X, Volume2, Square, Loader2 } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTts } from "../hooks/useTts";
import { lookupWord } from "../services/dictionaryService";

/**
 * WordLookupSheet
 *
 * A quick-glance dictionary lookup for a single tapped word, without leaving
 * whatever the reader was doing. Reuses dictionaryService.lookupWord (the
 * same call DictionaryPanel makes) rather than the full DictionaryPanel
 * component — that page is built around a search bar and copy/clear actions
 * for typing a fresh lookup, none of which apply to "I tapped one word".
 *
 * Renders nothing when `word` is null/empty; the caller controls visibility
 * by setting/clearing `word`.
 */
const WordLookupSheet = ({ word, targetLang, isDarkMode, onClose }) => {
  const { t } = useTranslation();
  const { user, interfaceLang } = useAppContext();
  const { ttsState, playTts, stopTts } = useTts();

  const [activeWord, setActiveWord] = useState(word);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Looking up a synonym re-triggers this effect by changing activeWord,
  // without needing the caller to know a lookup happened inside the sheet.
  useEffect(() => {
    setActiveWord(word);
  }, [word]);

  useEffect(() => {
    if (!activeWord) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setResult(null);

    // No wordTypes: this is a quick tap-to-glance while reading, so the single
    // most common sense is what's wanted. The full Dictionary page is where
    // you narrow by grammatical category.
    lookupWord({ token: user?.token, word: activeWord, interfaceLang, learningLang: targetLang })
      .then((data) => { if (!cancelled) setResult(data.entries[0] ?? null); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [activeWord, user?.token, interfaceLang, targetLang]);

  if (!word) return null;

  const isPlaying = ttsState.activeKey === "word-lookup";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="word-lookup-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className={`relative w-full sm:max-w-sm rounded-2xl border-4 p-5 ${
          isDarkMode
            ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
            : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
        }`}
      >
        <button
          onClick={onClose}
          aria-label={t("common.close", "Close")}
          className={`absolute top-3 right-3 p-1.5 rounded-lg transition-colors ${
            isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
          }`}
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 pr-8">
          <h3
            id="word-lookup-title"
            className={`text-xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            {activeWord}
          </h3>
          <button
            type="button"
            onClick={() =>
              isPlaying
                ? stopTts()
                : playTts({ key: "word-lookup", text: activeWord, lang: targetLang, token: user?.token })
            }
            aria-label={isPlaying ? t("common.stop", "Stop") : t("grammar.listen", "Listen")}
            className={`shrink-0 p-1.5 rounded-lg border-2 transition-transform hover:scale-110 active:scale-95 ${
              isDarkMode ? "border-amber-500/50 text-amber-400" : "border-amber-400 text-amber-600"
            }`}
          >
            {isPlaying ? <Square size={12} /> : <Volume2 size={12} />}
          </button>
        </div>

        <div className="mt-3 min-h-[3rem]">
          {isLoading && (
            <div className={`flex items-center gap-2 text-sm font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              <Loader2 size={14} className="animate-spin" />
              {t("common.loading", "Loading...")}
            </div>
          )}

          {!isLoading && error && (
            <p className="text-sm font-semibold text-rose-500">{error}</p>
          )}

          {!isLoading && !error && result && (
            <>
              {/* Which sense of the word this is. The full Dictionary page lets
                  you request several categories at once; here the model picks
                  the most common one, so showing which it chose matters. */}
              {result.wordType && (
                <span className={`inline-block mb-2 px-2.5 py-1 rounded-full border-2 text-[10px] font-black uppercase tracking-widest ${
                  isDarkMode
                    ? "bg-violet-900/40 border-violet-700 text-violet-300"
                    : "bg-violet-50 border-violet-300 text-violet-700"
                }`}>
                  {t(`dictionary.word_type.${result.wordType}`, result.wordType)}
                </span>
              )}
              <p className={`text-sm ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>
                {result.definition}
              </p>
              {result.synonyms?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {result.synonyms.map((syn) => (
                    <button
                      key={syn}
                      onClick={() => setActiveWord(syn)}
                      className={`px-3 py-1 rounded-full border-2 text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 active:scale-95 ${
                        isDarkMode
                          ? "bg-slate-700 border-slate-600 text-violet-300 hover:border-violet-400 hover:text-violet-200"
                          : "bg-slate-100 border-slate-300 text-violet-700 hover:border-violet-400 hover:bg-violet-50"
                      }`}
                    >
                      {syn}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

WordLookupSheet.propTypes = {
  word: PropTypes.string,
  targetLang: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default WordLookupSheet;
