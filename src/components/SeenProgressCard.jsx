import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Loader2, RotateCcw } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import { seenPercent } from "../utils/seenPercent";

/**
 * SeenProgressCard — how much of a shared pool the reader has been through,
 * and the way to start it again.
 *
 * The challenges' "words seen" card, for the Tale Creator and the culture
 * pieces. Presentational: the page owns the counts and the reset.
 *
 * The bar counts what is in the pool the page draws from (a level and a
 * language for tales), while the reset clears every seen id of that kind, so
 * `resetDisabled` is the caller's to decide, not "the bar is empty".
 */
const SeenProgressCard = ({
  title,
  seenCount = 0,
  totalCount = null,
  isLoading = false,
  onReset,
  resetDisabled = false,
  resetLabel,
  resetTitle,
  resetMessage,
  resetWarning,
  resetConfirmLabel,
  isDarkMode,
}) => {
  const { t } = useTranslation();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const pct = seenPercent(seenCount, totalCount);
  const labelClass = isDarkMode ? "text-slate-400" : "text-slate-500";

  const handleConfirm = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      {showConfirm && (
        <ConfirmModal
          isDarkMode={isDarkMode}
          title={resetTitle}
          message={resetMessage}
          warning={resetWarning}
          confirmLabel={resetConfirmLabel}
          confirmColor="yellow"
          isLoading={isResetting}
          onConfirm={handleConfirm}
          onCancel={() => !isResetting && setShowConfirm(false)}
        />
      )}

      <div className={`rounded-2xl border-4 p-4 flex flex-col gap-3 ${
        isDarkMode
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
      }`}>
        <p className={`font-black uppercase text-xs tracking-widest ${labelClass}`}>{title}</p>

        {isLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 size={20} className="animate-spin opacity-40" />
          </div>
        ) : (
          <>
            <div className={`w-full h-4 rounded-full border-2 overflow-hidden ${
              isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-300"
            }`}>
              <div
                className="h-full bg-yellow-400 transition-all duration-500 rounded-full"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-label={title}
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={99}
              />
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-2xl font-black tabular-nums ${isDarkMode ? "text-yellow-400" : "text-slate-900"}`}>
                {pct}%
              </span>
              <span className={`text-xs font-bold tabular-nums ${labelClass}`}>
                {t("seen_progress.count", { seen: seenCount, total: totalCount ?? 0 })}
              </span>
            </div>
          </>
        )}

        {/* Rose, like the challenges' reset: it forgets everything of this
            kind the reader has been shown, on every device. */}
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={resetDisabled}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-rose-500 font-black uppercase text-[11px] tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-rose-500"
        >
          <RotateCcw size={12} />
          {resetLabel}
        </button>
      </div>
    </>
  );
};

SeenProgressCard.propTypes = {
  title: PropTypes.string.isRequired,
  /** Seen items in the pool the page draws from. */
  seenCount: PropTypes.number,
  totalCount: PropTypes.number,
  isLoading: PropTypes.bool,
  onReset: PropTypes.func.isRequired,
  resetDisabled: PropTypes.bool,
  resetLabel: PropTypes.string.isRequired,
  resetTitle: PropTypes.string.isRequired,
  resetMessage: PropTypes.string.isRequired,
  resetWarning: PropTypes.string,
  resetConfirmLabel: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default SeenProgressCard;
