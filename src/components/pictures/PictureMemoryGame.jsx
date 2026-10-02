import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { usePictureRound } from "../../hooks/usePictureRound";
import { useAlbumStickers } from "../../hooks/useAlbumStickers";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { useTts } from "../../hooks/useTts";
import { useGameOutcomeSound } from "../../hooks/useSound";
import { play } from "../../services/soundService";
import { buildMemoryDeck } from "../../utils/pictureRound";
import PictureTile from "./PictureTile";
import PictureRoundStatus from "./PictureRoundStatus";
import PictureRoundResult from "./PictureRoundResult";

/** How long a wrong pair stays face up, so the player can read it. */
const MISMATCH_MS = 900;
/** 3 columns by 4 rows on a phone (6 pairs), 4 by 4 on a wide screen (8 pairs). */
const PAIRS_NARROW = 6;
const PAIRS_WIDE = 8;
const WIDE_QUERY = "(min-width: 768px)";

/**
 * One memory game. Keyed on the round by its parent, so a new game builds a
 * new deck and starts every counter at zero.
 */
const MemoryBoard = ({ words, onAgain, onRight, isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const { playTts } = useTts();
  const dialect = user?.learningDialect ?? "pt-PT";

  // Shuffled once. The deck must not reshuffle on a re-render, or the cards
  // would move under the player's finger.
  const [deck] = useState(() => buildMemoryDeck(words));
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(() => new Set());
  const [moves, setMoves] = useState(0);
  const [newStickers, setNewStickers] = useState(0);
  // A second pair cannot be turned while a wrong one is still showing. A ref,
  // not state: the click handler needs the current value without a re-render.
  const lockedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const won = matched.size === words.length;
  useGameOutcomeSound({ won });

  const handleFlip = (card) => {
    if (lockedRef.current || matched.has(card.conceptId) || flipped.includes(card.key)) return;

    play("tile_pick");
    // A word card is read aloud as it turns: seeing the word, hearing it and
    // finding its picture is the whole exercise.
    if (card.kind === "word") {
      playTts({ key: `picture-memory-${card.conceptId}`, text: card.word.word, lang: dialect, token: user?.token });
    }

    const next = [...flipped, card.key];
    setFlipped(next);
    if (next.length < 2) return;

    setMoves((value) => value + 1);
    const [first, second] = next.map((key) => deck.find((c) => c.key === key));

    if (first.conceptId === second.conceptId) {
      play("word_found");
      setMatched((previous) => new Set(previous).add(first.conceptId));
      if (onRight(first.conceptId)) setNewStickers((value) => value + 1);
      setFlipped([]);
    } else {
      lockedRef.current = true;
      timerRef.current = setTimeout(() => {
        setFlipped([]);
        lockedRef.current = false;
      }, MISMATCH_MS);
    }
  };

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto animate-in fade-in">
      <div className="flex w-full items-center justify-between gap-3">
        <span className={`text-xs font-black uppercase tracking-widest ${muted}`}>
          {t("picture_games.memory.pairs", { found: matched.size, total: words.length })}
        </span>
        <span className={`text-xs font-black uppercase tracking-widest ${muted}`}>
          {t("picture_games.memory.moves", { moves })}
        </span>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 w-full">
        {deck.map((card, i) => {
          const isMatched = matched.has(card.conceptId);
          const faceUp = isMatched || flipped.includes(card.key);

          if (!faceUp) {
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => handleFlip(card)}
                aria-label={t("picture_games.memory.card_down", { n: i + 1 })}
                className={`aspect-square w-full rounded-2xl border-4 border-slate-900 bg-sky-400 text-3xl font-black text-slate-900 transition-all hover:-translate-y-0.5 active:scale-95 ${
                  isDarkMode ? "shadow-[4px_4px_0px_0px_#1e293b]" : "shadow-[4px_4px_0px_0px_#0f172a]"
                }`}
              >
                ?
              </button>
            );
          }

          if (card.kind === "picture") {
            return (
              <PictureTile
                key={card.key}
                url={card.word.url}
                conceptId={card.conceptId}
                isDarkMode={isDarkMode}
                state={isMatched ? "correct" : "idle"}
                showReport={isMatched}
                ariaLabel={t("picture_games.picture")}
                className="animate-in zoom-in-95"
              />
            );
          }

          return (
            <div
              key={card.key}
              lang={dialect}
              className={`flex aspect-square w-full items-center justify-center rounded-2xl border-4 bg-white p-2 text-center text-base sm:text-xl font-black leading-tight break-words text-slate-900 animate-in zoom-in-95 ${
                isMatched ? "border-emerald-500 ring-4 ring-emerald-400" : "border-slate-900"
              }`}
            >
              {card.word.word}
            </div>
          );
        })}
      </div>

      {won && (
        <>
          {newStickers > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-slate-900 bg-yellow-300 text-xs font-black uppercase tracking-widest text-slate-900">
              <Sparkles size={14} aria-hidden="true" />
              {t("picture_games.memory.new_stickers", { stickers: newStickers })}
            </span>
          )}
          <PictureRoundResult
            headline={t("picture_games.memory.result", { moves })}
            onAgain={onAgain}
            isDarkMode={isDarkMode}
          />
        </>
      )}
    </div>
  );
};

MemoryBoard.propTypes = {
  words: PropTypes.array.isRequired,
  onAgain: PropTypes.func.isRequired,
  onRight: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/**
 * Jogo da memória (picture_memory)
 *
 * Turn cards to pair each picture with its word. A word card is read aloud as
 * it turns. Moves are counted. Six pairs on a phone (3 by 4), eight on a wide
 * screen (4 by 4).
 *
 * Every pair found marks the word seen and sticks its picture in the album. The
 * deck is words the player has not seen; when fewer than a full deck are left
 * (a fresh few are being fetched for the next game) it is made up with words
 * already seen, so the board is never short.
 */
const PictureMemoryGame = ({ isDarkMode }) => {
  const isWide = useMediaQuery(WIDE_QUERY);
  const pairs = isWide ? PAIRS_WIDE : PAIRS_NARROW;
  const round = usePictureRound({ want: pairs, poolSize: PAIRS_WIDE * 2, minWords: 4 });
  const { collect } = useAlbumStickers();
  const { markSeen } = round;

  const onRight = useCallback(
    (conceptId) => {
      markSeen([conceptId]);
      return collect([conceptId]).length > 0;
    },
    [markSeen, collect],
  );

  const words = useMemo(() => {
    if (round.status !== "ready" || round.words.length >= pairs) return round.words;
    const have = new Set(round.words.map((word) => word.conceptId));
    return [...round.words, ...round.pool.filter((word) => !have.has(word.conceptId))].slice(0, pairs);
  }, [round.status, round.words, round.pool, pairs]);

  if (round.status !== "ready") {
    return (
      <PictureRoundStatus
        status={round.status}
        isFilling={round.isFilling}
        error={round.error}
        onRetry={round.newRound}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <MemoryBoard key={round.roundId} words={words} onAgain={round.newRound} onRight={onRight} isDarkMode={isDarkMode} />
  );
};

PictureMemoryGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureMemoryGame;
