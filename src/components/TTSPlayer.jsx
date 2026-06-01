/**
 * TTSPlayer.jsx
 *
 * Reusable Text-to-Speech player component.
 * Uses the Web Speech API directly for playback (to support onend/onerror callbacks)
 * and stopSpeaking from ttsService for cancel logic.
 *
 * Props:
 *   text       {string} - The text to be spoken
 *   lang       {string} - BCP-47 locale, e.g. 'pt-PT'
 *   isDarkMode {bool}   - Theme flag
 */

import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Play, Square } from 'lucide-react';
import { stopSpeaking } from '../services/getTtsService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPEED_OPTIONS = [0.25, 0.5, 1, 2];

// ---------------------------------------------------------------------------
// TTSPlayer
// ---------------------------------------------------------------------------

const TTSPlayer = ({ text, lang, isDarkMode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [rate, setRate] = useState(1);
  const utteranceRef = useRef(null);

  // Stop speech on unmount to prevent zombie audio
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handlePlay = () => {
    if (!text?.trim()) return;

    // Cancel any current speech first
    stopSpeaking();

    // Small delay to allow cancel to settle (mirrors ttsService internal pattern)
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;

      // onend/onerror reset playing state — this is why we construct the
      // utterance directly instead of delegating to ttsService.speak()
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);

      setIsPlaying(true);
      setPlayCount((prev) => prev + 1);
    }, 50);
  };

  const handleStop = () => {
    stopSpeaking();
    setIsPlaying(false);
  };

  const handleSpeedChange = (newRate) => {
    if (isPlaying) return;
    setRate(newRate);
  };

  return (
    <div
      className={`rounded-2xl border-4 p-4 sm:p-5 flex flex-col gap-4 ${
        isDarkMode
          ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
          : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
      }`}
    >
      {/* Play / Stop row */}
      <div className="flex items-center gap-4">
        <button
          onClick={isPlaying ? handleStop : handlePlay}
          disabled={!text?.trim()}
          aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
          className={`flex items-center justify-center w-14 h-14 rounded-2xl border-4 font-black
            transition-all active:scale-95 shrink-0
            ${
              !text?.trim()
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:-translate-y-0.5'
            }
            ${
              isDarkMode
                ? 'bg-sky-500 border-sky-400 text-slate-900 shadow-[4px_4px_0px_0px_#0c4a6e] hover:bg-sky-400'
                : 'bg-sky-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-sky-600'
            }`}
        >
          {isPlaying ? <Square size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>

        <div className="flex flex-col gap-1 min-w-0">
          <p
            className={`text-sm font-black uppercase tracking-widest ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {isPlaying ? 'Playing…' : 'Press play to listen'}
          </p>
          {/* Listen count — only shown after first play */}
          {playCount > 0 && (
            <p
              className={`text-xs font-semibold ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              ▶ Listened × {playCount}
            </p>
          )}
        </div>
      </div>

      {/* Speed selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs font-black uppercase tracking-widest shrink-0 ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Speed
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {SPEED_OPTIONS.map((option) => {
            const isActive = rate === option;
            return (
              <button
                key={option}
                onClick={() => handleSpeedChange(option)}
                disabled={isPlaying}
                aria-label={`Set speed to ${option}x`}
                aria-pressed={isActive}
                className={`px-3 py-1 rounded-lg border-2 text-xs font-black uppercase tracking-widest
                  transition-all active:scale-95
                  ${
                    isPlaying ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5 cursor-pointer'
                  }
                  ${
                    isActive
                      ? isDarkMode
                        ? 'bg-sky-500 border-sky-400 text-slate-900'
                        : 'bg-sky-500 border-slate-900 text-white'
                      : isDarkMode
                      ? 'bg-transparent border-slate-600 text-slate-400 hover:bg-slate-700'
                      : 'bg-transparent border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
              >
                {option}×
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

TTSPlayer.propTypes = {
  text:       PropTypes.string.isRequired,
  lang:       PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

export default TTSPlayer;
