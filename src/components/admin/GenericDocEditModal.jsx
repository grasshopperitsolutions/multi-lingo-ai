import { useState } from "react";
import PropTypes from "prop-types";
import { X, Save, FileJson } from "lucide-react";
import ConfirmModal from "../ConfirmModal";
import { PrimaryButton, GhostButton } from "../ui";

const textareaClasses = (isDarkMode) => `w-full px-4 py-3 rounded-xl border-2 font-mono text-xs outline-none transition-colors resize-y ${
  isDarkMode
    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-400"
    : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
}`;

/**
 * GenericDocEditModal — raw-JSON editor for any config doc that doesn't have
 * a dedicated form (currently Languages / Writing Systems, via
 * GenericDocsSection). Edits the document body as text and PUTs it back
 * with firestoreService.updateDocument(), which only touches the fields
 * present in the parsed JSON — keys removed from the text stay untouched in
 * Firestore rather than being deleted (see updateDocument's docstring).
 */
const GenericDocEditModal = ({ doc, isDarkMode, isSaving, onSave, onClose }) => {
  const { id, ...docFields } = doc;
  const [jsonText, setJsonText] = useState(JSON.stringify(docFields, null, 2));
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);

  const handleSaveClick = () => {
    try {
      JSON.parse(jsonText);
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
      return;
    }
    setError(null);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onSave(id, JSON.parse(jsonText));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="generic-doc-edit-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />

      <div
        className={`relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8 rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#1d4ed8] ${
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
            <FileJson size={22} className="text-white" />
          </div>
          <div>
            <h2 id="generic-doc-edit-title" className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Edit Document
            </h2>
            <p className={`text-xs font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{id}</p>
          </div>
        </div>

        <textarea
          rows={20}
          spellCheck={false}
          className={textareaClasses(isDarkMode)}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
        />
        {error && <p className="text-rose-500 text-xs font-bold mt-2">{error}</p>}

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
          title="Save Document Changes?"
          message={`This will overwrite the fields in "${id}" in Firestore with the edited JSON.`}
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

GenericDocEditModal.propTypes = {
  doc: PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default GenericDocEditModal;
