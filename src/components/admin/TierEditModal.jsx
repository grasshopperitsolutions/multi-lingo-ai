import { useState } from "react";
import PropTypes from "prop-types";
import { X, Save, Layers } from "lucide-react";
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

/**
 * TierEditModal — edit one tier's daily AI allowance and feature allowlist
 * (appConfig/config/tiersConfig/{tierId}).
 *
 * The tier id is fixed: it is stored on every user profile as
 * `subscriptionTier` and referenced by the Stripe plan mapping, so renaming one
 * here would orphan those users.
 *
 * Leaving the AI calls field blank means unlimited — Firestore has no Infinity,
 * so it is persisted as null.
 */
const TierEditModal = ({ tier, allFeatures, isDarkMode, isSaving, onSave, onClose }) => {
  const [label, setLabel] = useState(tier.label ?? "");
  const [order, setOrder] = useState(tier.order != null ? String(tier.order) : "");
  const [isFree, setIsFree] = useState(Boolean(tier.isFree));
  const [hidden, setHidden] = useState(Boolean(tier.hidden));
  const [aiCalls, setAiCalls] = useState(
    tier.aiCallsPerDay === Infinity ? "" : String(tier.aiCallsPerDay ?? "")
  );
  const [features, setFeatures] = useState(() => new Set(tier.features ?? []));
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const isAdminTier = tier.id === "admin";
  const allKeys = allFeatures.map((f) => f.id);

  const toggleFeature = (key) => {
    setFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setAll = (keys) => setFeatures(new Set(keys));

  const handleSaveClick = () => {
    setValidationError(null);
    if (!label.trim()) {
      setValidationError("Label is required.");
      return;
    }
    if (aiCalls.trim() && (!Number.isFinite(Number(aiCalls)) || Number(aiCalls) < 0)) {
      setValidationError("AI calls must be a non-negative number, or blank for unlimited.");
      return;
    }
    if (order.trim() && (!Number.isFinite(Number(order)) || Number(order) < 0)) {
      setValidationError("Order must be a non-negative number.");
      return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    onSave(tier.id, {
      label: label.trim(),
      order: order.trim() ? Number(order) : 0,
      isFree,
      hidden,
      aiCallsPerDay: aiCalls.trim() === "" ? Infinity : Number(aiCalls),
      features: [...features],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tier-edit-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isSaving ? undefined : onClose} />

      <div
        className={`relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-[2rem] border-4 shadow-[8px_8px_0px_0px_#1d4ed8] ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900"
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <h2
            id="tier-edit-title"
            className={`flex items-center gap-2 text-xl font-black uppercase tracking-widest ${isDarkMode ? "text-white" : "text-slate-900"}`}
          >
            <Layers size={20} />
            {tier.label}
            <code className={`text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{tier.id}</code>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tier-label" className={labelClasses(isDarkMode)}>Label</label>
              <input
                id="tier-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputClasses(isDarkMode)}
              />
            </div>
            <div>
              <label htmlFor="tier-order" className={labelClasses(isDarkMode)}>Display order</label>
              <input
                id="tier-order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                inputMode="numeric"
                className={inputClasses(isDarkMode)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="tier-ai-calls" className={labelClasses(isDarkMode)}>AI calls per day</label>
            <input
              id="tier-ai-calls"
              value={aiCalls}
              onChange={(e) => setAiCalls(e.target.value)}
              inputMode="numeric"
              placeholder="Leave blank for unlimited"
              className={inputClasses(isDarkMode)}
            />
            <p className={`mt-1 text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Display and client-side UX only — the backend enforces the real allowance. Keep the two in step.
            </p>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className={`flex items-center gap-2 text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="w-4 h-4" />
              Free (no payment required)
            </label>
            <label className={`flex items-center gap-2 text-sm font-bold ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
              <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="w-4 h-4" />
              Hidden from pricing page
            </label>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <span className={labelClasses(isDarkMode) + " !mb-0"}>
                Feature access ({features.size} of {allKeys.length})
              </span>
              <div className="flex gap-2">
                <GhostButton onClick={() => setAll(allKeys)} isDarkMode={isDarkMode} className="!px-3 !py-1 !text-xs">All</GhostButton>
                <GhostButton onClick={() => setAll([])} isDarkMode={isDarkMode} className="!px-3 !py-1 !text-xs">None</GhostButton>
              </div>
            </div>

            {isAdminTier && (
              <p className={`mb-3 text-xs font-bold ${isDarkMode ? "text-amber-400" : "text-amber-700"}`}>
                Admin bypasses feature gating in code. Changes here will not restrict an admin account.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {allFeatures.map((feature) => (
                <label
                  key={feature.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 text-sm font-semibold cursor-pointer transition-colors ${
                    features.has(feature.id)
                      ? isDarkMode
                        ? "bg-blue-900/40 border-blue-500 text-blue-200"
                        : "bg-blue-50 border-blue-500 text-blue-900"
                      : isDarkMode
                        ? "border-slate-600 text-slate-400 hover:bg-slate-700/50"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={features.has(feature.id)}
                    onChange={() => toggleFeature(feature.id)}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className="truncate">{feature.label}</span>
                </label>
              ))}
            </div>
          </div>

          {validationError && <p className="font-bold text-rose-500 text-sm">{validationError}</p>}

          <div className="flex gap-3 justify-end">
            <GhostButton onClick={onClose} isDarkMode={isDarkMode} disabled={isSaving}>Cancel</GhostButton>
            <PrimaryButton onClick={handleSaveClick} isDarkMode={isDarkMode} disabled={isSaving}>
              <Save size={16} /> {isSaving ? "Saving..." : "Save Tier"}
            </PrimaryButton>
          </div>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title="Save tier config?"
          message={`This changes limits and feature access for every "${tier.label}" user immediately.`}
          confirmLabel="Yes, save"
          confirmColor="yellow"
          isLoading={isSaving}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
};

TierEditModal.propTypes = {
  allFeatures: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string })
  ),
  tier: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string,
    order: PropTypes.number,
    isFree: PropTypes.bool,
    hidden: PropTypes.bool,
    aiCallsPerDay: PropTypes.number,
    features: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

TierEditModal.defaultProps = {
  allFeatures: [],
  isSaving: false,
};

export default TierEditModal;
