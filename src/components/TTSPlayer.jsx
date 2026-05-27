import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Play, Pause, Square } from 'lucide-react';
import {
  speak,
  pause,
  resume,
  stopSpeaking,
  getState,
  onStateChange,
  offStateChange,
} from '../services/ttsService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEEDS = [
  { label: '1×',    value: 1.0 },
  { label: '½×',    value: 0.5 },
  { label: '¼×',    value: 0.25 },
];

const TTS_SUPPORTED =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

// ---------------------------------------------------------------------------
// TTSPlayer
// ---------------------------------------------------------------------------

/**
 * Self-contained text-to-speech player bar.
 *
 * Props:
 *   text        {string}  - Text to read aloud
 *   lang        {string}  - BCP-47 locale, e.g. 'pt-PT'
 *   isDarkMode  {boolean}
 *
 * The component subscribes to ttsService state via onStateChange/offStateChange
 * and stops any ongoing speech when text or lang changes, or on unmount.
 */
const TTSPlayer = ({ text, lang, isDarkMode }) => {
  const [playState, setPlayState] = useState(() => getState());
  const [speed,     setSpeed]     = useState(1.0);

  // ── Sync local state with the singleton ttsService ──
  useEffect(() => {
    onStateChange(setPlayState);
    return () => {
      offStateChange(setPlayState);
      stopSpeaking();
    };
  }, []);

  // ── Reset when the text/lang the parent provides changes ──
  useEffect(() => {
    stopSpeaking();
  }, [text, lang]);

  // ── Guard: browser support ──
  if (!TTS_SUPPORTED) {
    return (
      <p className={`text-xs font-bold ${
        isDarkMode ? 'text-slate-500' : 'text-slate-400'
      }`}>
        TTS not supported in this browser.
      </p>
    );
  }

  const hasText  = !!text?.trim();
  const isIdle   = playState === 'idle';
  const isPlaying = playState === 'playing';
  const isPaused  = playState === 'paused';

  // ── Play / Pause / Resume toggle handler ──
  const handlePlayToggle = () => {
    if (isIdle)    { speak(text, lang, { rate: speed }); return; }
    if (isPlaying) { pause();  return; }
    if (isPaused)  { resume(); return; }
  };

  // ── Speed pill handler ──
  const handleSpeedChange = (newSpeed) => {
    if (newSpeed === speed) return;
    setSpeed(newSpeed);
    // If already playing or paused, restart at new speed
    if (!isIdle) {
      stopSpeaking();
      // Small delay so ttsService has time to cancel before re-speaking
      setTimeout(() => speak(text, lang, { rate: newSpeed }), 80);
    }
  };

  // ── Derived label & icon for the play button ──
  const playLabel = isIdle ? 'Play' : isPlaying ? 'Pause' : 'Resume';
  const PlayIcon  = isPlaying ? Pause : Play;

  // ── Shared class helpers ──
  const base = `flex items-center gap-2 flex-wrap`;

  const primaryBtnClass = `
    flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-black uppercase
    tracking-widest text-xs transition-all hover:-translate-y-0.5 active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
    ${
      isDarkMode
        ? 'bg-violet-500 border-violet-400 text-white shadow-[3px_3px_0px_0px_#5b21b6]'
        : 'bg-violet-500 border-violet-600 text-white shadow-[3px_3px_0px_0px_#5b21b6]'
    }
  `;

  const stopBtnClass = `
    flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-black uppercase
    tracking-widest text-xs transition-all hover:-translate-y-0.5 active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0
    ${
      isDarkMode
        ? 'bg-slate-700 border-slate-600 text-slate-200 shadow-[3px_3px_0px_0px_#0f172a]'
        : 'bg-slate-100 border-slate-300 text-slate-700 shadow-[3px_3px_0px_0px_#cbd5e1]'
    }
  `;

  const speedPillClass = (v) => `
    px-2.5 py-1 rounded-lg border-2 text-xs font-black uppercase tracking-widest
    transition-all hover:-translate-y-0.5 active:scale-95
    ${
      speed === v
        ? isDarkMode
          ? 'bg-violet-500 border-violet-400 text-white'
          : 'bg-violet-500 border-violet-600 text-white'
        : isDarkMode
          ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-violet-400'
          : 'bg-white border-slate-300 text-slate-600 hover:border-violet-400'
    }
  `;

  const dividerClass = `w-px h-5 rounded-full mx-1 ${
    isDarkMode ? 'bg-slate-600' : 'bg-slate-300'
  }`;

  return (
    <div className={base} role="group" aria-label="Text-to-speech player">

      {/* Play / Pause / Resume */}
      <button
        onClick={handlePlayToggle}
        disabled={!hasText}
        aria-label={playLabel}
        title={!hasText ? 'No text to read' : playLabel}
        className={primaryBtnClass}
      >
        <PlayIcon size={13} />
        <span>{playLabel}</span>
      </button>

      {/* Stop */}
      <button
        onClick={stopSpeaking}
        disabled={isIdle}
        aria-label="Stop"
        title="Stop"
        className={stopBtnClass}
      >
        <Square size={13} />
        <span>Stop</span>
      </button>

      {/* Divider */}
      <div className={dividerClass} aria-hidden="true" />

      {/* Speed pills */}
      {SPEEDS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => handleSpeedChange(value)}
          aria-pressed={speed === value}
          aria-label={`Speed ${label}`}
          className={speedPillClass(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

TTSPlayer.propTypes = {
  text:       PropTypes.string.isRequired,
  lang:       PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default TTSPlayer;
