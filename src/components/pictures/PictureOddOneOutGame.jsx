import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { usePictureRound } from "../../hooks/usePictureRound";
import { useAlbumStickers } from "../../hooks/useAlbumStickers";
import { useInterestTopics } from "../../hooks/useInterestTopics";
import { useTts } from "../../hooks/useTts";
import { useGameOutcomeSound } from "../../hooks/useSound";
import { play } from "../../services/soundService";
import { buildOddOneOutTurns } from "../../utils/pictureRound";
import { PrimaryButton, TtsControls } from "../ui";
import PictureTile from "./PictureTile";
import PictureRoundStatus from "./PictureRoundStatus";
import PictureRoundResult from "./PictureRoundResult";

/** Turns in a round. */
const TURNS = 6;

/** One round on the board; keyed on the round by its parent. */
const OddBoard = ({ turns, onAgain, collect, isDarkMode }) => {
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
  useGameOutcomeSound({ won: done && score * 2 >= turns.length });

  if (done) {
    return (
      <PictureRoundResult
        headline={t("picture_games.odd.result", { score, total: turns.length })}
        detail={t("picture_games.odd.result_hint")}
        onAgain={onAgain}
        isDarkMode={isDarkMode}
      />
    );
  }

  const answered = pickedId !== null;
  const stateOf = (item) => {
    if (!answered) return "idle";
    if (item.conceptId === turn.intruder.conceptId) return "correct";
    if (item.conceptId === pickedId) return "wrong";
    return "idle";
  };

  const handlePick = (conceptId) => {
    if (answered) return;
    setPickedId(conceptId);
    const correct = conceptId === turn.intruder.conceptId;
    play(correct ? "answer_correct" : "answer_wrong");
    if (correct) {
      setScore((value) => value + 1);
      // The one that does not belong is the one that was singled out, so it is
      // the one that gets the sticker.
      setGotSticker(collect([turn.intruder.conceptId]).length > 0);
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
          {t("picture_games.odd.turn", { current: index + 1, total: turns.length })}
        </span>
        <span className={`text-xs font-black uppercase tracking-widest ${muted}`}>
          {t("picture_games.odd.score", { score })}
        </span>
      </div>

      <p className={`text-center text-sm sm:text-base font-black uppercase tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        {t("picture_games.odd.question")}
      </p>

      <div className="grid grid-cols-2 gap-4 w-full">
        {turn.items.map((item, i) => (
          <div key={item.conceptId} className="flex flex-col gap-2">
            <PictureTile
              url={item.url}
              conceptId={item.conceptId}
              isDarkMode={isDarkMode}
              state={stateOf(item)}
              disabled={answered}
              onClick={() => handlePick(item.conceptId)}
              // All four words are on show once it is answered, so a picture
              // that does not match its word can be noticed on any of them.
              showReport={answered}
              ariaLabel={t("picture_games.match.option", { n: i + 1 })}
            />
            {answered && (
              <div className="flex items-center justify-center gap-2 animate-in fade-in">
                <span lang={dialect} className={`text-base sm:text-lg font-black ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                  {item.word}
                </span>
                <TtsControls
                  ttsKey={`picture-odd-${item.conceptId}`}
                  text={item.word}
                  lang={dialect}
                  token={user?.token}
                  accent="sky"
                  variant="single"
                  iconSize={16}
                  ttsState={ttsState}
                  playTts={playTts}
                  pauseTts={pauseTts}
                  stopTts={stopTts}
                  isDarkMode={isDarkMode}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {answered && (
        <div className="flex flex-col items-center gap-3 text-center animate-in fade-in" aria-live="polite">
          <p className={`text-lg font-black ${pickedId === turn.intruder.conceptId ? "text-emerald-500" : "text-rose-500"}`}>
            {pickedId === turn.intruder.conceptId
              ? t("picture_games.odd.right")
              : t("picture_games.odd.wrong", { word: turn.intruder.word })}
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

OddBoard.propTypes = {
  turns: PropTypes.array.isRequired,
  onAgain: PropTypes.func.isRequired,
  collect: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

/**
 * Qual é o intruso? (picture_odd_one_out)
 *
 * Four pictures, three from one topic: tap the one that does not belong. All
 * four words are shown afterwards, which is where the practice is: "these three
 * are animals, and this is the word for the sofa".
 *
 * It needs words that are *tagged* with topics (an untagged word is not known
 * to belong anywhere, so it can be neither one of the three nor the outsider),
 * and enough of them across topics. A pool without that says so, rather than
 * building a turn it cannot make fair.
 */
const PictureOddOneOutGame = ({ isDarkMode }) => {
  const round = usePictureRound({ want: 0, poolSize: 40, minWords: 4 });
  const { collect } = useAlbumStickers();
  const { topics } = useInterestTopics();
  const topicKey = topics.map((topic) => topic.id).join("|");

  const turns = useMemo(
    () =>
      round.status === "ready"
        ? buildOddOneOutTurns(round.pool, { turns: TURNS, preferTopicIds: topicKey ? topicKey.split("|") : [] })
        : [],
    [round.status, round.pool, topicKey],
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
    <OddBoard key={round.roundId} turns={turns} onAgain={round.newRound} collect={collect} isDarkMode={isDarkMode} />
  );
};

PictureOddOneOutGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureOddOneOutGame;
