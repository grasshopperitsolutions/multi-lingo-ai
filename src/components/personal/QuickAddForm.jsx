import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import AutoGrowTextarea from "./AutoGrowTextarea";
import { personalInputClasses, personalLabelClasses } from "./fieldStyles";

/**
 * QuickAddForm
 *
 * The compose box for every personal list — one input per field and a button,
 * owning its own draft and clearing it once the add succeeds.
 *
 * Extracted from `PersonalListPage` rather than reimplemented for the dashboard
 * widgets: they write to the same collections through the same `add`, and two
 * copies of a form drift until one of them trims a field the other doesn't.
 *
 * Two shapes, one component:
 *
 *   - **Full** (the list pages) — every field, visible labels, a tall button.
 *   - **Compact** (`compact`, the widgets) — only the required fields, labels
 *     moved to `sr-only` so the placeholder carries them visually, tighter
 *     spacing. The optional third field on the phrasebook and the mistake
 *     journal (`note`, `why`) is the reflective one you write at a desk; the
 *     widget is for capturing something before you forget it.
 *
 * Labels stay in the DOM in both shapes. Placeholder-as-label is a real
 * accessibility failure, and `sr-only` costs nothing.
 */
const QuickAddForm = ({ fields, onAdd, isDarkMode, compact = false, addLabel }) => {
  const { t } = useTranslation();

  const visibleFields = compact ? fields.filter((f) => f.required !== false) : fields;

  const blank = () => Object.fromEntries(visibleFields.map((f) => [f.name, ""]));
  const [draft, setDraft] = useState(blank);
  const [isAdding, setIsAdding] = useState(false);

  const required = visibleFields.filter((f) => f.required !== false).map((f) => f.name);
  const canAdd = !isAdding && required.every((name) => draft[name]?.trim());

  const handleAdd = async () => {
    if (!canAdd) return;
    const data = Object.fromEntries(
      visibleFields.map((f) => [f.name, (draft[f.name] ?? "").trim()]),
    );
    setIsAdding(true);
    try {
      await onAdd(data);
      setDraft(blank());
    } finally {
      setIsAdding(false);
    }
  };

  const inputClasses = personalInputClasses(isDarkMode);
  const labelClasses = compact ? "sr-only" : personalLabelClasses(isDarkMode);

  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-3 sm:gap-4"}`}>
      {visibleFields.map((field) => (
        <div key={field.name}>
          <label className={labelClasses} htmlFor={`draft-${field.name}`}>
            {t(field.labelKey)}
          </label>
          {field.multiline ? (
            <textarea
              id={`draft-${field.name}`}
              value={draft[field.name]}
              onChange={(e) => setDraft((prev) => ({ ...prev, [field.name]: e.target.value }))}
              rows={compact ? 2 : (field.rows ?? 4)}
              placeholder={t(field.placeholderKey)}
              className={`${inputClasses} resize-y`}
            />
          ) : (
            <AutoGrowTextarea
              id={`draft-${field.name}`}
              value={draft[field.name]}
              onChange={(next) => setDraft((prev) => ({ ...prev, [field.name]: next }))}
              onSubmit={handleAdd}
              enterKeyHint="done"
              placeholder={t(field.placeholderKey)}
              className={inputClasses}
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        className={`w-full flex items-center justify-center gap-2 rounded-2xl border-4 font-black uppercase tracking-widest text-sm transition-all active:scale-95 ${
          compact ? "py-2.5" : "py-3.5 sm:py-4"
        } ${
          canAdd
            ? isDarkMode
              ? "bg-yellow-400 border-yellow-400 text-slate-900"
              : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"
            : isDarkMode
              ? "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
              : "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
        }`}
      >
        <Plus size={compact ? 16 : 18} />
        {addLabel ?? t("personal.add")}
      </button>
    </div>
  );
};

QuickAddForm.propTypes = {
  fields: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      labelKey: PropTypes.string.isRequired,
      placeholderKey: PropTypes.string.isRequired,
      multiline: PropTypes.bool,
      rows: PropTypes.number,
      /** Defaults to true; a field marked false can be left blank. */
      required: PropTypes.bool,
    }),
  ).isRequired,
  /** Receives the trimmed field map. Awaited — the draft clears only on success. */
  onAdd: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  /** Widget shape: required fields only, labels visually hidden, tighter. */
  compact: PropTypes.bool,
  addLabel: PropTypes.string,
};

export default QuickAddForm;
