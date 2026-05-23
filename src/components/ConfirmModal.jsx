import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2, X } from "lucide-react";

/**
 * ConfirmModal — reusable confirmation dialog.
 *
 * Props:
 *   isDarkMode    boolean
 *   title         string
 *   message       string | ReactNode
 *   warning       string | null       — secondary warning line (optional)
 *   confirmLabel  string
 *   confirmColor  'rose' | 'yellow'   — button colour scheme
 *   icon          ReactNode           — defaults to AlertTriangle
 *   isLoading     boolean
 *   onConfirm     () => void
 *   onCancel      () => void
 */
const ConfirmModal = ({
  isDarkMode,
  title,
  message,
  warning,
  confirmLabel,
  confirmColor = "rose",
  icon,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const isRose   = confirmColor === "rose";
  const iconBg   = isRose ? "bg-rose-500" : "bg-yellow-400";
  const iconText = isRose ? "text-white"  : "text-slate-900";
  const shadow   = isRose ? "shadow-[8px_8px_0px_0px_#f43f5e]" : "shadow-[8px_8px_0px_0px_#ca8a04]";
  const border   = isRose ? "border-rose-500"   : "border-yellow-400";
  const btnBg    = isRose ? "bg-rose-500 hover:bg-rose-600 border-rose-500 hover:border-rose-600 shadow-[4px_4px_0px_0px_#be123c] text-white"
                          : "bg-yellow-400 hover:bg-yellow-300 border-yellow-400 hover:border-yellow-300 shadow-[4px_4px_0px_0px_#854d0e] text-slate-900";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={isLoading ? undefined : onCancel}
      />

      {/* Panel */}
      <div
        className={`relative z-10 w-full max-w-md p-8 rounded-[2rem] border-4 ${shadow} ${
          isDarkMode
            ? `bg-slate-800 ${border}`
            : `bg-white ${border}`
        }`}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          disabled={isLoading}
          aria-label={t("common.close")}
          className={`absolute top-5 right-5 p-1 rounded-lg transition-colors disabled:opacity-40 ${
            isDarkMode
              ? "text-slate-400 hover:text-white"
              : "text-slate-400 hover:text-slate-900"
          }`}
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className={`w-12 h-12 rounded-2xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${iconBg}`}
          >
            <span className={iconText}>
              {icon ?? <AlertTriangle size={24} />}
            </span>
          </div>
          <h2
            id="confirm-modal-title"
            className={`text-xl font-black uppercase tracking-tight ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {title}
          </h2>
        </div>

        {/* Message */}
        <p
          className={`font-semibold leading-relaxed mb-4 ${
            isDarkMode ? "text-slate-300" : "text-slate-700"
          }`}
        >
          {message}
        </p>

        {/* Optional warning line */}
        {warning && (
          <p
            className={`text-sm font-bold uppercase tracking-widest mb-8 ${
              isRose
                ? isDarkMode ? "text-rose-400"   : "text-rose-600"
                : isDarkMode ? "text-yellow-400" : "text-yellow-600"
            }`}
          >
            {warning}
          </p>
        )}

        {!warning && <div className="mb-8" />}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${btnBg}`}
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> {t("confirm_modal.loading")}</>
            ) : (
              confirmLabel
            )}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={`w-full flex items-center justify-center gap-3 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 shadow-[4px_4px_0px_0px_#0f172a] disabled:opacity-60 ${
              isDarkMode
                ? "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                : "bg-white border-slate-900 text-slate-900 hover:bg-slate-100"
            }`}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmModal.propTypes = {
  isDarkMode:   PropTypes.bool.isRequired,
  title:        PropTypes.string.isRequired,
  message:      PropTypes.node.isRequired,
  warning:      PropTypes.string,
  confirmLabel: PropTypes.string.isRequired,
  confirmColor: PropTypes.oneOf(["rose", "yellow"]),
  icon:         PropTypes.node,
  isLoading:    PropTypes.bool.isRequired,
  onConfirm:    PropTypes.func.isRequired,
  onCancel:     PropTypes.func.isRequired,
};

export default ConfirmModal;
