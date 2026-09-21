import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { RotateCcw, Loader2, Trophy, Clock, Hash } from "lucide-react";
import ConfirmModal from "./ConfirmModal";
import Tooltip from "./Tooltip";
import { useAppContext } from "../contexts/AppContext";

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
  themePicker,
}) => {
  const { t } = useTranslation();
  const { supportedLanguages } = useAppContext();

  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const pct         = _seenPercent(seenCount, totalWords);
  const totalPlayed = progress?.totalPlayed ?? 0;
  const lastPlayed  = _relativeTime(progress?.lastPlayedAt, t);

  // The dialect on the *progress record*, which is not necessarily the one
  // currently selected — a stored run keeps the language it was played in.
  const dialectLabel =
    supportedLanguages?.find((lang) => lang.code === progress?.learningDialect)?.label ?? "";

  const handleResetConfirm = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
      setShowConfirm(false);
    }
  };

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
        </div>

        {/* Theme picker — a control, so it sits above the read-only stats. */}
        {themePicker && <div className={panelBase}>{themePicker}</div>}

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
          {/* The code stays the value \u2014 pt-PT and pt-BR are different practice
              languages and read almost identically as names. The long form is
              one hover away rather than crowding a stat row. */}
          <Tooltip text={dialectLabel} isDarkMode={isDarkMode}>
            <StatRow
              icon={<Hash size={14} />}
              label={t("challenges.sidebar.dialect")}
              value={progress?.learningDialect ?? "\u2014"}
              isDarkMode={isDarkMode}
            />
          </Tooltip>
          {divider}
        </div>

        {/* Reset button.

            Rose, and outlined the way Settings marks "delete account": this
            throws away every word the player has ever been shown, on every
            device, and cannot be undone. It used to look like any other
            control in the panel, which understated it. Not theme-branched,
            because one rose reads on both grounds — the same reason the
            Settings button carries no branch either. */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={seenCount === 0}
          className="flex items-center justify-center gap-2 py-3 rounded-xl border-4 border-rose-500 font-black uppercase text-xs tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500 hover:text-white shadow-[3px_3px_0px_0px_#f43f5e] disabled:opacity-40 disabled:cursor-not-allowed"
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

        {themePicker && (
          <div className={`mb-4 pb-4 border-b-2 ${
            isDarkMode ? "border-slate-700" : "border-slate-200"
          }`}>
            {themePicker}
          </div>
        )}

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

            {/* Reset — centered. Same rose as the panel above; the strip is
                compact, so it keeps its thinner border and drops the shadow. */}
            <button
              onClick={() => setShowConfirm(true)}
              disabled={seenCount === 0}
              className="self-center flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-rose-500 font-black uppercase text-xs tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500 hover:text-white disabled:opacity-40"
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
  /** Rendered above the stats in both layouts. A node rather than a bag of
   *  props, so this component stays presentational and knows nothing about
   *  interests or tiers. */
  themePicker:       PropTypes.node,
};

ChallengeSidebar.defaultProps = {
  seenCount:    0,
  progress:     null,
  totalWords:   null,
  resetWarning: undefined,
  themePicker:  null,
};

export default ChallengeSidebar;
