import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { MousePointerClick } from "lucide-react";

/**
 * TapWordHint — "tap a word to look it up, hold it to bank it".
 *
 * Shown above practice-language text wherever `TappableParagraph` is used.
 * Tapping a word for a definition is the feature readers are least likely to
 * discover on their own: nothing about a paragraph looks interactive until
 * you happen to click it.
 *
 * The keys live under `story.*` because the Tale Creator had the hint first;
 * moving them would leave every other locale without it until a fill.
 */
const TapWordHint = ({ isDarkMode }) => {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
      isDarkMode
        ? "border-slate-700 bg-slate-800/60 text-slate-400"
        : "border-slate-200 bg-slate-50 text-slate-500"
    }`}>
      <MousePointerClick size={14} className="shrink-0" />
      {/* Two keys, not one edited sentence: a fill only ever adds keys that
          are missing, so rewording an existing string would never reach the
          locales that already have it. */}
      <p className="text-xs font-bold">
        {t("story.tap_word_hint")}{" "}
        <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>
          {t("story.hold_word_hint")}
        </span>
      </p>
    </div>
  );
};

TapWordHint.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default TapWordHint;
