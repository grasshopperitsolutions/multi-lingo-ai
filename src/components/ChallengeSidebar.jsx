import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, RotateCcw, Loader2, Trophy, Clock, Hash } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO timestamp as a relative human-readable string. */
function _relativeTime(isoString, t) {
  if (!isoString) return t("challenges.sidebar.never");
  const diff = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return t("challenges.sidebar.just_now");
  if (mins  < 60) return t("challenges.sidebar.minutes_ago", { count: mins });
  if (hours < 24) return t("challenges.sidebar.hours_ago",   { count: hours });
  return t("challenges.sidebar.days_ago", { count: days });
}

/** Compute seen-words percentage, capped at 99. */
function _seenPercent(seenCount, totalCount) {
  if (!totalCount || totalCount === 0) return 0;
  return Math.min(99, Math.round((seenCount / totalCount) * 100));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatRow = ({ icon, label, value, isDarkMode }) => (
  <div className="flex items-center gap-3">
    <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>{icon}</span>
    <span className={`text-xs font-black uppercase tracking-widest ${
      isDarkMode ? "text-slate-400" : "text-slate-500"
    }`}>
      {label}
    </span>
    <span className={`ml-auto font-black text-sm ${
      isDarkMode ? "text-white" : "text-slate-900"
    }`}>
      {value}
    </span>
  </div>
);

StatRow.propTypes = {
  icon:       PropTypes.node.isRequired,
  label:      PropTypes.string.isRequired,
  value:      PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * ChallengeSidebar — pure UI component.
 *
 * Fully presentational: no fetching, no service imports.
 * The parent (HangmanGame, ScrambledWordGame, etc.) owns all state
 * and passes data + callbacks down.
 *
 * Props:
 *   isDarkMode      boolean
 *   seenCount       number                — global seen words count (users/{uid}.seenConceptIds.length)
 *   progress        UserGameProgress | null
 *                     shape: { totalPlayed, lastPlayedAt, learningDialect }
 *                     NOTE: seenConceptIds is no longer part of this shape.
 *   totalWords      number | null         — total word pool size
 *   isLoadingStats  boolean
 *   onReset         () => Promise<void>   — called when the user confirms reset
 *
 *   // Modal copy — lets each game customise the reset dialog text
 *   resetTitle      string
 *   resetMessage    string
 *   resetWarning    string                — optional second line in the modal
 *   resetConfirmLabel string
 *
 *   // Sidebar heading
 *   title           string
 */
const ChallengeSidebar = ({
  isDarkMode,
  seenCount,
  progress,
  totalWords,
  isLoadingStats,
  onReset,
  resetTitle,
  resetMessage,
  resetWarning,
  resetConfirmLabel,
  title,
}) => {
  const { t } = useTranslation();

  const [collapsed,   setCollapsed]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const pct         = _seenPercent(seenCount, totalWords);
  const totalPlayed = progress?.totalPlayed ?? 0;
  const lastPlayed  = _relativeTime(progress?.lastPlayedAt, t);

  const handleResetConfirm = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
      setShowConfirm(false);
    }
  };

  // ── Collapsed toggle button ──────────────────────────────────────────────
  const toggleBtn = (
    <button
      onClick={() => setCollapsed((v) => !v)}
      aria-label={collapsed ? t("challenges.sidebar.expand") : t("challenges.sidebar.collapse")}
      className={`flex items-center justify-center w-7 h-7 rounded-lg border-2 transition-colors shrink-0 ${
        isDarkMode
          ? "border-slate-600 text-slate-400 hover:border-yellow-400 hover:text-yellow-400"
          : "border-slate-300 text-slate-400 hover:border-slate-900 hover:text-slate-900"
      }`}
    >
      {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  );

  // ── Collapsed state — thin vertical strip ────────────────────────────────
  if (collapsed) {
    return (
      <aside
        className={`hidden lg:flex flex-col items-center pt-6 gap-4 w-10 rounded-2xl border-4 transition-all ${
          isDarkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
        }`}
      >
        {toggleBtn}
      </aside>
    );
  }

  // ── Expanded state ────────────────────────────────────────────────────────
  const panelBase = `rounded-2xl border-4 p-5 ${
    isDarkMode
      ? "bg-slate-800 border-slate-700"
      : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
  }`;

  const divider = <hr className={isDarkMode ? "border-slate-700" : "border-slate-200"} />;

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
          onConfirm={handleResetConfirm}
          onCancel={() => !isResetting && setShowConfirm(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col gap-4 w-64 shrink-0">
        {/* Header */}
        <div className={`${panelBase} flex items-center justify-between`}>
          <span className={`font-black uppercase text-xs tracking-widest ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}>
            {title}
          </span>
          {toggleBtn}
        </div>

        {/* Progress section */}
        <div className={`${panelBase} flex flex-col gap-4`}>
          <p className={`font-black uppercase text-xs tracking-widest ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            {t("challenges.sidebar.words_seen")}
          </p>

          {isLoadingStats ? (
            <div className="flex justify-center py-2">
              <Loader2 size={20} className="animate-spin opacity-40" />
            </div>
          ) : (
            <>
              {/* Bar */}
              <div className={`w-full h-4 rounded-full border-2 overflow-hidden ${
                isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-300"
              }`}>
                <div
                  className="h-full bg-yellow-400 transition-all duration-500 rounded-full"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={99}
                />
              </div>
              {/* Label */}
              <div className="flex items-center">
                <span className={`text-2xl font-black ${
                  isDarkMode ? "text-yellow-400" : "text-slate-900"
                }`}>
                  {pct}%
                </span>
              </div>
            </>
          )}
        </div>

        {/* Stats section */}
        <div className={`${panelBase} flex flex-col gap-3`}>
          {divider}
          <StatRow
            icon={<Trophy size={14} />}
            label={t("challenges.sidebar.played")}
            value={String(totalPlayed)}
            isDarkMode={isDarkMode}
          />
          <StatRow
            icon={<Clock size={14} />}
            label={t("challenges.sidebar.last_played")}
            value={lastPlayed}
            isDarkMode={isDarkMode}
          />
          <StatRow
            icon={<Hash size={14} />}
            label={t("challenges.sidebar.dialect")}
            value={progress?.learningDialect ?? "\u2014"}
            isDarkMode={isDarkMode}
          />
          {divider}
        </div>

        {/* Reset button */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={seenCount === 0}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl border-4 font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
            isDarkMode
              ? "bg-slate-800 border-slate-600 text-slate-300 hover:border-yellow-400 hover:text-yellow-400"
              : "bg-white border-slate-900 text-slate-700 hover:bg-yellow-50 shadow-[3px_3px_0px_0px_#0f172a]"
          }`}
        >
          <RotateCcw size={14} />
          {t("challenges.sidebar.reset_seen_words_btn")}
        </button>
      </aside>

      {/* Mobile bottom strip */}
      <div className={`lg:hidden w-full rounded-2xl border-4 p-4 mt-6 ${
        isDarkMode
          ? "bg-slate-800 border-slate-700"
          : "bg-white border-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
      }`}>
        <p className={`font-black uppercase text-xs tracking-widest mb-3 ${
          isDarkMode ? "text-slate-400" : "text-slate-500"
        }`}>
          {title}
        </p>

        {isLoadingStats ? (
          <div className="flex justify-center py-2">
            <Loader2 size={18} className="animate-spin opacity-40" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Progress bar */}
            <div className={`w-full h-3 rounded-full border-2 overflow-hidden ${
              isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-100 border-slate-300"
            }`}>
              <div
                className="h-full bg-yellow-400 transition-all duration-500 rounded-full"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={99}
              />
            </div>
            {/* Percentage label */}
            <div className="flex items-center">
              <span className={`font-black text-sm ${
                isDarkMode ? "text-yellow-400" : "text-slate-900"
              }`}>
                {pct}% {t("challenges.sidebar.words_seen")}
              </span>
            </div>

            {/* Inline stats */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className={`text-xs font-bold ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
                <Trophy size={11} className="inline mr-1" />{totalPlayed} {t("challenges.sidebar.played")}
              </span>
              <span className={`text-xs font-bold ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
                <Clock size={11} className="inline mr-1" />{lastPlayed}
              </span>
            </div>

            {/* Reset — centered */}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={seenCount === 0}
              className={`self-center flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-40 ${
                isDarkMode
                  ? "border-slate-600 text-slate-400 hover:border-yellow-400 hover:text-yellow-400"
                  : "border-slate-300 text-slate-500 hover:border-slate-900 hover:text-slate-900"
              }`}
            >
              <RotateCcw size={12} /> {t("challenges.sidebar.reset_seen_words_btn")}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

ChallengeSidebar.propTypes = {
  isDarkMode:        PropTypes.bool.isRequired,
  seenCount:         PropTypes.number,
  progress:          PropTypes.shape({
    totalPlayed:     PropTypes.number,
    lastPlayedAt:    PropTypes.string,
    learningDialect: PropTypes.string,
  }),
  totalWords:        PropTypes.number,
  isLoadingStats:    PropTypes.bool.isRequired,
  onReset:           PropTypes.func.isRequired,
  resetTitle:        PropTypes.string.isRequired,
  resetMessage:      PropTypes.string.isRequired,
  resetWarning:      PropTypes.string,
  resetConfirmLabel: PropTypes.string.isRequired,
  title:             PropTypes.string.isRequired,
};

ChallengeSidebar.defaultProps = {
  seenCount:    0,
  progress:     null,
  totalWords:   null,
  resetWarning: undefined,
};

export default ChallengeSidebar;
