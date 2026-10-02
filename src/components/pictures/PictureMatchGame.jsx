import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { usePictureRound } from "../../hooks/usePictureRound";
import { useAlbumStickers } from "../../hooks/useAlbumStickers";
import { useTts } from "../../hooks/useTts";
import { useGameOutcomeSound } from "../../hooks/useSound";
import { play } from "../../services/soundService";
import { buildMatchTurns } from "../../utils/pictureRound";
import { PrimaryButton, TtsControls } from "../ui";
import PictureTile from "./PictureTile";
import PictureRoundStatus from "./PictureRoundStatus";
import PictureRoundResult from "./PictureRoundResult";

/** Turns in a round. */
const TURNS = 8;

const OPTION_CLASSES = {
  idle: (dark) => (dark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"),
  correct: () => "bg-emerald-400 border-slate-900 text-slate-900",
  wrong: () => "bg-rose-400 border-slate-900 text-slate-900",
  dim: (dark) => `opacity-50 ${dark ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"}`,
};

/**
 * One round on the board. Keyed on the round by its parent, so a new round
 * starts with every piece of state at its first value.
 */
const MatchBoard = ({ turns, onAgain, collect, isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const { ttsState, playTts, pauseTts, stopTts } = useTts();
  const dialect = user?.learningDialect ?? "pt-PT";

  const [index, setIndex] = useState(0);
  const [pickedId, setPickedId] = useState(null);
  const [score, setScore] = useState(0);
  const [gotSticker, setGotSticker] = useState(false);

  const done = index >= turns.length;
  const turn = done ? null : turns[index];
  // Wins make a sound; a low score stays quiet rather than playing "lose" at
  // somebody who is practising.
  useGameOutcomeSound({ won: done && score * 2 >= turns.length });

  const ttsProps = { lang: dialect, token: user?.token, accent: "sky", variant: "single", ttsState, playTts, pauseTts, stopTts, isDarkMode };

  if (done) {
    return (
      <PictureRoundResult
        headline={t("picture_games.match.result", { score, total: turns.length })}
        detail={t("picture_games.match.result_hint")}
        onAgain={onAgain}
        isDarkMode={isDarkMode}
      />
    );
  }

  const answered = pickedId !== null;
  const stateOf = (option) => {
    if (!answered) return "idle";
    if (option.conceptId === turn.answer.conceptId) return "correct";
    if (option.conceptId === pickedId) return "wrong";
    return "dim";
  };

  const handlePick = (conceptId) => {
    if (answered) return;
    setPickedId(conceptId);
    const correct = conceptId === turn.answer.conceptId;
    play(correct ? "answer_correct" : "answer_wrong");
    if (correct) {
      setScore((value) => value + 1);
      // The sticker sound is the album's own; this only decides the chip.
      setGotSticker(collect([turn.answer.conceptId]).length > 0);
    }
  };

  const handleNext = () => {
    stopTts();
    setPickedId(null);
    setGotSticker(false);
    setIndex((value) => value + 1);
  };

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const isLast = index === turns.length - 1;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto animate-in fade-in">
      <div className="flex w-full items-center justify-between gap-3">
        <span className={`text-xs font-black uppercase tracking-widest ${muted}`}>
          {t("picture_games.match.turn", { current: index + 1, total: turns.length })}
        </span>
        <span className={`text-xs font-black uppercase tracking-widest ${muted}`}>
          {t("picture_games.match.score", { score })}
        </span>
      </div>

      {turn.direction === "word_to_picture" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={`text-xs font-black uppercase tracking-widest ${muted}`}>
            {t("picture_games.match.which_picture")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <span lang={dialect} className={`text-4xl sm:text-5xl font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              {turn.answer.word}
            </span>
            <TtsControls ttsKey={`picture-match-${turn.answer.conceptId}`} text={turn.answer.word} {...ttsProps} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 w-full text-center">
          <p className={`text-xs font-black uppercase tracking-widest ${muted}`}>
            {t("picture_games.match.which_word")}
          </p>
          <PictureTile
            className="w-44 sm:w-56"
            url={turn.answer.url}
            conceptId={turn.answer.conceptId}
            isDarkMode={isDarkMode}
            showReport={answered}
            ariaLabel={t("picture_games.picture")}
          />
        </div>
      )}

      {turn.direction === "word_to_picture" ? (
        // Two by two, full width: the pictures are the answer, so they get the screen.
        <div className="grid grid-cols-2 gap-4 w-full">
          {turn.options.map((option, i) => (
            <PictureTile
              key={option.conceptId}
              url={option.url}
              conceptId={option.conceptId}
              isDarkMode={isDarkMode}
              state={stateOf(option)}
              disabled={answered}
              onClick={() => handlePick(option.conceptId)}
              showReport={answered && option.conceptId === turn.answer.conceptId}
              ariaLabel={t("picture_games.match.option", { n: i + 1 })}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {turn.options.map((option) => (
            <div key={option.conceptId} className="flex items-stretch gap-2">
              <button
                type="button"
                lang={dialect}
                disabled={answered}
                onClick={() => handlePick(option.conceptId)}
                className={`flex-1 min-h-[56px] px-4 py-3 rounded-xl border-4 text-lg sm:text-xl font-black transition-all ${
                  answered ? "cursor-default" : "hover:-translate-y-0.5 active:scale-95"
                } ${OPTION_CLASSES[stateOf(option)](isDarkMode)}`}
              >
                {option.word}
              </button>
              <TtsControls ttsKey={`picture-match-opt-${option.conceptId}`} text={option.word} {...ttsProps} />
            </div>
          ))}
        </div>
      )}

      {answered && (
        <div className="flex flex-col items-center gap-3 text-center animate-in fade-in" aria-live="polite">
          <p className={`text-lg font-black ${pickedId === turn.answer.conceptId ? "text-emerald-500" : "text-rose-500"}`}>
            {pickedId === turn.answer.conceptId
              ? t("picture_games.match.right")
              : t("picture_games.match.wrong", { word: turn.answer.word })}
          </p>
          {gotSticker && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-slate-900 bg-yellow-300 text-xs font-black uppercase tracking-widest text-slate-900">
              <Sparkles size={14} aria-hidden="true" />
              {t("picture_games.new_sticker")}
            </span>
          )}
          <PrimaryButton onClick={handleNext} isDarkMode={isDarkMode} color="sky">
            {isLast ? t("picture_games.match.see_result") : t("picture_games.match.next")}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
};

MatchBoard.propTypes = {
  turns: PropTypes.array.isRequired,
  onAgain: PropTypes.func.isRequired,
  collect: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/**
 * Liga a imagem (picture_match)
 *
 * One word and four pictures: tap the right one. Every other turn it is
 * reversed, one picture and four words. Eight turns a round. The speaker reads
 * each word, so it is also listening practice.
 *
 * The round's words come from usePictureRound (concepts with a picture and a
 * practice-language word); the turns from buildMatchTurns, which keeps the wrong
 * options fair. A right answer sticks the picture in the album.
 */
const PictureMatchGame = ({ isDarkMode }) => {
  const round = usePictureRound({ want: TURNS, poolSize: 24, minWords: 4 });
  const { collect } = useAlbumStickers();

  const turns = useMemo(
    () => (round.status === "ready" ? buildMatchTurns(round.words, round.pool, { turns: TURNS }) : []),
    [round.status, round.words, round.pool],
  );

  if (round.status !== "ready" || turns.length === 0) {
    return (
      <PictureRoundStatus
        status={round.status === "ready" ? "thin" : round.status}
        isFilling={round.isFilling}
        error={round.error}
        onRetry={round.newRound}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <MatchBoard key={round.roundId} turns={turns} onAgain={round.newRound} collect={collect} isDarkMode={isDarkMode} />
  );
};

PictureMatchGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureMatchGame;
