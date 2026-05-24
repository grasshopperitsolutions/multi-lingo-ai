import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, RefreshCw, Undo2, RotateCcw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { getUserGameProgress, markConceptSeen, resetSeenWords } from "../services/userService";
import { getWord, getWordPoolCount } from "../services/getWordService";
import ChallengeSidebar from "./ChallengeSidebar";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GAME_ID = "scrambled_word";
const MAX_RESHUFFLES = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const normalizeChar = (c) =>
  c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

/**
 * Shuffle an array. If the result equals the original order, re-shuffle.
 * Works correctly for single-char arrays and words with repeated letters.
 */
const shuffle = (arr) => {
  if (arr.length <= 1) return [...arr];
  let result;
  let attempts = 0;
  do {
    result = [...arr].sort(() => Math.random() - 0.5);
    attempts++;
  } while (result.join("") === arr.join("") && attempts < 20);
  return result;
};

// ---------------------------------------------------------------------------
// LetterTile — a single draggable/tappable letter
// ---------------------------------------------------------------------------
const LetterTile = ({ letter, onClick, isDarkMode, variant = "pool", disabled = false }) => {
  const base =
    "w-10 h-12 sm:w-12 sm:h-14 rounded-xl border-4 font-black text-lg sm:text-2xl flex items-center justify-center transition-all select-none";

  const poolStyle = isDarkMode
    ? "bg-slate-700 border-slate-500 text-white hover-neo-dark active-neo"
    : "bg-white border-slate-900 text-slate-900 hover-neo-light active-neo";

  const answerStyle = isDarkMode
    ? "bg-yellow-400 border-slate-900 text-slate-900"
    : "bg-yellow-400 border-slate-900 text-slate-900";

  const disabledStyle = "opacity-40 cursor-not-allowed";

  const style = variant === "answer" ? answerStyle : poolStyle;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${style} ${disabled ? disabledStyle : ""}`}
      aria-label={letter}
    >
      {letter}
    </button>
  );
};

LetterTile.propTypes = {
  letter: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  variant: PropTypes.oneOf(["pool", "answer"]),
  disabled: PropTypes.bool,
};

// ---------------------------------------------------------------------------
// AnswerSlot — an empty or filled slot in the answer row
// ---------------------------------------------------------------------------
const AnswerSlot = ({ letter, isDarkMode }) => {
  const filled = letter !== null;
  return (
    <div
      className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border-4 font-black text-lg sm:text-2xl flex items-center justify-center transition-all ${
        filled
          ? "bg-yellow-400 border-slate-900 text-slate-900"
          : isDarkMode
          ? "bg-slate-800 border-slate-600 text-slate-600"
          : "bg-slate-100 border-slate-300 text-slate-300"
      }`}
    >
      {filled ? letter : "_"}
    </div>
  );
};

AnswerSlot.propTypes = {
  letter: PropTypes.string,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// ReshuffleTracker — shows remaining reshuffles as dots (like a lives bar)
// ---------------------------------------------------------------------------
const ReshuffleTracker = ({ remaining, max, isDarkMode }) => (
  <div className="flex items-center gap-1.5" aria-label={`${remaining} reshuffles remaining`}>
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        className={`w-3 h-3 rounded-full border-2 transition-all ${
          i < remaining
            ? isDarkMode
              ? "bg-orange-400 border-orange-400"
              : "bg-orange-500 border-orange-500"
            : isDarkMode
            ? "bg-slate-700 border-slate-600"
            : "bg-slate-200 border-slate-300"
        }`}
      />
    ))}
  </div>
);

ReshuffleTracker.propTypes = {
  remaining: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component — ScrambledWordGame
// ---------------------------------------------------------------------------
const ScrambledWordGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const nativeDialect   = user?.nativeDialect   ?? "en-US";

  // ── Difficulty ──
  const [hardMode, setHardMode] = useState(false);

  // ── Word state ──
  const [word, setWord] = useState("");  // uppercased target
  const [hint, setHint] = useState("");

  // ── Game state ──
  // pool: array of { id, letter } objects — letters still available to place
  // answer: array of { id, letter } objects — letters placed by the player
  const [pool,   setPool]   = useState([]);
  const [answer, setAnswer] = useState([]);
  const [reshufflesLeft, setReshufflesLeft] = useState(MAX_RESHUFFLES);

  // ── Result ──
  const [isWinner, setIsWinner] = useState(false);
  const [isLoser,  setIsLoser]  = useState(false);

  // ── Loading / error ──
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Sidebar / stats ──
  const [progress,       setProgress]      = useState(null);
  const [totalWords,     setTotalWords]     = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const pendingMarkRef = useRef(null);

  // ── Derived: display letters for the word (respecting hard/easy mode) ──
  const wordLetters = useMemo(() => word.split(""), [word]);

  // Build a pool with stable unique IDs so React keys don't collide for repeated chars
  const buildPool = useCallback((letters) => {
    const shuffled = shuffle(letters);
    return shuffled.map((letter, i) => ({ id: `${letter}-${i}-${Date.now()}`, letter }));
  }, []);

  // ── Auto-check when all slots are filled ──
  useEffect(() => {
    if (wordLetters.length === 0 || answer.length !== wordLetters.length) return;
    const attempt = answer.map((t) => t.letter).join("");
    const target  = hardMode ? word : word.split("").map(normalizeChar).join("");
    const normalized = hardMode ? attempt : attempt.split("").map(normalizeChar).join("");
    if (normalized === target) {
      setIsWinner(true);
    } else {
      setIsLoser(true);
    }
  }, [answer, wordLetters, word, hardMode]);

  // ── Stats ──
  const fetchStats = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    setIsLoadingStats(true);
    try {
      const [prog, count] = await Promise.all([
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
        getWordPoolCount(user.token),
      ]);
      setProgress(prog);
      setTotalWords(count);
    } catch (err) {
      console.warn("[ScrambledWordGame] fetchStats failed:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user, learningDialect]);

  useEffect(() => {
    if (!user?.token || !user?.uid) return;
    let cancelled = false;
    Promise.all([
      getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
      getWordPoolCount(user.token),
    ])
      .then(([prog, count]) => {
        if (!cancelled) { setProgress(prog); setTotalWords(count); }
      })
      .catch((err) => console.warn("[ScrambledWordGame] initial stats failed:", err))
      .finally(() => { if (!cancelled) setIsLoadingStats(false); });
    return () => { cancelled = true; };
  }, [user, learningDialect]);

  // ── Core word fetch ──
  const fetchWordData = useCallback(async () => {
    if (!user) throw new Error(t("challenges.word_fetch_error"));
    if (pendingMarkRef.current) {
      await pendingMarkRef.current.catch(() => {});
      pendingMarkRef.current = null;
    }
    const { token, uid } = user;
    if (!token) throw new Error(t("challenges.word_fetch_error"));
    const prog   = await getUserGameProgress(token, uid, GAME_ID, learningDialect);
    const result = await getWord({
      token,
      userDialect:    nativeDialect,
      learningDialect,
      seenConceptIds: prog?.seenConceptIds ?? [],
    });
    pendingMarkRef.current = markConceptSeen(
      token, uid, GAME_ID, learningDialect, result.conceptId, prog
    );
    pendingMarkRef.current
      .then(() => fetchStats())
      .catch((err) => console.warn("[ScrambledWordGame] markConceptSeen failed:", err));
    return { word: result.word.toUpperCase(), hint: result.hint, progress: prog };
  }, [user, learningDialect, nativeDialect, t, fetchStats]);

  const initGame = useCallback((fetchedWord) => {
    const letters = fetchedWord.split("");
    setPool(buildPool(letters));
    setAnswer([]);
    setReshufflesLeft(MAX_RESHUFFLES);
    setIsWinner(false);
    setIsLoser(false);
  }, [buildPool]);

  const fetchWord = useCallback(async () => {
    try {
      const data = await fetchWordData();
      setWord(data.word);
      setHint(data.hint);
      setProgress(data.progress);
      initGame(data.word);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        alert(t("challenges.session_expired"));
        window.location.reload();
        return;
      }
      setError(err.message ?? t("challenges.word_fetch_error"));
    } finally {
      setLoading(false);
    }
  }, [fetchWordData, initGame, t]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    fetchWordData()
      .then((data) => {
        if (!cancelled) {
          setWord(data.word);
          setHint(data.hint);
          setProgress(data.progress);
          initGame(data.word);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (isSessionExpiredError(err)) {
            alert(t("challenges.session_expired"));
            window.location.reload();
            return;
          }
          setError(err.message ?? t("challenges.word_fetch_error"));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Reset seen words ──
  const handleResetSeenWords = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetSeenWords(user.token, user.uid, GAME_ID, learningDialect);
    await fetchStats();
  }, [user, learningDialect, fetchStats]);

  // ── Game actions ──
  const handlePlaceLetter = (tile) => {
    if (isWinner || isLoser) return;
    setPool((prev) => prev.filter((t) => t.id !== tile.id));
    setAnswer((prev) => [...prev, tile]);
  };

  const handleUndo = () => {
    if (isWinner || isLoser || answer.length === 0) return;
    const last = answer[answer.length - 1];
    setAnswer((prev) => prev.slice(0, -1));
    setPool((prev) => [...prev, last]);
  };

  const handleReshuffle = () => {
    if (isWinner || isLoser || reshufflesLeft <= 0) return;
    // Put all answer letters back into the pool, then re-shuffle everything
    const allLetters = [
      ...pool.map((t) => t.letter),
      ...answer.map((t) => t.letter),
    ];
    setAnswer([]);
    setPool(buildPool(allLetters));
    setReshufflesLeft((prev) => prev - 1);
  };

  const handlePlayAgain = useCallback(() => {
    setLoading(true);
    setError(null);
    setWord("");
    setHint("");
    fetchWord();
  }, [fetchWord]);

  const handleTryAgain = () => {
    // Same word, reshuffled pool
    initGame(word);
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in">
        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-8">
          {t("challenges.scrambled_word")}
        </h2>
        <div className={`w-48 h-48 mb-8 rounded-2xl border-4 flex items-center justify-center ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-orange-100 border-slate-900"
        }`}>
          <RefreshCw className="w-10 h-10 animate-spin opacity-40" />
        </div>
        <p className={`text-sm italic ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
          {t("challenges.loading_word")}
        </p>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in gap-4">
        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter">
          {t("challenges.scrambled_word")}
        </h2>
        <p className="text-rose-500 font-semibold text-center px-4">{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); fetchWord(); }}
          className={`px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
            isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          {t("challenges.try_again")}
        </button>
      </div>
    );
  }

  // ── Game render ──
  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">

      {/* ── Main game column ── */}
      <div className="flex flex-col items-center flex-1 min-w-0">

        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-4">
          {t("challenges.scrambled_word")}
        </h2>

        {/* Easy / Hard toggle */}
        <div className={`flex mb-6 rounded-full border-4 overflow-hidden ${
          isDarkMode ? "border-slate-700" : "border-slate-900"
        }`}>
          <button
            type="button"
            onClick={() => setHardMode(false)}
            className={`px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
              !hardMode
                ? isDarkMode ? "bg-yellow-400 text-slate-900" : "bg-slate-900 text-white"
                : isDarkMode ? "bg-transparent text-slate-400 hover:text-white" : "bg-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t("challenges.easy")}
          </button>
          <button
            type="button"
            onClick={() => setHardMode(true)}
            className={`px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
              hardMode
                ? isDarkMode ? "bg-yellow-400 text-slate-900" : "bg-slate-900 text-white"
                : isDarkMode ? "bg-transparent text-slate-400 hover:text-white" : "bg-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t("challenges.hard")}
          </button>
        </div>

        {/* Hint */}
        {hint && (
          <p className={`mb-6 text-center text-sm sm:text-base font-medium italic px-4 ${
            isDarkMode ? "text-slate-400" : "text-slate-600"
          }`}>
            {hint}
          </p>
        )}

        {/* Reshuffle tracker */}
        <div className="flex flex-col items-center gap-1 mb-6">
          <p className={`text-xs font-black uppercase tracking-widest ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            {t("challenges.scrambled_reshuffles_left", { count: reshufflesLeft })}
          </p>
          <ReshuffleTracker remaining={reshufflesLeft} max={MAX_RESHUFFLES} isDarkMode={isDarkMode} />
        </div>

        {/* Answer row */}
        <div className="mb-4">
          <p className={`text-xs font-black uppercase tracking-widest text-center mb-3 ${
            isDarkMode ? "text-slate-400" : "text-slate-500"
          }`}>
            {t("challenges.scrambled_your_answer")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {wordLetters.map((_, i) => (
              <AnswerSlot
                key={i}
                letter={answer[i]?.letter ?? null}
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        </div>

        {/* Status messages */}
        {isWinner && (
          <div className="my-4 px-6 py-3 bg-emerald-400 border-4 border-slate-900 rounded-full font-black text-slate-900 text-xl flex items-center gap-2 neo-shadow-light animate-in zoom-in-95">
            <Trophy /> {t("challenges.scrambled_cracked")}
          </div>
        )}
        {isLoser && (
          <div className="my-4 flex flex-col items-center gap-2">
            <div className="px-6 py-3 bg-rose-500 border-4 border-slate-900 rounded-full font-black text-white text-xl neo-shadow-light animate-in zoom-in-95">
              {t("challenges.scrambled_scrambled_up")}
            </div>
            <p className={`text-sm font-semibold ${ isDarkMode ? "text-slate-300" : "text-slate-700" }`}>
              {t("challenges.scrambled_answer_was")}{" "}
              <span className="font-black text-yellow-500">{word}</span>
            </p>
          </div>
        )}

        {/* Letter pool */}
        {!isWinner && !isLoser && (
          <div className="mt-6">
            <p className={`text-xs font-black uppercase tracking-widest text-center mb-3 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}>
              {t("challenges.scrambled_letter_pool")}
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
              {pool.map((tile) => (
                <LetterTile
                  key={tile.id}
                  letter={tile.letter}
                  onClick={() => handlePlaceLetter(tile)}
                  isDarkMode={isDarkMode}
                  variant="pool"
                />
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {!isWinner && !isLoser && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={answer.length === 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-4 font-black uppercase tracking-wider text-sm transition-all ${
                  answer.length === 0
                    ? "opacity-40 cursor-not-allowed"
                    : isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                } ${
                  isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
                }`}
              >
                <Undo2 size={16} />
                {t("challenges.scrambled_undo")}
              </button>

              <button
                type="button"
                onClick={handleReshuffle}
                disabled={reshufflesLeft <= 0}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-4 font-black uppercase tracking-wider text-sm transition-all ${
                  reshufflesLeft <= 0
                    ? "opacity-40 cursor-not-allowed"
                    : isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                } ${
                  isDarkMode ? "bg-orange-500 border-slate-900 text-white" : "bg-orange-400 border-slate-900 text-slate-900"
                }`}
              >
                <RotateCcw size={16} />
                {t("challenges.scrambled_reshuffle")}
              </button>
            </>
          )}

          {isLoser && (
            <button
              type="button"
              onClick={handleTryAgain}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
                isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
              }`}
            >
              <RotateCcw size={16} />
              {t("challenges.scrambled_try_again")}
            </button>
          )}

          {(isWinner || isLoser) && (
            <button
              type="button"
              onClick={handlePlayAgain}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all ${
                isDarkMode ? "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-dark active-neo" : "bg-yellow-400 border-slate-900 text-slate-900 hover-neo-light active-neo"
              }`}
            >
              {t("challenges.play_again")}
            </button>
          )}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <ChallengeSidebar
        isDarkMode={isDarkMode}
        progress={progress}
        totalWords={totalWords}
        isLoadingStats={isLoadingStats}
        onReset={handleResetSeenWords}
        title={t("challenges.scrambled_sidebar_title")}
        resetTitle={t("challenges.scrambled_sidebar_reset_title")}
        resetMessage={t("challenges.scrambled_sidebar_reset_message")}
        resetWarning={t("challenges.sidebar.reset_warning")}
        resetConfirmLabel={t("challenges.sidebar.reset_confirm")}
      />
    </div>
  );
};

ScrambledWordGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ScrambledWordGame;
