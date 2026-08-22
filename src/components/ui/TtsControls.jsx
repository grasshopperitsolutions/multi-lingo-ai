import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Volume2, Turtle, Pause, Square } from 'lucide-react';
import TooltipButton from '../TooltipButton';
import { SPEECH_PACE } from '../../services/getTtsService';

/**
 * TtsControls.jsx
 *
 * Listen / listen-slow / stop row for a single block of text.
 *
 * This existed as a private copy inside both TranslatorPanel and
 * DictionaryPanel — identical except for the accent colour — and History &
 * Culture needed a third. The two copies had already drifted (one wrapped its
 * buttons in TooltipButton, the other used bare `title` attributes); this
 * keeps the TooltipButton behaviour, which is the accessible one.
 *
 * Playback state is owned by the caller's useTts() hook and passed in, because
 * useTts enforces a single active source app-wide — one component per page
 * must not mean one independent player per component.
 *
 * The slow variant plays under its own key (`${ttsKey}-slow`) so it is a
 * separate recording rather than the same clip stretched; see getTtsService.
 *
 * Usage:
 *   const { ttsState, playTts, pauseTts, stopTts } = useTts();
 *   <TtsControls
 *     ttsKey="history-fact" text={body} lang={fact.locale}
 *     token={user?.token} accent="rose"
 *     ttsState={ttsState} playTts={playTts} pauseTts={pauseTts} stopTts={stopTts}
 *     isDarkMode={isDarkMode}
 *   />
 */

const ACCENTS = {
  sky:     { d: 'text-sky-400 hover:text-sky-300',         l: 'text-sky-600 hover:text-sky-800' },
  violet:  { d: 'text-violet-400 hover:text-violet-300',   l: 'text-violet-600 hover:text-violet-800' },
  rose:    { d: 'text-rose-400 hover:text-rose-300',       l: 'text-rose-600 hover:text-rose-800' },
  amber:   { d: 'text-amber-400 hover:text-amber-300',     l: 'text-amber-600 hover:text-amber-800' },
  emerald: { d: 'text-emerald-400 hover:text-emerald-300', l: 'text-emerald-600 hover:text-emerald-800' },
};

const TtsControls = ({
  ttsKey, text, lang, token,
  ttsState, playTts, pauseTts, stopTts,
  isDarkMode, accent = 'sky',
}) => {
  const { t } = useTranslation();

  const isActive  = ttsState.activeKey === ttsKey;
  const isPlaying = isActive && !ttsState.isPaused;
  const isPaused  = isActive && ttsState.isPaused;
  const hasText   = !!text?.trim();
  const isSlowKey = ttsState.activeKey === `${ttsKey}-slow`;

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseTts();
    } else {
      playTts({ key: ttsKey, text, lang, token });
    }
  };

  const palette = ACCENTS[accent] ?? ACCENTS.sky;
  const activeColor = isDarkMode ? palette.d : palette.l;
  const idleColor = isDarkMode
    ? 'text-slate-400 hover:text-white'
    : 'text-slate-500 hover:text-slate-900';

  const playLabel = isPlaying
    ? t('translator.pause', 'Pause')
    : isPaused
      ? t('translator.resume', 'Resume')
      : t('translator.listen', 'Listen');

  const buttonBase = 'p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center gap-1">
      {/* Play (Volume2) / Pause toggle */}
      <TooltipButton tooltip={playLabel} isDarkMode={isDarkMode}>
        <button
          onClick={handlePlayPause}
          disabled={!hasText}
          aria-label={playLabel}
          className={`${buttonBase} ${isActive ? activeColor : idleColor}`}
        >
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Volume2 size={16} />}
        </button>
      </TooltipButton>

      {/* Slow play (Turtle) */}
      <TooltipButton tooltip={t('translator.listen_slow', 'Listen slowly')} isDarkMode={isDarkMode}>
        <button
          onClick={() => playTts({ key: `${ttsKey}-slow`, text, lang, token, pace: SPEECH_PACE.SLOW })}
          disabled={!hasText}
          aria-label={t('translator.listen_slow', 'Listen slowly')}
          className={`${buttonBase} ${isSlowKey ? activeColor : idleColor}`}
        >
          <Turtle size={16} />
        </button>
      </TooltipButton>

      {/* Stop — only enabled while this key or its slow variant is active */}
      <TooltipButton tooltip={t('translator.stop', 'Stop')} isDarkMode={isDarkMode}>
        <button
          onClick={stopTts}
          disabled={!isActive && !isSlowKey}
          aria-label={t('translator.stop', 'Stop')}
          className={`${buttonBase} ${
            (isActive || isSlowKey) ? 'text-rose-500 hover:text-rose-400' : idleColor
          }`}
        >
          <Square size={16} fill="currentColor" />
        </button>
      </TooltipButton>
    </div>
  );
};

TtsControls.propTypes = {
  ttsKey:     PropTypes.string.isRequired,
  text:       PropTypes.string,
  lang:       PropTypes.string.isRequired,
  token:      PropTypes.string,
  ttsState:   PropTypes.object.isRequired,
  playTts:    PropTypes.func.isRequired,
  pauseTts:   PropTypes.func.isRequired,
  stopTts:    PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  accent:     PropTypes.oneOf(['sky', 'violet', 'rose', 'amber', 'emerald']),
};

TtsControls.defaultProps = {
  accent: 'sky',
};

export default TtsControls;
