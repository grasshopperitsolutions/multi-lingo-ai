import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { TONES } from "../../config/professionalTools";

/**
 * ToneToggle.jsx
 *
 * Formal or informal, on every professional tool page.
 *
 * Visually this is the app's existing easy/hard control — the pill the games
 * use (Hangman, Scrambled Word, Crossword): one `rounded-full` capsule with a
 * heavy border, the selected half filled solid and the other transparent. That
 * control already teaches people what a two-way choice looks like here, so
 * borrowing it means the tone switch needs no learning at all. The padding is
 * the one deliberate difference: the games sit it in a HUD at `py-1.5`, while
 * this one is a form control on a page people use standing up, so each half is
 * a comfortable thumb target.
 *
 * A segmented pair rather than a checkbox: a checkbox makes one register the
 * absence of the other, and "not formal" is not the same idea as "informal" —
 * the user is choosing between two ways of writing, not switching something
 * off. Both halves are real buttons, both keyboard-reachable, both carrying
 * `aria-pressed`.
 *
 * Fully controlled; the caller owns the value and the persisting.
 */
const ToneToggle = ({ value, onChange, isDarkMode, disabled = false }) => {
  const { t } = useTranslation();

  const options = [
    { value: TONES.FORMAL, label: t("professional.tone_formal") },
    { value: TONES.INFORMAL, label: t("professional.tone_informal") },
  ];

  return (
    <div
      className={`inline-flex rounded-full border-4 overflow-hidden ${
        isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-900 bg-white"
      } ${disabled ? "opacity-50" : ""}`}
      role="group"
      aria-label={t("professional.tone_label")}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            aria-pressed={isActive}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${
              isActive
                ? isDarkMode
                  ? "bg-yellow-400 text-slate-900"
                  : "bg-slate-900 text-white"
                : isDarkMode
                  ? "bg-transparent text-slate-400 hover:text-white"
                  : "bg-transparent text-slate-500 hover:text-slate-900"
            } ${disabled ? "cursor-not-allowed" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

ToneToggle.propTypes = {
  value: PropTypes.oneOf(Object.values(TONES)).isRequired,
  onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
};

export default ToneToggle;
