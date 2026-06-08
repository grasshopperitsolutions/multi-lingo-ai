import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { RotateCcw, Check, EggFried } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import {
  getUserGameProgress,
  markConceptSeenGlobal,
  getGlobalSeenIds,
  recordPlay,
  resetAllSeenWords,
} from "../services/userService";
import { getWord, getWordPoolCount } from "../services/getWordService";
import ChallengeSidebar from "./ChallengeSidebar";
import TooltipButton from "./TooltipButton";
import Loader from "./Loader";
import { sanitizeAIError } from "../utils/errorUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const GAME_ID = "scrambled_word";
const MAX_ATTEMPTS = 3;

const normalizeChar = (c) =>
  c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

/**
 * Fisher-Yates shuffle — guarantees the result differs from the source order.
 * Falls back to a simple rotation when the word has only 1 unique permutation.
 */
const shuffleLetters = (letters) => {
  if (letters.length <= 1) return [...letters];
  let result;
  let attempts = 0;
  do {
    result = [...letters];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    attempts++;
  } while (result.join("") === letters.join("") && attempts < 20);
  if (result.join("") === letters.join("")) result.reverse();
  return result;
};

// ---------------------------------------------------------------------------
// AttemptsDisplay (egg pips / tries)
// ---------------------------------------------------------------------------
const AttemptsDisplay = ({ attemptsLeft }) => (
  <div className="flex gap-1.5 items-center mb-4">
    {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
      <span
        key={i}
        className={`text-2xl transition-all ${
          i < attemptsLeft ? "opacity-100" : "opacity-20"
        }`}
      >
        🥚
      </span>
    ))}
  </div>
);

AttemptsDisplay.propTypes = {
  attemptsLeft: PropTypes.number.isRequired,
};

// ---------------------------------------------------------------------------
// LetterTile
// ---------------------------------------------------------------------------
const LetterTile = ({ letter, onClick, disabled, variant, isDarkMode }) => {
  const baseClasses =
    "w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 flex items-center justify-center font-black text-lg sm:text-xl uppercase tracking-tighter transition-all select-none";

  const variantClasses = {
    pool: disabled
      ? "opacity-0 pointer-events-none"
      : isDarkMode
      ? "bg-slate-700 border-slate-500 text-white hover-neo-dark cursor-pointer active:scale-95"
      : "bg-white border-slate-900 text-slate-900 hover-neo-light active-neo cursor-pointer active:scale-95",
    answer: letter
      ? isDarkMode
        ? "bg-yellow-400 border-slate-700 text-slate-900 cursor-pointer active:scale-95"
        : "bg-yellow-400 border-slate-900 text-slate-900 cursor-pointer active:scale-95"
      : isDarkMode
      ? "bg-slate-800 border-slate-600 text-transparent"
      : "bg-slate-100 border-slate-300 text-transparent",
    correct: "bg-emerald-400 border-slate-900 text-slate-900 cursor-default",
    wrong: "bg-rose-400 border-slate-900 text-slate-900 cursor-default scrambled-shake",
    separator: "opacity-0 pointer-events-none border-transparent bg-transparent w-4 sm:w-5",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || variant === "correct" || variant === "wrong" || variant === "separator"}
      className={`${baseClasses} ${variantClasses[variant] ?? variantClasses.pool}`}
      aria-label={letter ? `Letter ${letter}` : "Empty slot"}
    >
      {letter ?? ""}
    </button>
  );
};

LetterTile.propTypes = {
  letter: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  variant: PropTypes.oneOf(["pool", "answer", "correct", "wrong", "separator"]),
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const ScrambledWordGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, showAlert } = useAppContext();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang   = user?.interfaceLang   ?? "en-US";

  // ── Difficulty ──────────────────────────────────────────────────────────
  const [hardMode, setHardMode] = useState(false);

  // ── Word state ───────────────────────────────────────────────────────────
  const [word, setWord]           = useState("");
  const [hint, setHint]           = useState("");
  const [conceptId, setConceptId] = useState(null);

  // ── Game state ───────────────────────────────────────────────────────────
  const [pool, setPool]                   = useState([]);
  const [answer, setAnswer]               = useState([]);
  const [attemptsLeft, setAttemptsLeft]   = useState(MAX_ATTEMPTS);
  const [gameStatus, setGameStatus]       = useState("playing");
  const [showResult, setShowResult]       = useState(false);

  // ── Loading / error ──────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Sidebar / stats ──────────────────────────────────────────────────────
  const [progress,       setProgress]       = useState(null);
  const [seenCount,      setSeenCount]      = useState(0);
  const [totalWords,     setTotalWords]     = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Guard: prevent double-recording inside checkAnswer / useEffect
  const hasMarkedRef = useRef(false);

  // ── Derived ──────────────────────────────────────────────────────────────
  const getDisplayLetter = useCallback(
    (letter) => (hardMode ? letter : normalizeChar(letter)),
    [hardMode]
  );

  // ── Build pool & answer from word ────────────────────────────────────────
  const buildPoolAndAnswer = useCallback(
    (rawLetters) => {
      const answerTemplate = rawLetters.map((l) =>
        l === " " ? { id: -1, letter: " ", isSpace: true } : null
      );
      const nonSpaceLetters = rawLetters.filter((l) => l !== " ");
      const displayed = nonSpaceLetters.map((l) => getDisplayLetter(l));
      const shuffled = shuffleLetters(displayed);
      const newPool = shuffled.map((letter, i) => ({ id: i, letter, placed: false }));
      return { newPool, answerTemplate };
    },
    [getDisplayLetter]
  );

  // ── Fetch stats (progress + pool count + global seen count) ─────────────
  const fetchStats = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    setIsLoadingStats(true);
    try {
      const [prog, count, seenIds] = await Promise.all([
        getUserGameProgress(user.token, user.uid, GAME_ID, learningDialect),
        getWordPoolCount(user.token),
        getGlobalSeenIds(user.token, user.uid),
      ]);
      setProgress(prog);
      setTotalWords(count);
      setSeenCount(seenIds.length);
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
      getGlobalSeenIds(user.token, user.uid),
    ])
      .then(([prog, count, seenIds]) => {
        if (!cancelled) {
          setProgress(prog);
          setTotalWords(count);
          setSeenCount(seenIds.length);
        }
      })
      .catch((err) => console.warn("[ScrambledWordGame] fetchStats failed:", err))
      .finally(() => { if (!cancelled) setIsLoadingStats(false); });
    return () => { cancelled = true; };
  }, [user, learningDialect]);

  // ── Core word fetch — reads global seenConceptIds ────────────────────────
  const fetchWordData = useCallback(async () => {
    if (!user) throw new Error(t("challenges.word_fetch_error"));
    const { token, uid } = user;
    if (!token) throw new Error(t("challenges.word_fetch_error"));

    const [prog, seenIds] = await Promise.all([
      getUserGameProgress(token, uid, GAME_ID, learningDialect),
      getGlobalSeenIds(token, uid),
    ]);

    const result = await getWord({
      token,
      userDialect: interfaceLang,
      learningDialect,
      seenConceptIds: seenIds,
    });

    return { word: result.word.toUpperCase(), hint: result.hint, conceptId: result.conceptId, progress: prog };
  }, [user, learningDialect, interfaceLang, t]);

  const applyWordData = useCallback(
    (data) => {
      const rawLetters = data.word.split("");
      const { newPool, answerTemplate } = buildPoolAndAnswer(rawLetters);
      setWord(data.word);
      setHint(data.hint);
      setConceptId(data.conceptId);
      setProgress(data.progress);
      setPool(newPool);
      setAnswer(answerTemplate);
      setAttemptsLeft(MAX_ATTEMPTS);
      setGameStatus("playing");
      setShowResult(false);
      hasMarkedRef.current = false;
    },
    [buildPoolAndAnswer]
  );

  const resetGame = useCallback(() => {
    setLoading(true);
    setError(null);
    setWord("");
    setHint("");
    setConceptId(null);
    setPool([]);
    setAnswer([]);
    setAttemptsLeft(MAX_ATTEMPTS);
    setGameStatus("playing");
    setShowResult(false);
    hasMarkedRef.current = false;
  }, []);

  const fetchWord = useCallback(async () => {
    try {
      const data = await fetchWordData();
      applyWordData(data);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        alert(t("challenges.session_expired"));
        window.location.reload();
        return;
      }
      const errorMessage = sanitizeAIError(err.message, t("challenges.word_fetch_error"));
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchWordData, applyWordData, t]);

  // Show alert with retry action when error is set
  useEffect(() => {
    if (error) {
      showAlert("error", error, {
        label: t("common.try_again", "Try Again"),
        onClick: fetchWord
      });
    }
  }, [error, fetchWord, t, showAlert]);

  useEffect(() => {
    let cancelled = false;
    fetchWordData()
      .then((data) => { if (!cancelled) applyWordData(data); })
      .catch((err) => {
        if (!cancelled) {
          if (isSessionExpiredError(err)) {
            alert(t("challenges.session_expired"));
            window.location.reload();
            return;
          }
          const errorMessage = sanitizeAIError(err.message, t("challenges.word_fetch_error"));
          setError(errorMessage);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchWordData, applyWordData, t]);

  // ── Reset seen words handler — global reset ──────────────────────────────
  const handleResetSeenWords = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetAllSeenWords(user.token, user.uid);
    await fetchStats();
  }, [user, fetchStats]);

  // ── Re-shuffle same word (reshuffle button during play) ─────────────────
  const handleReshuffle = useCallback(() => {
    if (gameStatus !== "playing") return;
    const { newPool, answerTemplate } = buildPoolAndAnswer(word.split(""));
    setPool(newPool);
    setAnswer(answerTemplate);
  }, [word, buildPoolAndAnswer, gameStatus]);

  // ── Play Again — resets state then re-shuffles the SAME word ─────────────
  const handlePlayAgain = useCallback(() => {
    const { newPool, answerTemplate } = buildPoolAndAnswer(word.split(""));
    setPool(newPool);
    setAnswer(answerTemplate);
    setAttemptsLeft(MAX_ATTEMPTS);
    setGameStatus("playing");
    setShowResult(false);
    hasMarkedRef.current = false;
  }, [word, buildPoolAndAnswer]);

  // ── Place letter from pool into next empty answer slot ───────────────────
  const handlePlaceLetter = useCallback(
    (tileId) => {
      if (gameStatus !== "playing") return;
      const tile = pool.find((t) => t.id === tileId && !t.placed);
      if (!tile) return;
      const nextSlot = answer.findIndex((slot) => slot === null);
      if (nextSlot === -1) return;
      setPool((prev) => prev.map((t) => (t.id === tileId ? { ...t, placed: true } : t)));
      setAnswer((prev) => {
        const next = [...prev];
        next[nextSlot] = { id: tileId, letter: tile.letter };
        return next;
      });
    },
    [pool, answer, gameStatus]
  );

  // ── Remove letter from answer back to pool ───────────────────────────────
  const handleRemoveLetter = useCallback(
    (slotIndex) => {
      if (gameStatus !== "playing") return;
      const slot = answer[slotIndex];
      if (!slot || slot.isSpace) return;
      setAnswer((prev) => {
        const next = [...prev];
        next[slotIndex] = null;
        return next;
      });
      setPool((prev) => prev.map((t) => (t.id === slot.id ? { ...t, placed: false } : t)));
    },
    [answer, gameStatus]
  );

  // ── Auto-check when all non-space slots filled ────────────────────────────
  const checkAnswer = useCallback(() => {
    if (gameStatus !== "playing") return;
    if (word.length === 0) return;
    const allFilled = answer.every((s) => s !== null);
    if (!allFilled) return;
    if (hasMarkedRef.current) return;

    const canonical = word
      .split("")
      .map((l) => (l === " " ? " " : getDisplayLetter(l)))
      .join("");
    const attempt = answer.map((s) => s.letter).join("");

    if (attempt === canonical) {
      // ── Correct answer ──
      hasMarkedRef.current = true;
      setGameStatus("won");
      recordPlay(user.token, user.uid, GAME_ID, learningDialect, progress)
        .catch((err) => console.warn("[ScrambledWordGame] recordPlay failed:", err));
      getGlobalSeenIds(user.token, user.uid)
        .then((currentSeenIds) =>
          markConceptSeenGlobal(user.token, user.uid, conceptId, currentSeenIds)
        )
        .then(() => fetchStats())
        .catch((err) => console.warn("[ScrambledWordGame] markConceptSeenGlobal failed:", err));
    } else {
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);
      setShowResult(true);
      setTimeout(() => {
        setShowResult(false);
        if (remaining <= 0) {
          // ── Out of attempts ──
          hasMarkedRef.current = true;
          setGameStatus("lost");
          recordPlay(user.token, user.uid, GAME_ID, learningDialect, progress)
            .then(() => fetchStats())
            .catch((err) => console.warn("[ScrambledWordGame] recordPlay failed:", err));
        } else {
          const { newPool, answerTemplate } = buildPoolAndAnswer(word.split(""));
          setPool(newPool);
          setAnswer(answerTemplate);
        }
      }, 900);
    }
  }, [answer, word, gameStatus, attemptsLeft, getDisplayLetter, buildPoolAndAnswer, conceptId, progress, learningDialect, user, fetchStats]);

  const prevAnswerRef = useRef(null);
  useEffect(() => {
    const prev = prevAnswerRef.current;
    const allFilledNow = answer.length > 0 && answer.every((s) => s !== null);
    const prevHadEmpty = prev !== null && prev.some((s) => s === null);
    if (allFilledNow && prevHadEmpty) checkAnswer();
    prevAnswerRef.current = answer;
  }, [answer, checkAnswer]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return <Loader isDarkMode={isDarkMode} message={t("challenges.loading_word")} />;
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in gap-4">
        <p className="text-rose-500 font-semibold text-center px-4">{error}</p>
        <button
          onClick={() => { resetGame(); fetchWord(); }}
          className={`px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
            isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          {t("challenges.try_again")}
        </button>
      </div>
    );
  }

  // ── Game render ───────────────────────────────────────────────────────────
  const isWon = gameStatus === "won";
  const isLost = gameStatus === "lost";
  const isOver = isWon || isLost;

  const answerVariant = (slot) => {
    if (!slot) return "answer";
    if (slot.isSpace) return "separator";
    if (isWon) return "correct";
    if (isLost) return "wrong";
    if (showResult) return "wrong";
    return "answer";
  };

  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">

      {/* ── Main game column ── */}
      <div className="flex flex-col items-center flex-1 min-w-0 w-full">

        {/* Easy / Hard toggle */}
        <div className={`flex mb-6 rounded-full border-4 overflow-hidden ${
          isDarkMode ? "border-slate-700" : "border-slate-900"
        }`}>
          {[false, true].map((isHard) => (
            <button
              key={String(isHard)}
              type="button"
              onClick={() => {
                if (hardMode === isHard) return;
                const displayFn = (l) =>
                  isHard ? l.toUpperCase() : normalizeChar(l);
                const rawLetters = word.split("");
                const answerTemplate = rawLetters.map((l) =>
                  l === " " ? { id: -1, letter: " ", isSpace: true } : null
                );
                const nonSpace = rawLetters
                  .filter((l) => l !== " ")
                  .map(displayFn);
                const shuffled = shuffleLetters(nonSpace);
                const newPool = shuffled.map((letter, i) => ({
                  id: i,
                  letter,
                  placed: false,
                }));
                setPool(newPool);
                setAnswer(answerTemplate);
                setHardMode(isHard);
                setAttemptsLeft(MAX_ATTEMPTS);
                setGameStatus("playing");
                setShowResult(false);
                hasMarkedRef.current = false;
              }}
              className={`px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
                hardMode === isHard
                  ? isDarkMode
                    ? "bg-yellow-400 text-slate-900"
                    : "bg-slate-900 text-white"
                  : isDarkMode
                  ? "bg-transparent text-slate-400 hover:text-white"
                  : "bg-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {isHard ? t("challenges.hard") : t("challenges.easy")}
            </button>
          ))}
        </div>

        {/* Hint */}
        {hint && (
          <p className={`mb-6 text-center text-sm sm:text-base font-medium italic px-4 ${
            isDarkMode ? "text-slate-400" : "text-slate-600"
          }`}>
            {hint}
          </p>
        )}

        {/* Scrambled Egg illustration */}
        <div className={`w-36 h-36 mb-6 rounded-2xl border-4 flex items-center justify-center ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-yellow-100 border-slate-900"
        }`}>
          <EggFried
            size={80}
            className={isDarkMode ? "text-yellow-400" : "text-yellow-500"}
            strokeWidth={2.5}
          />
        </div>

        {/* Attempts pips */}
        {!isOver && <AttemptsDisplay attemptsLeft={attemptsLeft} />}

        {/* ── Answer row ── */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 px-4 w-full">
          {answer.map((slot, i) => (
            <LetterTile
              key={i}
              letter={slot?.letter ?? null}
              onClick={() => !isOver && handleRemoveLetter(i)}
              disabled={isOver || slot?.isSpace}
              variant={answerVariant(slot)}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>

        {/* ── Letter pool ── */}
        {!isOver && (
          <div className="flex flex-wrap justify-center gap-2 mb-8 px-4 w-full">
            {pool.map((tile) => (
              <LetterTile
                key={tile.id}
                letter={tile.letter}
                onClick={() => handlePlaceLetter(tile.id)}
                disabled={tile.placed}
                variant="pool"
                isDarkMode={isDarkMode}
              />
            ))}
          </div>
        )}

        {/* ── Action buttons ── */}
        {!isOver ? (
          <div className="flex gap-3">
            <TooltipButton
              tooltip={t("challenges.scrambled_word_reshuffle")}
              isDarkMode={isDarkMode}
            >
              <button
                type="button"
                onClick={handleReshuffle}
                className={`p-3 rounded-xl border-4 font-black transition-all hover-neo-light active-neo ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-white border-slate-900 text-slate-900"
                }`}
              >
                <RotateCcw size={20} />
              </button>
            </TooltipButton>
          </div>
        ) : (
          <div className={`flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 ${
            isWon ? "text-emerald-500" : "text-rose-500"
          }`}>
            <div className="flex items-center gap-3">
              {isWon ? (
                <Check size={36} strokeWidth={3} />
              ) : (
                <span className="text-3xl">🍳</span>
              )}
              <span className="text-2xl sm:text-3xl font-black uppercase tracking-tighter">
                {isWon
                  ? t("challenges.scrambled_word_won")
                  : t("challenges.scrambled_word_lost")}
              </span>
            </div>

            {isLost && (
              <p className={`text-base font-semibold ${
                isDarkMode ? "text-slate-300" : "text-slate-700"
              }`}>
                {t("challenges.scrambled_word_answer")}
                <span className="font-black text-yellow-500">{word}</span>
              </p>
            )}

            <div className="flex gap-3 mt-2">
              <TooltipButton
                tooltip={t("challenges.play_again_tooltip")}
                isDarkMode={isDarkMode}
              >
                <button
                  onClick={handlePlayAgain}
                  className={`px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
                    isDarkMode
                      ? "bg-slate-800 border-slate-700 text-white"
                      : "bg-white border-slate-900 text-slate-900"
                  }`}
                >
                  {t("challenges.play_again")}
                </button>
              </TooltipButton>

              <TooltipButton
                tooltip={t("challenges.next_word_tooltip")}
                isDarkMode={isDarkMode}
              >
                <button
                  onClick={() => { resetGame(); fetchWord(); }}
                  className={`px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all ${
                    isDarkMode
                      ? "bg-yellow-400 border-slate-700 text-slate-900 hover:bg-yellow-300"
                      : "bg-yellow-400 border-slate-900 text-slate-900 hover:bg-yellow-300"
                  }`}
                >
                  {t("challenges.next_word")}
                </button>
              </TooltipButton>
            </div>
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

ScrambledWordGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ScrambledWordGame;
