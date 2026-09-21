import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Volume2, Turtle, Pause, Square, Loader2 } from 'lucide-react';
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
  isDarkMode, accent = 'sky', variant = 'full', iconSize = 20,
}) => {
  const { t } = useTranslation();

  const isActive  = ttsState.activeKey === ttsKey;
  const hasText   = !!text?.trim();
  const isSlowKey = ttsState.activeKey === `${ttsKey}-slow`;
  // Gemini synthesis takes seconds, and until onStart fires there is nothing
  // to hear. Without this the button flipped straight to "pause" and looked
  // like playback had already begun on a clip that hadn't been generated yet.
  const isGenerating     = isActive  && ttsState.isGenerating;
  const isSlowGenerating = isSlowKey && ttsState.isGenerating;
  const isPlaying = isActive && !ttsState.isPaused && !isGenerating;
  const isPaused  = isActive && ttsState.isPaused;

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

  const playLabel = isGenerating
    ? t('translator.generating', 'Preparing audio…')
    : isPlaying
      ? t('translator.pause', 'Pause')
      : isPaused
        ? t('translator.resume', 'Resume')
        : t('translator.listen', 'Listen');

  const buttonBase = 'p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed';

  /**
   * One speaker, play/stop, the way the story reader does it.
   *
   * Used where the text is a single word or line and the row of three reads as
   * a control panel bolted to a game. The slow variant is the part actually
   * worth losing: it plays under `${ttsKey}-slow`, which is a *separate* clip
   * and therefore a second AI call — on a challenge that quietly spends a
   * second of a free tier's three for the day, next to a button that looks
   * like a playback speed.
   *
   * Stop rather than pause, because there is nothing here long enough to want
   * to resume in the middle of.
   */
  if (variant === 'single') {
    const label = isGenerating
      ? t('translator.generating', 'Preparing audio…')
      : isActive
        ? t('translator.stop', 'Stop')
        : t('translator.listen', 'Listen');

    return (
      <TooltipButton tooltip={label} isDarkMode={isDarkMode}>
        <button
          onClick={() => (isActive ? stopTts() : playTts({ key: ttsKey, text, lang, token }))}
          disabled={!hasText}
          aria-label={label}
          aria-busy={isGenerating}
          // Outlined rather than a bare glyph, and in the accent colour whether
          // or not it is playing: on a game board a loose icon reads as
          // decoration next to the clue, where a bordered box reads as a
          // control. `border-current` takes the colour from the text so the
          // accent only has to be set once.
          className={`${iconSize >= 18 ? 'p-2 rounded-xl' : 'p-1 rounded-lg'} border-2 border-current
            transition-colors active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed
            ${activeColor}`}
        >
          {isGenerating
            ? <Loader2 size={iconSize} className="animate-spin" />
            : isActive
              ? <Square size={iconSize} fill="currentColor" />
              : <Volume2 size={iconSize} />}
        </button>
      </TooltipButton>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* Play (Volume2) / Pause toggle */}
      <TooltipButton tooltip={playLabel} isDarkMode={isDarkMode}>
        <button
          onClick={handlePlayPause}
          disabled={!hasText}
          aria-label={playLabel}
          aria-busy={isGenerating}
          className={`${buttonBase} ${isActive ? activeColor : idleColor}`}
        >
          {isGenerating
            ? <Loader2 size={16} className="animate-spin" />
            : isPlaying
              ? <Pause size={16} fill="currentColor" />
              : <Volume2 size={16} />}
        </button>
      </TooltipButton>

      {/* Slow play (Turtle) */}
      <TooltipButton tooltip={t('translator.listen_slow', 'Listen slowly')} isDarkMode={isDarkMode}>
        <button
          onClick={() => playTts({ key: `${ttsKey}-slow`, text, lang, token, pace: SPEECH_PACE.SLOW })}
          disabled={!hasText}
          aria-label={t('translator.listen_slow', 'Listen slowly')}
          aria-busy={isSlowGenerating}
          className={`${buttonBase} ${isSlowKey ? activeColor : idleColor}`}
        >
          {isSlowGenerating ? <Loader2 size={16} className="animate-spin" /> : <Turtle size={16} />}
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
  /** 'single' collapses to one play/stop speaker; see the note above. */
  variant:    PropTypes.oneOf(['full', 'single']),
  /** 'single' only: shrinks the box with the glyph, for a list row. */
  iconSize:   PropTypes.number,
};

TtsControls.defaultProps = {
  accent: 'sky',
  variant: 'full',
  iconSize: 20,
};

export default TtsControls;
