/**
 * ExamTimer.jsx
 *
 * Reusable exam countdown/stopwatch timer component.
 * Used by WritingExercise and future exam components (Listening, Reading, Full Exam).
 *
 * Features:
 * - Start / Pause toggle
 * - Reset button
 * - MM:SS display
 * - Exposes { reset, stop } via ref for programmatic control by parent
 *
 * Props:
 *   isDarkMode {bool} - theme flag
 *   onTick     {func} - optional callback called every second with elapsed seconds
 */

import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format seconds into MM:SS string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ExamTimer = forwardRef(function ExamTimer({ isDarkMode, onTick }, ref) {
  const { t }                     = useTranslation();
  const [elapsed, setElapsed]     = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef               = useRef(null);

  // ── Tick interval ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          onTick?.(next);
          return next;
        });
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, onTick]);

  // ── Imperative handle — lets parent call timer.current.reset() / .stop() ──
  useImperativeHandle(ref, () => ({
    reset() {
      setIsRunning(false);
      setElapsed(0);
    },
    stop() {
      setIsRunning(false);
    },
    getElapsed() {
      return elapsed;
    },
  }));

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleToggle = () => setIsRunning((prev) => !prev);

  const handleReset = () => {
    setIsRunning(false);
    setElapsed(0);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const base = isDarkMode
    ? 'bg-slate-800 border-slate-700 text-white'
    : 'bg-white border-slate-900 text-slate-900';

  const btnBase = `flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-black uppercase
    tracking-widest text-xs transition-all active:scale-95 select-none`;

  const primaryBtn = isDarkMode
    ? 'border-slate-600 bg-slate-700 text-white hover:bg-slate-600'
    : 'border-slate-900 bg-slate-100 text-slate-900 hover:bg-slate-200';

  const resetBtn = isDarkMode
    ? 'border-slate-600 bg-transparent text-slate-400 hover:text-white hover:border-slate-400'
    : 'border-slate-300 bg-transparent text-slate-400 hover:text-slate-700 hover:border-slate-500';

  return (
    <div
      className={`inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl border-4 shadow-[4px_4px_0px_0px] ${
        isDarkMode ? 'shadow-slate-900' : 'shadow-slate-900'
      } ${base}`}
      role="timer"
      aria-label={`Exam timer: ${formatTime(elapsed)}`}
    >
      {/* Time display */}
      <span
        className={`font-mono font-black text-xl sm:text-2xl tabular-nums tracking-tight ${
          isRunning
            ? isDarkMode ? 'text-teal-400' : 'text-teal-600'
            : isDarkMode ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        {formatTime(elapsed)}
      </span>

      {/* Divider */}
      <span className={`w-px h-6 ${
        isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
      }`} aria-hidden="true" />

      {/* Start / Pause */}
      <button
        onClick={handleToggle}
        className={`${btnBase} ${primaryBtn}`}
        aria-label={isRunning ? t('exam.timer_pause', 'Pause') : t('exam.timer_start', 'Start')}
      >
        {isRunning
          ? <Pause size={13} /> 
          : <Play  size={13} />}
      </button>

      {/* Reset */}
      <button
        onClick={handleReset}
        className={`${btnBase} ${resetBtn}`}
        aria-label={t('exam.timer_reset', 'Reset')}
        disabled={elapsed === 0 && !isRunning}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
});

ExamTimer.displayName = 'ExamTimer';

ExamTimer.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onTick:     PropTypes.func,
};

ExamTimer.defaultProps = {
  onTick: undefined,
};

export default ExamTimer;
