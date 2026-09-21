import PropTypes from "prop-types";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TONES } from "../../config/professionalTools";

/**
 * ToneChoice.jsx
 *
 * Which register to write in, on every professional tool page.
 *
 * **This replaced a two-way pill**, and the shape had to change with the
 * count. A segmented capsule reads as one either/or decision, which is exactly
 * what the old formal/informal switch was; three registers are a scale, and a
 * scale wants to be seen all at once with the differences between the steps
 * legible. So: real radios, stacked, each with a line saying what it is for.
 *
 * Real `<input type="radio">` rather than buttons with `aria-checked`, because
 * a radio group is one of the few controls browsers already do properly —
 * arrow keys move between options, the group takes one tab stop, and screen
 * readers announce "2 of 3" without being told. The visible control is the
 * styled `<span>`; the input itself is `sr-only` and still the thing being
 * clicked, since the whole row is a `<label>`.
 *
 * Fully controlled; the caller owns the value and the persisting.
 */

/** The order they are offered in: most formal at the top, easing downwards. */
const ORDER = [TONES.HIGHLY_FORMAL, TONES.PROFESSIONAL, TONES.INFORMAL];

const COPY = {
  [TONES.HIGHLY_FORMAL]: { label: "professional.tone_highly_formal", hint: "professional.tone_highly_formal_hint" },
  [TONES.PROFESSIONAL]: { label: "professional.tone_professional", hint: "professional.tone_professional_hint" },
  [TONES.INFORMAL]: { label: "professional.tone_informal", hint: "professional.tone_informal_hint" },
};

const ToneChoice = ({ value, onChange, isDarkMode, disabled = false, className = "" }) => {
  const { t } = useTranslation();
  // One name per mounted group, so two on a page could never share a selection.
  const groupName = useId();

  return (
    <fieldset disabled={disabled} className={`min-w-0 ${disabled ? "opacity-50" : ""} ${className}`}>
      <legend
        className={`font-black uppercase text-xs tracking-widest mb-2 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}
      >
        {t("professional.tone_label")}
      </legend>

      <div className="flex flex-col gap-2">
        {ORDER.map((tone) => {
          const isActive = value === tone;
          return (
            <label
              key={tone}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border-4 transition-all ${
                disabled ? "cursor-not-allowed" : "cursor-pointer"
              } ${
                isActive
                  ? isDarkMode
                    ? "bg-slate-700 border-yellow-400"
                    : "bg-yellow-50 border-slate-900 shadow-[3px_3px_0px_0px_#0f172a]"
                  : isDarkMode
                    ? "bg-slate-800 border-slate-700 hover:border-slate-500"
                    : "bg-white border-slate-300 hover:border-slate-900"
              }`}
            >
              <input
                type="radio"
                name={groupName}
                value={tone}
                checked={isActive}
                onChange={() => onChange(tone)}
                // Also set per input, not left to the fieldset: a disabled
                // fieldset makes its controls non-interactive but leaves each
                // input's own `disabled` false, so anything reading the DOM —
                // a test, a screen reader shim — sees an enabled radio.
                disabled={disabled}
                className="sr-only peer"
              />

              {/* The dot. `peer-focus-visible` puts the ring on the visible
                  control, since the input it belongs to is off-screen. */}
              <span
                aria-hidden="true"
                className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-4 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 ${
                  isDarkMode
                    ? "peer-focus-visible:ring-yellow-400 peer-focus-visible:ring-offset-slate-800"
                    : "peer-focus-visible:ring-blue-600 peer-focus-visible:ring-offset-white"
                } ${
                  isActive
                    ? isDarkMode
                      ? "border-yellow-400 bg-yellow-400"
                      : "border-slate-900 bg-slate-900"
                    : isDarkMode
                      ? "border-slate-500"
                      : "border-slate-400"
                }`}
              />

              <span className="min-w-0">
                <span
                  className={`block font-black uppercase text-xs tracking-widest ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  {t(COPY[tone].label)}
                </span>
                <span
                  className={`block text-[11px] font-bold leading-snug mt-0.5 ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {t(COPY[tone].hint)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

ToneChoice.propTypes = {
  value: PropTypes.oneOf(Object.values(TONES)).isRequired,
  onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};

export default ToneChoice;
