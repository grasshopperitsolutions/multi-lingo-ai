/**
 * TTSPlayer.jsx
 *
 * Reusable Text-to-Speech player component.
 * Routes all audio through getTtsService (Gemini TTS primary, Web Speech API
 * fallback) via the useTts hook. Token is sourced from AppContext.
 *
 * Props:
 *   text       {string} - The text to be spoken
 *   lang       {string} - BCP-47 locale, e.g. 'pt-PT'
 *   isDarkMode {bool}   - Theme flag
 */

import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Play, Square, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTts } from '../hooks/useTts';
import { SPEECH_PACE } from '../services/getTtsService';
import { useAppContext } from '../contexts/AppContext';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * The two paces offered, slowest first.
 *
 * 0.25× and 2× are gone: each pace is now a separately generated recording
 * rather than the same clip stretched, so every option costs a generation —
 * and the extremes were the ones nobody used. `value` is display/aria only;
 * `pace` is what actually reaches the model.
 */
const PACE_OPTIONS = [
  { value: 0.5, pace: SPEECH_PACE.SLOW },
  { value: 1,   pace: SPEECH_PACE.NATURAL },
];

// A stable unique key for this player instance.
// Since TTSPlayer is always used in a single-player context (one per exercise screen),
// a fixed key is sufficient. useTts enforces only one active source at a time.
const PLAYER_KEY = 'tts-player';

// ---------------------------------------------------------------------------
// TTSPlayer
// ---------------------------------------------------------------------------

const TTSPlayer = ({ text, lang, isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const { ttsState, playTts, stopTts } = useTts();
  const [playCount, setPlayCount] = useState(0);
  const [pace, setPace] = useState(SPEECH_PACE.NATURAL);

  const isActive     = ttsState.activeKey === PLAYER_KEY;
  const isGenerating = isActive && ttsState.isGenerating;
  const isPlaying    = isActive && !ttsState.isGenerating;
  const isBusy       = isActive;
  const hasText      = !!text?.trim();

  // Stop on unmount to prevent zombie audio
  useEffect(() => {
    return () => { if (ttsState.activeKey === PLAYER_KEY) stopTts(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    if (isBusy) {
      // Works during generation too — stopTts invalidates the in-flight request
      // so a cancelled clip never arrives and starts playing on its own.
      stopTts();
      return;
    }
    if (!hasText) return;
    setPlayCount((prev) => prev + 1);
    playTts({ key: PLAYER_KEY, text, lang, token: user?.token, pace });
  };

  const handlePaceChange = (newPace) => {
    if (isBusy) return;
    setPace(newPace);
  };

  const statusLabel = isGenerating
    ? t('exam.audio_generating', 'Preparing audio…')
    : isPlaying
      ? t('exam.audio_playing', 'Playing…')
      : t('exam.audio_press_play', 'Press play to listen');

  return (
    <div className="flex flex-col gap-4">
      {/* Play / Stop row */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggle}
          disabled={!hasText}
          aria-label={isBusy ? t('exam.audio_stop', 'Stop audio') : t('exam.audio_play', 'Play audio')}
          aria-busy={isGenerating}
          className={`flex items-center justify-center w-14 h-14 rounded-2xl border-4 font-black
            transition-all active:scale-95 shrink-0
            ${
              !hasText
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:-translate-y-0.5'
            }
            ${
              isDarkMode
                ? 'bg-sky-500 border-sky-400 text-slate-900 shadow-[4px_4px_0px_0px_#0c4a6e] hover:bg-sky-400'
                : 'bg-sky-500 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a] hover:bg-sky-600'
            }`}
        >
          {isGenerating
            ? <Loader2 size={22} className="animate-spin" />
            : isPlaying
              ? <Square size={22} fill="currentColor" />
              : <Play   size={22} fill="currentColor" />}
        </button>

        <div className="flex flex-col gap-1 min-w-0">
          <p
            className={`text-sm font-black uppercase tracking-widest ${
              isDarkMode ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {statusLabel}
          </p>
          {playCount > 0 && (
            <p
              className={`text-xs font-semibold ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              &#9654; {t('exam.audio_listened_count', 'Listened × {{count}}', { count: playCount })}
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
          {t('exam.audio_speed', 'Speed')}
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {PACE_OPTIONS.map((option) => {
            const isSelected = pace === option.pace;
            return (
              <button
                key={option.pace}
                onClick={() => handlePaceChange(option.pace)}
                disabled={isBusy}
                aria-label={t('exam.audio_set_speed', 'Set speed to {{rate}}×', { rate: option.value })}
                aria-pressed={isSelected}
                className={`px-3 py-1 rounded-lg border-2 text-xs font-black uppercase tracking-widest
                  transition-all active:scale-95
                  ${
                    isBusy ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-0.5 cursor-pointer'
                  }
                  ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-sky-500 border-sky-400 text-slate-900'
                        : 'bg-sky-500 border-slate-900 text-white'
                      : isDarkMode
                      ? 'bg-transparent border-slate-600 text-slate-400 hover:bg-slate-700'
                      : 'bg-transparent border-slate-300 text-slate-500 hover:bg-slate-100'
                  }`}
              >
                {option.value}&#215;
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
