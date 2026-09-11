import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { X, BookMarked } from "lucide-react";
import { useWordFavourites } from "../hooks/useWordFavourites";
import { SettingsSection } from "./ui";

/**
 * WordBankSection
 *
 * The word bank's management view, in Settings: every word collected while
 * reading, and nothing to do with them but remove the ones that have stopped
 * being useful. Selecting words for a story belongs on the story page, where
 * the story actually gets generated — this is the housekeeping surface.
 *
 * Reads straight from the loaded profile through useWordFavourites, so it
 * costs no request to render and stays in step with the story page's sidebar
 * without either knowing about the other.
 */
const WordBankSection = ({ isDarkMode, defaultOpen }) => {
  const { t } = useTranslation();
  const { words, remove } = useWordFavourites();

  return (
    <SettingsSection
      title={t("word_bank.settings_title")}
      // The same mark the sidebar carries on the story page, so the two read
      // as one feature in two places.
      icon={<BookMarked size={16} className="inline mr-2" />}
      isDarkMode={isDarkMode}
      defaultOpen={defaultOpen}
    >
      <p className={`text-sm font-bold mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {t("word_bank.settings_description")}
      </p>

      {words.length === 0 ? (
        <p className={`text-sm font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {t("word_bank.settings_empty")}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {words.map((word) => (
            <span
              key={word}
              className={`relative inline-flex items-center pl-3 pr-6 py-1.5 rounded-full border-2 font-bold text-sm ${
                isDarkMode
                  ? "bg-slate-900 border-slate-700 text-slate-200"
                  : "bg-slate-50 border-slate-300 text-slate-700"
              }`}
            >
              {word}
              <button
                type="button"
                onClick={() => remove(word)}
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
          ))}
        </div>
      )}
    </SettingsSection>
  );
};

WordBankSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  defaultOpen: PropTypes.bool,
};

export default WordBankSection;
