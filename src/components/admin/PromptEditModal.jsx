import { useState } from "react";
import PropTypes from "prop-types";
import { X, Save, Tag } from "lucide-react";
import NeoDropdown from "../NeoDropdown";
import ConfirmModal from "../ConfirmModal";
import { PrimaryButton, GhostButton } from "../ui";

const CATEGORY_OPTIONS = [
  { value: "exams", label: "Exams" },
  { value: "translation", label: "Translation" },
  { value: "dictionary", label: "Dictionary" },
  { value: "vocabulary-games", label: "Vocabulary Games" },
  { value: "audio", label: "Audio" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "unused", label: "Unused" },
];

const KNOWN_FIELDS = new Set([
  "id", "name", "description", "category", "status", "sourceFile", "sourceFunction",
  "variables", "template", "variants", "version", "createdAt", "updatedAt", "updatedBy",
]);

const inputClasses = (isDarkMode) => `w-full px-4 py-2.5 rounded-xl border-2 font-semibold text-sm outline-none transition-colors ${
  isDarkMode
    ? "bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-blue-400"
    : "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-600"
}`;

const labelClasses = (isDarkMode) => `block text-xs font-black uppercase tracking-widest mb-2 ${
  isDarkMode ? "text-slate-400" : "text-slate-500"
}`;

const PromptEditModal = ({ prompt, isDarkMode, isSaving, onSave, onClose }) => {
  const [name, setName] = useState(prompt.name ?? "");
  const [description, setDescription] = useState(prompt.description ?? "");
  const [category, setCategory] = useState(prompt.category ?? "exams");
  const [status, setStatus] = useState(prompt.status ?? "active");
  const [template, setTemplate] = useState(prompt.template ?? "");
  const [variants, setVariants] = useState(
    Array.isArray(prompt.variants) ? prompt.variants.map((v) => ({ ...v })) : null
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [rawError, setRawError] = useState(null);

  const extraKeys = Object.keys(prompt).filter((k) => !KNOWN_FIELDS.has(k));
  const [extraJson, setExtraJson] = useState(
    extraKeys.length > 0
      ? JSON.stringify(Object.fromEntries(extraKeys.map((k) => [k, prompt[k]])), null, 2)
      : ""
  );

  const updateVariant = (idx, text) => {
    setVariants((prev) => prev.map((v, i) => (i === idx ? { ...v, template: text } : v)));
  };

  const handleSaveClick = () => {
    setRawError(null);
    if (extraJson.trim()) {
      try {
        JSON.parse(extraJson);
      } catch {
        setRawError("Additional fields must be valid JSON.");
        return;
      }
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    const patch = { name, description, category, status };
    if (variants) {
      patch.variants = variants;
    } else {
      patch.template = template;
    }
    if (extraJson.trim()) {
      Object.assign(patch, JSON.parse(extraJson));
    }
    onSave(prompt.id, patch);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="prompt-edit-title">
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
            <Tag size={22} className="text-white" />
          </div>
          <div>
            <h2 id="prompt-edit-title" className={`text-xl font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Edit Prompt
            </h2>
            <p className={`text-xs font-mono ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{prompt.id}</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <label className={labelClasses(isDarkMode)}>Name</label>
            <input className={inputClasses(isDarkMode)} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className={labelClasses(isDarkMode)}>Description (what is this prompt for?)</label>
            <textarea rows={3} className={`${inputClasses(isDarkMode)} resize-none`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <NeoDropdown options={CATEGORY_OPTIONS} value={category} onChange={setCategory} isDarkMode={isDarkMode} label="Category" className="flex-1" />
            <NeoDropdown options={STATUS_OPTIONS} value={status} onChange={setStatus} isDarkMode={isDarkMode} label="Status" className="flex-1" />
          </div>

          {Array.isArray(prompt.variables) && prompt.variables.length > 0 && (
            <div>
              <label className={labelClasses(isDarkMode)}>Variables (informational)</label>
              <div className="flex flex-wrap gap-2">
                {prompt.variables.map((v) => (
                  <span
                    key={v.name}
                    title={v.description}
                    className={`px-2.5 py-1 rounded-full border-2 text-xs font-bold font-mono ${
                      isDarkMode ? "bg-slate-700 border-slate-600 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-600"
                    }`}
                  >
                    {`{{${v.name}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {variants ? (
            <div className="flex flex-col gap-4">
              <label className={labelClasses(isDarkMode)}>Variants</label>
              {variants.map((v, idx) => (
                <div key={v.key ?? idx}>
                  <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                    {v.label ?? v.key}
                  </p>
                  <textarea
                    rows={8}
                    className={`${inputClasses(isDarkMode)} font-mono resize-y`}
                    value={v.template}
                    onChange={(e) => updateVariant(idx, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <label className={labelClasses(isDarkMode)}>Template</label>
              <textarea
                rows={14}
                className={`${inputClasses(isDarkMode)} font-mono resize-y`}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              />
            </div>
          )}

          {extraKeys.length > 0 && (
            <div>
              <label className={labelClasses(isDarkMode)}>Additional fields (raw JSON)</label>
              <textarea
                rows={6}
                className={`${inputClasses(isDarkMode)} font-mono resize-y`}
                value={extraJson}
                onChange={(e) => setExtraJson(e.target.value)}
              />
              {rawError && <p className="text-rose-500 text-xs font-bold mt-1">{rawError}</p>}
            </div>
          )}
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
          title="Save Prompt Changes?"
          message={`This will overwrite "${prompt.name || prompt.id}" in Firestore.`}
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

PromptEditModal.propTypes = {
  prompt: PropTypes.object.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default PromptEditModal;
