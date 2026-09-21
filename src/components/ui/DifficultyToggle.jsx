import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * DifficultyToggle.jsx
 *
 * Easy or hard, on the challenges that have a difficulty at all.
 *
 * **There were three copies and they had drifted.** Hangman and Scrambled Word
 * both drew the capsule — one `rounded-full` pill, heavy border, the selected
 * half filled solid — while the crossword had grown a pair of separate
 * `rounded-lg` buttons with a yellow fill and a hard shadow, which read as two
 * independent controls rather than one two-way choice. Same decision, three
 * implementations, and no way to keep them in step except by remembering to.
 *
 * What "hard" *means* is the caller's business and differs per game: in
 * Hangman and the crossword it is whether an accented letter has to be typed
 * as itself, in Scrambled Word it also re-deals the tiles. So this owns the
 * shape and nothing else — `value` is the hard-mode boolean and `onChange`
 * gets the new one.
 *
 * Fully controlled, like ToneChoice; the caller owns the value.
 */
const DifficultyToggle = ({ value, onChange, isDarkMode, className = "" }) => {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      className={`flex rounded-full border-4 overflow-hidden ${
        isDarkMode ? "border-slate-700" : "border-slate-900"
      } ${className}`}
    >
      {[false, true].map((isHard) => (
        <button
          key={String(isHard)}
          type="button"
          onClick={() => onChange(isHard)}
          aria-pressed={value === isHard}
          className={`px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
            value === isHard
              ? isDarkMode
                ? "bg-yellow-400 text-slate-900"
                : "bg-slate-900 text-white"
              : isDarkMode
                ? "bg-transparent text-slate-400 hover:text-white"
                : "bg-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          {isHard ? t("challenges.hard") : t("challenges.easy")}
        </button>
      ))}
    </div>
  );
};

DifficultyToggle.propTypes = {
  /** True is hard. */
  value: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  className: PropTypes.string,
};

export default DifficultyToggle;
