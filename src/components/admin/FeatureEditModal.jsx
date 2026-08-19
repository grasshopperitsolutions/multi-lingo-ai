import { useState } from "react";
import PropTypes from "prop-types";
import { X, Save, ToggleLeft } from "lucide-react";
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
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * FeatureEditModal — create/edit one gateable feature
 * (appConfig/config/features/{featureKey}).
 *
 * The key is only editable on create. Components gate on it as a string
 * literal (`canAccess("full_exam")`, dashboard tile ids) and tier documents
 * store it in their `features` array, so renaming one would silently revoke
 * the feature everywhere it is granted.
 */
const FeatureEditModal = ({ feature, isDarkMode, isSaving, onSave, onClose }) => {
  const isNew = !feature;
  const [label, setLabel] = useState(feature?.label ?? "");
  const [key, setKey] = useState(feature?.id ?? "");
  const [labelKey, setLabelKey] = useState(feature?.labelKey ?? "");
  const [order, setOrder] = useState(feature?.order != null ? String(feature.order) : "");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const handleLabelChange = (value) => {
    setLabel(value);
    if (isNew && !keyManuallyEdited) setKey(slugify(value));
  };

  const handleSaveClick = () => {
    setValidationError(null);
    if (!label.trim()) {
      setValidationError("Label is required.");
      return;
    }
    if (!key.trim()) {
      setValidationError("Key is required.");
      return;
    }
    if (order.trim() && (!Number.isFinite(Number(order)) || Number(order) < 0)) {
      setValidationError("Order must be a non-negative number.");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onSave(key.trim(), {
      label: label.trim(),
      labelKey: labelKey.trim(),
      order: order.trim() ? Number(order) : 0,
    }, isNew);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="feature-edit-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />

      <div
        className={`relative z-10 w-full max-w-md p-8 rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#1d4ed8] ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2
            id="feature-edit-title"
            className={`flex items-center gap-2 text-xl font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            <ToggleLeft size={20} />
            {isNew ? "New Feature" : "Edit Feature"}
          </h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
            className={`p-2 rounded-xl transition-colors ${isDarkMode ? "text-slate-400 hover:bg-slate-700" : "text-slate-500 hover:bg-slate-100"}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label htmlFor="feature-label" className={labelClasses(isDarkMode)}>Label</label>
            <input
              id="feature-label"
              value={label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="Full Exam"
              className={inputClasses(isDarkMode)}
            />
            <p className={`mt-1 text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Shown in this admin panel, and used as the fallback if the translation key below is missing.
            </p>
          </div>

          <div>
            <label htmlFor="feature-key" className={labelClasses(isDarkMode)}>Key</label>
            <input
              id="feature-key"
              value={key}
              onChange={(e) => { setKeyManuallyEdited(true); setKey(slugify(e.target.value)); }}
              disabled={!isNew}
              placeholder="full_exam"
              className={`${inputClasses(isDarkMode)} ${!isNew ? "opacity-60 cursor-not-allowed" : ""}`}
            />
            <p className={`mt-1 text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {isNew
                ? "Must match the key the code gates on. Cannot be changed later."
                : "Fixed — the code and every tier's grant list reference this key."}
            </p>
          </div>

          <div>
            <label htmlFor="feature-label-key" className={labelClasses(isDarkMode)}>Translation key</label>
            <input
              id="feature-label-key"
              value={labelKey}
              onChange={(e) => setLabelKey(e.target.value)}
              placeholder="dashboard.translator"
              className={inputClasses(isDarkMode)}
            />
            <p className={`mt-1 text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Name shown to users on the pricing page, in their own language. Reuse an existing key where one exists.
            </p>
          </div>

          <div>
            <label htmlFor="feature-order" className={labelClasses(isDarkMode)}>Order</label>
            <input
              id="feature-order"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              inputMode="numeric"
              placeholder="10"
              className={inputClasses(isDarkMode)}
            />
            <p className={`mt-1 text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Sort order everywhere features are listed. The pricing page shows the first few and collapses the rest, so put the strongest selling points lowest.
            </p>
          </div>

          {validationError && <p className="font-bold text-rose-500 text-sm">{validationError}</p>}

          <div className="flex gap-3 justify-end">
            <GhostButton onClick={onClose} isDarkMode={isDarkMode} disabled={isSaving}>Cancel</GhostButton>
            <PrimaryButton onClick={handleSaveClick} isDarkMode={isDarkMode} disabled={isSaving}>
              <Save size={16} /> {isSaving ? "Saving..." : "Save Feature"}
            </PrimaryButton>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={isNew ? "Create feature?" : "Save feature?"}
          message={
            isNew
              ? `"${key}" will be created. It is granted to nobody until you add it to a tier, so users will see it as "Coming Soon".`
              : `This changes how "${key}" is labelled and ordered for every user.`
          }
          confirmLabel={isNew ? "Yes, create" : "Yes, save"}
          confirmColor="yellow"
          isLoading={isSaving}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

FeatureEditModal.propTypes = {
  feature: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    labelKey: PropTypes.string,
    order: PropTypes.number,
  }),
  isDarkMode: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

FeatureEditModal.defaultProps = {
  feature: null,
  isSaving: false,
};

export default FeatureEditModal;
