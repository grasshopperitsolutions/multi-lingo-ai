import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { accentsFor } from "../../utils/accentCharacters";

/**
 * A row of buttons that type a character into the input the page points it
 * at, at the cursor. `onMouseDown` + preventDefault keeps focus in the input,
 * so the caret stays where the learner left it.
 */
const AccentBar = ({ dialect, inputRef, value, onChange, isDarkMode }) => {
  const { t } = useTranslation();
  const chars = accentsFor(dialect);
  if (chars.length === 0) return null;

  const insert = (char) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + char + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("grammar_practice.accent_bar")}>
      {chars.map((char) => (
        <button
          key={char}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert(char)}
          className={`w-9 h-9 rounded-lg border-2 font-bold text-base transition-colors ${
            isDarkMode
              ? "bg-slate-800 border-slate-600 text-slate-100 hover:border-amber-400"
              : "bg-white border-slate-300 text-slate-800 hover:border-amber-500"
          }`}
        >
          {char}
        </button>
      ))}
    </div>
  );
};

AccentBar.propTypes = {
  dialect: PropTypes.string,
  inputRef: PropTypes.shape({ current: PropTypes.any }).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default AccentBar;
