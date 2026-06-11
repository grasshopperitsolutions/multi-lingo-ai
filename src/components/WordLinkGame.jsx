import { useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import {
  getUserGameProgress,
  recordPlay,
  resetSeenWordLinkPuzzles,
  getSeenWordLinkPuzzleIds,
  markWordLinkPuzzleSeen,
} from "../services/userService";
import { fetchWordLinkPuzzle, getWordLinkPoolCount } from "../services/wordLinkService";
import ChallengeSidebar from "./ChallengeSidebar";
import Loader from "./Loader";
import { sanitizeAIError } from "../utils/errorUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GAME_ID = "word_link";

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

// ---------------------------------------------------------------------------
// Answer matching — case-insensitive, checks if guess CONTAINS any keyword
// ---------------------------------------------------------------------------
const matchesAnswer = (guess, keywords) => {
  const normalised = guess.trim().toLowerCase();
  if (!normalised) return false;
  return keywords.some((kw) => normalised.includes(kw.toLowerCase()));
};

// ---------------------------------------------------------------------------
// ClueStack — blue gradient stacked rows (light & dark)
// ---------------------------------------------------------------------------
const CLUE_COLORS_LIGHT = [
  "bg-blue-200",
  "bg-blue-300",
  "bg-blue-400",
  "bg-blue-500",
  "bg-blue-600",
];
const CLUE_COLORS_DARK = [
  "bg-blue-950",
  "bg-blue-900",
  "bg-blue-800",
  "bg-blue-700",
  "bg-blue-600",
];

const ClueStack = ({ clues, revealedCount, theme, themeTranslation, gameOver, isDarkMode }) => {
  const colors = isDarkMode ? CLUE_COLORS_DARK : CLUE_COLORS_LIGHT;

  return (
    <div className={`w-full max-w-sm mx-auto rounded-2xl overflow-hidden border-4 shadow-[6px_6px_0px_0px_#0f172a] ${
      isDarkMode ? "border-slate-700" : "border-slate-900"
    }`}>
      {clues.map((clue, i) => {
        const visible    = i < revealedCount;
        const colorClass = colors[i] ?? colors[colors.length - 1];
        const lightText  = i >= 3;
        return (
          <div
            key={i}
            className={`flex items-center justify-center py-5 px-4 text-center font-black text-lg sm:text-xl uppercase tracking-tight transition-all duration-500 ${colorClass} ${
              isDarkMode || lightText ? "text-white" : "text-slate-900"
            }`}
            style={{ minHeight: "64px", opacity: visible ? 1 : 0 }}
          >
            {visible ? clue : "\u00a0"}
          </div>
        );
      })}

      {/* Theme row — shows both languages when game is over */}
      <div className={`flex flex-col items-center justify-center gap-0.5 py-4 px-4 text-center transition-all duration-500 ${
        isDarkMode ? "bg-blue-950 text-blue-200" : "bg-blue-100 text-blue-700"
      }`}>
        <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
          <span className="text-lg">✅</span>
          <span className={gameOver ? "" : "blur-sm select-none"}>
            {theme}
          </span>
        </div>
        {themeTranslation && themeTranslation !== theme && (
          <span className={`text-xs font-medium opacity-70 ${
            gameOver ? "" : "blur-sm select-none"
          }`}>
            {themeTranslation}
          </span>
        )}
      </div>
    </div>
  );
};

ClueStack.propTypes = {
  clues:            PropTypes.arrayOf(PropTypes.string).isRequired,
  revealedCount:    PropTypes.number.isRequired,
  theme:            PropTypes.string.isRequired,
  themeTranslation: PropTypes.string.isRequired,
  gameOver:         PropTypes.bool.isRequired,
  isDarkMode:       PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// WrongGuesses — strikethrough list below the stack
// ---------------------------------------------------------------------------
const WrongGuesses = ({ guesses, isDarkMode }) => {
  if (!guesses.length) return null;
  return (
    <div className={`w-full max-w-sm mx-auto rounded-xl border-2 px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 ${
      isDarkMode ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"
    }`}>
      {guesses.map((g, i) => (
        <span
          key={i}
          className={`text-sm font-bold line-through ${
            isDarkMode ? "text-slate-500" : "text-slate-400"
          }`}
        >
          {g}
        </span>
      ))}
    </div>
  );
};

WrongGuesses.propTypes = {
  guesses:    PropTypes.arrayOf(PropTypes.string).isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const WordLinkGame = ({ isDarkMode }) => {
  const { t }    = useTranslation();
  const { user } = useAppContext();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang   = user?.interfaceLang   ?? "en-US";

  // ── Puzzle state ─────────────────────────────────────────────────────────
  const [puzzleId,         setPuzzleId]         = useState(null);
  const [theme,            setTheme]            = useState("");
  const [themeTranslation, setThemeTranslation] = useState("");
  const [clues,            setClues]            = useState([]);
  const [keywords,         setKeywords]         = useState([]);

  // ── Game state ───────────────────────────────────────────────────────────
  const [revealedCount, setRevealedCount] = useState(1);
  const [guess,         setGuess]         = useState("");
  const [wrongGuesses,  setWrongGuesses]  = useState([]);
  const [gameStatus,    setGameStatus]    = useState("playing");

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
        getSeenWordLinkPuzzleIds(user.token, user.uid),
        getWordLinkPoolCount(user.token, interfaceLang, learningDialect),
      ]);
      setProgress(prog);
      setSeenCount(seenIds.length);
      setTotalWords(poolCount);
    } catch (err) {
      console.warn("[WordLinkGame] fetchStats failed:", err);
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
        getSeenWordLinkPuzzleIds(user.token, user.uid),
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
      ]);

      const puzzle = await fetchWordLinkPuzzle({
        token:          user.token,
        userDialect:    interfaceLang,
        learningDialect,
        seenPuzzleIds:  seenIds,
      });

      setPuzzleId(puzzle.puzzleId);
      setTheme(puzzle.theme);
      setThemeTranslation(puzzle.themeTranslation ?? "");
      setClues(puzzle.clues);
      setKeywords(puzzle.keywords);
      setRevealedCount(1);
      setGuess("");
      setWrongGuesses([]);
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
      .catch((err) => console.warn("[WordLinkGame] recordPlay failed:", err));

    getSeenWordLinkPuzzleIds(user.token, user.uid)
      .then((currentSeenIds) =>
        markWordLinkPuzzleSeen(user.token, user.uid, puzzleId, currentSeenIds)
      )
      .then(() => fetchStats())
      .catch((err) => console.warn("[WordLinkGame] markWordLinkPuzzleSeen failed:", err));
  }, [puzzleId, user, learningDialect, progress, fetchStats]);

  // ── Submit guess ─────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault();
      if (gameStatus !== "playing" || !guess.trim()) return;

      if (matchesAnswer(guess, keywords)) {
        setGameStatus("won");
        markSeenAndRecord();
      } else {
        const newWrong     = [...wrongGuesses, guess.trim()];
        const nextRevealed = revealedCount + 1;
        setWrongGuesses(newWrong);
        setGuess("");

        if (nextRevealed > clues.length) {
          setGameStatus("lost");
          markSeenAndRecord();
        } else {
          setRevealedCount(nextRevealed);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    },
    [guess, gameStatus, keywords, wrongGuesses, revealedCount, clues.length, markSeenAndRecord]
  );

  const handleResetSeenWords = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetSeenWordLinkPuzzles(user.token, user.uid);
    await fetchStats();
  }, [user, fetchStats]);

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
  const score  = isWon ? revealedCount : null;

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">

      {/* ── Main game column ── */}
      <div className="flex flex-col items-center flex-1 min-w-0 w-full gap-6">

        {/* Clue progress dots */}
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: clues.length }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-8 rounded-full transition-all duration-300 ${
                i < revealedCount
                  ? isDarkMode ? "bg-blue-400" : "bg-blue-500"
                  : isDarkMode ? "bg-slate-700" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Clue stack */}
        <ClueStack
          clues={clues}
          revealedCount={revealedCount}
          theme={theme}
          themeTranslation={themeTranslation}
          gameOver={isOver}
          isDarkMode={isDarkMode}
        />

        {/* Wrong guesses */}
        <WrongGuesses guesses={wrongGuesses} isDarkMode={isDarkMode} />

        {/* ── Input / Result ── */}
        {!isOver ? (
          <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              placeholder={t("challenges.word_link_placeholder", "What's the theme?")}
              className={`w-full px-4 py-3 rounded-xl border-4 font-semibold text-base outline-none transition-all ${
                isDarkMode
                  ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-400"
                  : "bg-white border-slate-900 text-slate-900 placeholder:text-slate-400 focus:border-blue-500"
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
                  ? "bg-blue-500 border-slate-700 text-white hover:bg-blue-400"
                  : "bg-blue-500 border-slate-900 text-white hover:bg-blue-600"
              }`}
            >
              {t("challenges.word_link_guess", "Guess")}
            </button>
            <p className={`text-center text-xs font-medium ${
              isDarkMode ? "text-slate-500" : "text-slate-400"
            }`}>
              {t("challenges.word_link_clues_left", {
                count: clues.length - revealedCount,
                defaultValue: "{{count}} clue(s) remaining",
              })}
            </p>
          </form>
        ) : (
          <div className={`flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 ${
            isWon ? "text-emerald-500" : "text-rose-500"
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{isWon ? "🎉" : "😔"}</span>
              <span className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">
                {isWon
                  ? t("challenges.word_link_won", "Linked!")
                  : t("challenges.word_link_lost", "No Link!")}
              </span>
            </div>

            {isWon && score !== null && (
              <p className={`text-base font-semibold ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                {t("challenges.word_link_score", {
                  count: score,
                  defaultValue: "Guessed in {{count}} clue(s)!",
                })}
              </p>
            )}

            {isLost && (
              <p className={`text-base font-semibold ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                {t("challenges.word_link_answer", "The theme was: ")}
                <span className="font-black text-blue-500">{theme}</span>
                {themeTranslation && themeTranslation !== theme && (
                  <span className={`ml-1 font-normal text-sm ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}>
                    ({themeTranslation})
                  </span>
                )}
              </p>
            )}

            <button
              onClick={loadPuzzle}
              className={`px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all active:scale-95 ${
                isDarkMode
                  ? "bg-blue-500 border-slate-700 text-white hover:bg-blue-400"
                  : "bg-blue-500 border-slate-900 text-white hover:bg-blue-600"
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
        onReset={handleResetSeenWords}
        title={t("challenges.sidebar.title")}
        resetTitle={t("challenges.sidebar.reset_title")}
        resetMessage={t("challenges.sidebar.reset_message")}
        resetWarning={t("challenges.sidebar.reset_warning")}
        resetConfirmLabel={t("challenges.sidebar.reset_confirm")}
      />
    </div>
  );
};

WordLinkGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default WordLinkGame;
