import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Volume2, Square } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useTts } from "../hooks/useTts";

/**
 * GrammarExampleList
 *
 * Renders example sentences with a play button on each. Shared by the grammar
 * structure library and the tips list so both read and sound the same.
 *
 * `keyPrefix` scopes the TTS keys per list — useTts allows only one clip at a
 * time and identifies the active one by key, so two lists on the same page
 * would otherwise fight over the highlight.
 */
const GrammarExampleList = ({ examples, targetLang, isDarkMode, keyPrefix }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const { ttsState, playTts, stopTts } = useTts();

  if (!examples?.length) return null;

  return (
    <ul className="flex flex-col gap-2">
      {examples.map((example, index) => {
        const ttsKey = `${keyPrefix}-${index}`;
        const isPlaying = ttsState.activeKey === ttsKey;

        return (
          <li
            key={ttsKey}
            className={`flex items-start gap-3 p-3 rounded-xl border-2 ${
              isDarkMode ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-200"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                isPlaying
                  ? stopTts()
                  : playTts({ key: ttsKey, text: example.target, lang: targetLang, token: user?.token })
              }
              aria-label={isPlaying ? t("common.stop", "Stop") : t("grammar.listen", "Listen")}
              className={`shrink-0 p-2 rounded-lg border-2 transition-transform hover:scale-110 active:scale-95 ${
                isDarkMode
                  ? "border-amber-500/50 text-amber-400 hover:bg-slate-800"
                  : "border-amber-400 text-amber-600 hover:bg-amber-50"
              }`}
            >
              {isPlaying ? <Square size={14} /> : <Volume2 size={14} />}
            </button>

            <div className="min-w-0">
              <p className={`font-bold text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                {example.target}
              </p>
              {example.native && (
                <p className={`text-sm ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                  {example.native}
                </p>
              )}
              {example.note && (
                <p className={`text-xs italic mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                  {example.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

GrammarExampleList.propTypes = {
  examples: PropTypes.arrayOf(
    PropTypes.shape({
      target: PropTypes.string.isRequired,
      native: PropTypes.string,
      note: PropTypes.string,
    })
  ),
  targetLang: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  keyPrefix: PropTypes.string.isRequired,
};

export default GrammarExampleList;
