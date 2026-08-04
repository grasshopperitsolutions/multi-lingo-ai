import { useState } from "react";
import PropTypes from "prop-types";
import { X, Save, Tag } from "lucide-react";
import ConfirmModal from "../ConfirmModal";
import { PrimaryButton, GhostButton } from "../ui";

const inputClasses = (isDarkMode) => `w-full px-4 py-2.5 rounded-xl border-2 font-semibold text-sm outline-none transition-colors ${
  isDarkMode
    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-400"
    : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
}`;

const labelClasses = (isDarkMode) => `block text-xs font-black uppercase tracking-widest mb-2 ${
  isDarkMode ? "text-slate-400" : "text-slate-500"
}`;

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * CategoryEditModal — create/edit an interest category (appConfig/config/categories).
 * `category` is null when creating a new one, or the existing doc `{ id, label, order }` when editing.
 * The slug (id) is only editable on create — it's referenced by existing user
 * profiles' `interests` arrays, so renaming it would silently orphan their picks.
 */
const CategoryEditModal = ({ category, isDarkMode, isSaving, onSave, onClose }) => {
  const isNew = !category;
  const [label, setLabel] = useState(category?.label ?? "");
  const [order, setOrder] = useState(category?.order != null ? String(category.order) : "");
  const [id, setId] = useState(category?.id ?? "");
  const [idManuallyEdited, setIdManuallyEdited] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const handleLabelChange = (value) => {
    setLabel(value);
    if (isNew && !idManuallyEdited) {
      setId(slugify(value));
    }
  };

  const handleIdChange = (value) => {
    setIdManuallyEdited(true);
    setId(slugify(value));
  };

  const handleSaveClick = () => {
    setValidationError(null);
    if (!label.trim()) {
      setValidationError("Label is required.");
      return;
    }
    if (!id.trim()) {
      setValidationError("Slug (ID) is required.");
      return;
    }
    if (order.trim() && (!Number.isFinite(Number(order)) || Number(order) < 0)) {
      setValidationError("Order must be a non-negative number.");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const data = { label: label.trim() };
    if (order.trim()) data.order = Number(order);
    onSave(id.trim(), data, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="category-edit-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />

      <div
        className={`relative z-10 w-full max-w-md p-8 rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#1d4ed8] ${
          isDarkMode ? "bg-slate-800 border-blue-500" : "bg-white border-blue-600"
        }`}
      >
        <button
          onClick={onClose}
          disabled={isSaving}
          className={`absolute top-5 right-5 p-1 rounded-lg transition-colors disabled:opacity-40 ${
            isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900"
          }`}
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl border-4 border-slate-900 flex items-center justify-center shrink-0 bg-blue-600">
            <Tag size={22} className="text-white" />
          </div>
          <div>
            <h2 id="category-edit-title" className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {isNew ? "New Category" : "Edit Category"}
            </h2>
            {!isNew && <p className={`text-xs font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{category.id}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClasses(isDarkMode)}>Label</label>
            <input
              className={inputClasses(isDarkMode)}
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="e.g. Food"
            />
          </div>

          <div>
            <label className={labelClasses(isDarkMode)}>Slug (ID)</label>
            <input
              className={`${inputClasses(isDarkMode)} font-mono ${!isNew ? "opacity-50 cursor-not-allowed" : ""}`}
              value={id}
              onChange={(e) => handleIdChange(e.target.value)}
              disabled={!isNew}
              placeholder="e.g. food"
            />
            {isNew && (
              <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                Stored on user profiles — cannot be changed after creation.
              </p>
            )}
          </div>

          <div>
            <label className={labelClasses(isDarkMode)}>Order (optional)</label>
            <input
              type="number"
              min="0"
              className={inputClasses(isDarkMode)}
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              placeholder="Lower numbers show first"
            />
          </div>

          {validationError && <p className="text-rose-500 text-xs font-bold">{validationError}</p>}
        </div>

        <div className="flex gap-3 mt-8">
          <PrimaryButton onClick={handleSaveClick} disabled={isSaving} loading={isSaving} isDarkMode={isDarkMode} color="sky">
            <Save size={16} />
            Save
          </PrimaryButton>
          <GhostButton onClick={onClose} disabled={isSaving} isDarkMode={isDarkMode}>
            Cancel
          </GhostButton>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={isNew ? "Create Category?" : "Save Category Changes?"}
          message={isNew
            ? `This will create "${label}" (${id}) in Firestore.`
            : `This will update "${category.id}" in Firestore.`}
          confirmLabel="Save"
          confirmColor="yellow"
          isLoading={isSaving}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

CategoryEditModal.propTypes = {
  category: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    order: PropTypes.number,
  }),
  isDarkMode: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CategoryEditModal;
