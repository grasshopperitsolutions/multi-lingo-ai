import { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import {
  getUserGameProgress,
  recordPlay,
  resetSeenWordLadderPuzzles,
  getSeenWordLadderPuzzleIds,
  markWordLadderPuzzleSeen,
} from "../services/userService";
import { fetchWordLadderPuzzle, getWordLadderPoolCount, MAX_STRIKES } from "../services/wordLadderService";
import ChallengeSidebar from "./ChallengeSidebar";
import Loader from "./Loader";
import { sanitizeAIError } from "../utils/errorUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GAME_ID = "word_ladder";

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

// ---------------------------------------------------------------------------
// Utility — check if two strings differ by exactly 1 char (client-side guard)
// ---------------------------------------------------------------------------
const diffByOne = (a, b) => {
  if (a.length !== b.length) return false;
  return [...a].filter((ch, i) => ch !== b[i]).length === 1;
};

// ---------------------------------------------------------------------------
// LetterTiles — displays a word as individual letter boxes
// ---------------------------------------------------------------------------
const LetterTiles = ({ word, status, isDarkMode }) => {
  const tileBase = "w-9 h-10 sm:w-10 sm:h-11 flex items-center justify-center rounded-lg border-2 font-black text-base sm:text-lg uppercase tracking-widest transition-all duration-300";

  const tileColor = () => {
    if (status === "solved")
      return isDarkMode
        ? "bg-emerald-700 border-emerald-500 text-white"
        : "bg-emerald-400 border-emerald-600 text-slate-900";
    if (status === "failed")
      return isDarkMode
        ? "bg-rose-900 border-rose-600 text-rose-200"
        : "bg-rose-200 border-rose-400 text-rose-900";
    if (status === "active")
      return isDarkMode
        ? "bg-orange-700 border-orange-400 text-white animate-pulse"
        : "bg-orange-200 border-orange-500 text-slate-900 animate-pulse";
    // idle (not yet reached)
    return isDarkMode
      ? "bg-slate-700 border-slate-600 text-slate-500"
      : "bg-slate-100 border-slate-300 text-slate-300";
  };

  return (
    <div className="flex gap-1.5 sm:gap-2">
      {[...word].map((ch, i) => (
        <div key={i} className={`${tileBase} ${tileColor()}`}>
          {status !== "idle" ? ch : "?"}
        </div>
      ))}
    </div>
  );
};

LetterTiles.propTypes = {
  word:       PropTypes.string.isRequired,
  status:     PropTypes.oneOf(["idle", "active", "solved", "failed"]).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// LadderRow — one rung: step number + tiles + clue
// ---------------------------------------------------------------------------
const LadderRow = ({ index, word, clue, status, isDarkMode }) => {
  const rowBase = "flex items-center gap-3 sm:gap-4 py-2 px-3 rounded-xl transition-all duration-300";
  const rowBg = () => {
    if (status === "active")
      return isDarkMode ? "bg-slate-700" : "bg-orange-50 border border-orange-200";
    if (status === "solved")
      return isDarkMode ? "bg-slate-800" : "bg-emerald-50";
    return "";
  };

  return (
    <div className={`${rowBase} ${rowBg()}`}>
      {/* Step number */}
      <span className={`text-xs font-black w-5 text-center shrink-0 ${
        status === "idle"
          ? isDarkMode ? "text-slate-600" : "text-slate-300"
          : isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>
        {index + 1}
      </span>

      {/* Letter tiles */}
      <LetterTiles word={word} status={status} isDarkMode={isDarkMode} />

      {/* Clue */}
      <span className={`text-sm font-semibold leading-snug ${
        status === "idle"
          ? isDarkMode ? "text-slate-600" : "text-slate-300"
          : isDarkMode ? "text-slate-300" : "text-slate-700"
      }`}>
        {status !== "idle" ? clue : "—"}
      </span>
    </div>
  );
};

LadderRow.propTypes = {
  index:      PropTypes.number.isRequired,
  word:       PropTypes.string.isRequired,
  clue:       PropTypes.string.isRequired,
  status:     PropTypes.oneOf(["idle", "active", "solved", "failed"]).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// StrikeIndicator — 3 dots showing remaining attempts
// ---------------------------------------------------------------------------
const StrikeIndicator = ({ strikesLeft, isDarkMode }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: MAX_STRIKES }).map((_, i) => (
      <div
        key={i}
        className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
          i < strikesLeft
            ? isDarkMode ? "bg-orange-400 border-orange-400" : "bg-orange-500 border-orange-500"
            : isDarkMode ? "bg-slate-700 border-slate-600" : "bg-slate-200 border-slate-300"
        }`}
      />
    ))}
    <span className={`text-xs font-semibold ${
      isDarkMode ? "text-slate-400" : "text-slate-500"
    }`}>
      {strikesLeft} attempt{strikesLeft !== 1 ? "s" : ""} left
    </span>
  </div>
);

StrikeIndicator.propTypes = {
  strikesLeft: PropTypes.number.isRequired,
  isDarkMode:  PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const WordLadderGame = ({ isDarkMode }) => {
  const { t }    = useTranslation();
  const { user } = useAppContext();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang   = user?.interfaceLang   ?? "en-US";

  // ── Puzzle state ─────────────────────────────────────────────────────────
  const [puzzleId,   setPuzzleId]   = useState(null);
  const [words,      setWords]      = useState([]);
  const [clues,      setClues]      = useState([]);

  // ── Game state ───────────────────────────────────────────────────────────
  const [currentStep,  setCurrentStep]  = useState(0);  // index of row being guessed
  const [solvedSteps,  setSolvedSteps]  = useState([]); // array of solved indices
  const [failedSteps,  setFailedSteps]  = useState([]); // indices failed (strike used)
  const [strikesLeft,  setStrikesLeft]  = useState(MAX_STRIKES);
  const [guess,        setGuess]        = useState("");
  const [shakeInput,   setShakeInput]   = useState(false);
  const [gameStatus,   setGameStatus]   = useState("playing"); // 'playing'|'won'|'lost'

  // ── Loading / error ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Sidebar / stats ──────────────────────────────────────────────────────
  const [progress,       setProgress]       = useState(null);
  const [seenCount,      setSeenCount]      = useState(0);
  const [totalWords,     setTotalWords]     = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const hasRecordedRef = useRef(false);
  const inputRef       = useRef(null);

  // ── Fetch stats ──────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    setIsLoadingStats(true);
    try {
      const [prog, seenIds, poolCount] = await Promise.all([
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
        getSeenWordLadderPuzzleIds(user.token, user.uid),
        getWordLadderPoolCount(user.token, interfaceLang, learningDialect),
      ]);
      setProgress(prog);
      setSeenCount(seenIds.length);
      setTotalWords(poolCount);
    } catch (err) {
      console.warn("[WordLadderGame] fetchStats failed:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user, learningDialect, interfaceLang]);

  // ── Load puzzle ──────────────────────────────────────────────────────────
  const loadPuzzle = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    setError(null);
    hasRecordedRef.current = false;

    try {
      const [seenIds, prog] = await Promise.all([
        getSeenWordLadderPuzzleIds(user.token, user.uid),
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
      ]);

      const puzzle = await fetchWordLadderPuzzle({
        token:          user.token,
        userDialect:    interfaceLang,
        learningDialect,
        seenPuzzleIds:  seenIds,
      });

      setPuzzleId(puzzle.puzzleId);
      setWords(puzzle.words);
      setClues(puzzle.clues);
      setCurrentStep(0);
      setSolvedSteps([]);
      setFailedSteps([]);
      setStrikesLeft(MAX_STRIKES);
      setGuess("");
      setGameStatus("playing");
      setProgress(prog);
      setSeenCount(seenIds.length);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        alert(t("challenges.session_expired"));
        window.location.reload();
        return;
      }
      setError(sanitizeAIError(err.message, t("challenges.word_fetch_error")));
    } finally {
      setLoading(false);
      setIsLoadingStats(false);
    }
  }, [user, interfaceLang, learningDialect, t]);

  useEffect(() => {
    loadPuzzle();
  }, [loadPuzzle]);

  // ── Mark puzzle seen + record play ───────────────────────────────────────
  const markSeenAndRecord = useCallback(async () => {
    if (hasRecordedRef.current || !puzzleId || !user?.token || !user?.uid) return;
    hasRecordedRef.current = true;

    recordPlay(user.token, user.uid, GAME_ID, learningDialect, progress)
      .catch((err) => console.warn("[WordLadderGame] recordPlay failed:", err));

    getSeenWordLadderPuzzleIds(user.token, user.uid)
      .then((currentSeenIds) =>
        markWordLadderPuzzleSeen(user.token, user.uid, puzzleId, currentSeenIds)
      )
      .then(() => fetchStats())
      .catch((err) => console.warn("[WordLadderGame] markWordLadderPuzzleSeen failed:", err));
  }, [puzzleId, user, learningDialect, progress, fetchStats]);

  // ── Trigger shake animation ───────────────────────────────────────────────
  const triggerShake = useCallback(() => {
    setShakeInput(true);
    setTimeout(() => setShakeInput(false), 500);
  }, []);

  // ── Submit guess ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      if (gameStatus !== "playing" || !guess.trim()) return;

      const normalised    = guess.trim().toLowerCase();
      const correctAnswer = words[currentStep]?.toLowerCase();

      if (normalised === correctAnswer) {
        // Correct!
        const newSolved = [...solvedSteps, currentStep];
        setSolvedSteps(newSolved);
        setGuess("");

        const nextStep = currentStep + 1;
        if (nextStep >= words.length) {
          // All steps done — won!
          setGameStatus("won");
          markSeenAndRecord();
        } else {
          setCurrentStep(nextStep);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      } else {
        // Wrong
        triggerShake();
        setGuess("");
        const newStrikes = strikesLeft - 1;
        setStrikesLeft(newStrikes);
        setFailedSteps((prev) => [...prev, currentStep]);

        if (newStrikes <= 0) {
          setGameStatus("lost");
          markSeenAndRecord();
        } else {
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    },
    [guess, gameStatus, words, currentStep, solvedSteps, strikesLeft, markSeenAndRecord, triggerShake]
  );

  const handleResetSeenPuzzles = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetSeenWordLadderPuzzles(user.token, user.uid);
    await fetchStats();
  }, [user, fetchStats]);

  // ── Status helper for each row ────────────────────────────────────────────
  const getRowStatus = useCallback((index) => {
    if (solvedSteps.includes(index)) return "solved";
    if (gameStatus === "lost" && index === currentStep) return "failed";
    if (gameStatus !== "playing" && index > currentStep) return "idle";
    if (index === currentStep) return "active";
    if (index < currentStep) return "solved"; // already passed
    return "idle";
  }, [solvedSteps, currentStep, gameStatus]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return <Loader isDarkMode={isDarkMode} message={t("challenges.loading_word")} />;
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-4 animate-in fade-in">
        <p className="text-rose-500 font-semibold text-center px-4">{error}</p>
        <button
          onClick={loadPuzzle}
          className={`px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
            isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          {t("challenges.try_again")}
        </button>
      </div>
    );
  }

  const isWon  = gameStatus === "won";
  const isLost = gameStatus === "lost";
  const isOver = isWon || isLost;

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">

      {/* ── Main game column ── */}
      <div className="flex flex-col items-center flex-1 min-w-0 w-full gap-5">

        {/* Strike indicator */}
        {!isOver && (
          <StrikeIndicator strikesLeft={strikesLeft} isDarkMode={isDarkMode} />
        )}

        {/* Ladder */}
        <div className={`w-full max-w-lg rounded-2xl border-4 overflow-hidden shadow-[6px_6px_0px_0px_#0f172a] ${
          isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-900 bg-white"
        }`}>
          {/* Header */}
          <div className={`px-4 py-3 border-b-2 ${
            isDarkMode ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-50"
          }`}>
            <p className={`text-xs font-black uppercase tracking-widest ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {t("challenges.word_ladder_subtitle", "Each word changes by one letter")}
            </p>
          </div>

          {/* Rows */}
          <div className="flex flex-col gap-1 p-3">
            {words.map((word, i) => (
              <LadderRow
                key={i}
                index={i}
                word={word}
                clue={clues[i] ?? ""}
                status={getRowStatus(i)}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        </div>

        {/* ── Input / Result ── */}
        {!isOver ? (
          <form
            onSubmit={handleSubmit}
            className={`w-full max-w-lg flex flex-col gap-3 ${
              shakeInput ? "animate-shake" : ""
            }`}
          >
            <div className={`text-xs font-semibold text-center ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {t("challenges.word_ladder_clue_label", "Clue for word {{step}}:", { step: currentStep + 1 })}
              {" "}
              <span className={`font-black ${
                isDarkMode ? "text-orange-400" : "text-orange-600"
              }`}>
                {clues[currentStep]}
              </span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder={t("challenges.word_ladder_placeholder", "Type the word…")}
              className={`w-full px-4 py-3 rounded-xl border-4 font-semibold text-base outline-none transition-all uppercase tracking-widest ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-orange-400"
                  : "bg-white border-slate-900 text-slate-900 placeholder:text-slate-400 focus:border-orange-500"
              }`}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={!guess.trim()}
              className={`w-full py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode
                  ? "bg-orange-500 border-slate-700 text-white hover:bg-orange-400"
                  : "bg-orange-500 border-slate-900 text-white hover:bg-orange-600"
              }`}
            >
              {t("challenges.word_ladder_guess", "Submit")}
            </button>
          </form>
        ) : (
          <div className={`flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 ${
            isWon ? "text-emerald-500" : "text-rose-500"
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{isWon ? "🏆" : "😔"}</span>
              <span className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">
                {isWon
                  ? t("challenges.word_ladder_won", "Climbed!")
                  : t("challenges.word_ladder_lost", "Fell off!")}
              </span>
            </div>

            {isWon && (
              <p className={`text-base font-semibold ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                {t("challenges.word_ladder_won_desc", "You climbed all {{count}} rungs!", { count: words.length })}
              </p>
            )}

            {isLost && (
              <p className={`text-base font-semibold ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                {t("challenges.word_ladder_answer", "The word was: ")}
                <span className={`font-black ${
                  isDarkMode ? "text-orange-400" : "text-orange-600"
                }`}>
                  {words[currentStep]}
                </span>
              </p>
            )}

            <button
              onClick={loadPuzzle}
              className={`px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-orange-500 border-slate-700 text-white hover:bg-orange-400"
                  : "bg-orange-500 border-slate-900 text-white hover:bg-orange-600"
              }`}
            >
              {t("challenges.next_word", "Next Puzzle")}
            </button>
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <ChallengeSidebar
        isDarkMode={isDarkMode}
        seenCount={seenCount}
        progress={progress}
        totalWords={totalWords}
        isLoadingStats={isLoadingStats}
        onReset={handleResetSeenPuzzles}
        title={t("challenges.sidebar.title")}
        resetTitle={t("challenges.sidebar.reset_title")}
        resetMessage={t("challenges.sidebar.reset_message")}
        resetWarning={t("challenges.sidebar.reset_warning")}
        resetConfirmLabel={t("challenges.sidebar.reset_confirm")}
      />
    </div>
  );
};

WordLadderGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default WordLadderGame;
