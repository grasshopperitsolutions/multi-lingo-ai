import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, Skull } from "lucide-react";
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
import Loader from "./Loader";
import { sanitizeAIError } from "../utils/errorUtils";

// ---------------------------------------------------------------------------
// Keyboard layout config
// ---------------------------------------------------------------------------
const KEYBOARD_LAYOUTS = {
  base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  accented: {
    "pt-PT": ["\u00C1", "\u00C2", "\u00C3", "\u00C0", "\u00C9", "\u00CA", "\u00CD", "\u00D3", "\u00D4", "\u00D5", "\u00DA", "\u00DC", "\u00C7"],
  },
};

const normalizeChar = (c) =>
  c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const isSessionExpiredError = (err) => {
  const msg = (err?.message ?? "").toLowerCase();
  return msg.includes("expired token") || msg.includes("invalid or expired");
};

// ---------------------------------------------------------------------------
// HangmanScaffold
// ---------------------------------------------------------------------------
const HangmanScaffold = ({ wrongCount, isDarkMode }) => {
  const { t } = useTranslation();
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-32 h-32 stroke-current stroke-[4] fill-none"
      strokeLinecap="square"
      aria-label={t("challenges.hangman_drawing_alt", { wrongCount })}
    >
    <path
      d="M10,90 L40,90 M25,90 L25,10 L60,10 L60,20"
      className={isDarkMode ? "text-white" : "text-slate-900"}
    />
    {wrongCount > 0 && <circle cx="60" cy="30" r="10" className="text-rose-500" />}
    {wrongCount > 1 && <path d="M60,40 L60,65" className="text-rose-500" />}
    {wrongCount > 2 && <path d="M60,45 L45,55" className="text-rose-500" />}
    {wrongCount > 3 && <path d="M60,45 L75,55" className="text-rose-500" />}
    {wrongCount > 4 && <path d="M60,65 L45,80" className="text-rose-500" />}
    {wrongCount > 5 && <path d="M60,65 L75,80" className="text-rose-500" />}
  </svg>
  );
};

HangmanScaffold.propTypes = {
  wrongCount: PropTypes.number.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const HangmanGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user } = useAppContext();

  const learningDialect = user?.learningDialect ?? "pt-PT";
  const interfaceLang   = user?.interfaceLang   ?? "en-US";

  // ── Difficulty ──
  const [hardMode, setHardMode] = useState(false);

  // ── Word state ──
  const [word, setWord]           = useState("");
  const [hint, setHint]           = useState("");
  const [conceptId, setConceptId] = useState(null);

  // ── Game state ──
  const [guessed, setGuessed]       = useState(new Set());
  const [wrongCount, setWrongCount] = useState(0);

  // ── Loading / error ──
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Sidebar / stats state ──
  const [progress,       setProgress]       = useState(null);
  const [seenCount,      setSeenCount]      = useState(0);
  const [totalWords,     setTotalWords]     = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Guard: prevent double-recording when isWinner/isLoser fires
  const hasMarkedRef = useRef(false);

  const maxWrong = 6;

  const baseKeys     = KEYBOARD_LAYOUTS.base;
  const accentedKeys = KEYBOARD_LAYOUTS.accented[learningDialect] ?? [];

  const letters = useMemo(() => word.toUpperCase().split(""), [word]);

  const wordKeySet = useMemo(() => {
    const set = new Set();
    letters.forEach((letter) => {
      if (letter !== " ") {
        set.add(hardMode ? letter.toUpperCase() : normalizeChar(letter));
      }
    });
    return set;
  }, [letters, hardMode]);

  const isWinner = useMemo(() => {
    if (letters.length === 0) return false;
    return letters
      .filter((l) => l !== " ")
      .every((letter) => {
        const key = hardMode ? letter.toUpperCase() : normalizeChar(letter);
        return guessed.has(key);
      });
  }, [letters, guessed, hardMode]);

  const isLoser = useMemo(() => wrongCount >= maxWrong, [wrongCount]);

  const resetGame = useCallback(() => {
    setLoading(true);
    setError(null);
    setGuessed(new Set());
    setWrongCount(0);
    setWord("");
    setHint("");
    setConceptId(null);
    hasMarkedRef.current = false;
  }, []);

  // ── Fetch stats (progress + pool count + global seen count) ─────────────
  const fetchStats = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    setIsLoadingStats(true);
    try {
      const [prog, count, seenIds] = await Promise.all([
        getUserGameProgress(user.token, user.uid, "hangman", learningDialect),
        getWordPoolCount(user.token),
        getGlobalSeenIds(user.token, user.uid),
      ]);
      setProgress(prog);
      setTotalWords(count);
      setSeenCount(seenIds.length);
    } catch (err) {
      console.warn("[HangmanGame] fetchStats failed:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [user, learningDialect]);

  useEffect(() => {
    if (!user?.token || !user?.uid) return;
    let cancelled = false;
    Promise.all([
      getUserGameProgress(user.token, user.uid, "hangman", learningDialect),
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
      .catch((err) => console.warn("[HangmanGame] fetchStats failed:", err))
      .finally(() => { if (!cancelled) setIsLoadingStats(false); });
    return () => { cancelled = true; };
  }, [user, learningDialect]);

  // ── Core word fetch — reads global seenConceptIds ────────────────────────
  const fetchWordData = useCallback(async () => {
    if (!user) throw new Error(t("challenges.word_fetch_error"));
    const { token, uid } = user;
    if (!token) throw new Error(t("challenges.word_fetch_error"));

    const [prog, seenIds] = await Promise.all([
      getUserGameProgress(token, uid, "hangman", learningDialect),
      getGlobalSeenIds(token, uid),
    ]);

    const result = await getWord({
      token,
      userDialect:    interfaceLang,
      learningDialect,
      seenConceptIds: seenIds,
    });

    return { word: result.word.toUpperCase(), hint: result.hint, conceptId: result.conceptId, progress: prog };
  }, [user, learningDialect, interfaceLang, t]);

  const fetchWord = useCallback(async () => {
    try {
      const data = await fetchWordData();
      setWord(data.word);
      setHint(data.hint);
      setConceptId(data.conceptId);
      setProgress(data.progress);
    } catch (err) {
      if (isSessionExpiredError(err)) {
        alert(t("challenges.session_expired"));
        window.location.reload();
        return;
      }
      setError(sanitizeAIError(err.message, t("challenges.word_fetch_error")));
    } finally {
      setLoading(false);
    }
  }, [fetchWordData, t]);

  useEffect(() => {
    let cancelled = false;
    fetchWordData()
      .then((data) => {
        if (!cancelled) {
          setWord(data.word);
          setHint(data.hint);
          setConceptId(data.conceptId);
          setProgress(data.progress);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (isSessionExpiredError(err)) {
            alert(t("challenges.session_expired"));
            window.location.reload();
            return;
          }
          setError(sanitizeAIError(err.message, t("challenges.word_fetch_error")));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchWordData, t]);

  // ── Record play + mark seen globally when game ends ──────────────────────
  useEffect(() => {
    if ((!isWinner && !isLoser) || hasMarkedRef.current || !conceptId || !user?.token || !user?.uid) return;
    hasMarkedRef.current = true;

    recordPlay(user.token, user.uid, "hangman", learningDialect, progress)
      .catch((err) => console.warn("[HangmanGame] recordPlay failed:", err));

    if (isWinner) {
      getGlobalSeenIds(user.token, user.uid)
        .then((currentSeenIds) =>
          markConceptSeenGlobal(user.token, user.uid, conceptId, currentSeenIds)
        )
        .then(() => fetchStats())
        .catch((err) => console.warn("[HangmanGame] markConceptSeenGlobal failed:", err));
    } else {
      Promise.resolve().then(() => fetchStats());
    }
  }, [isWinner, isLoser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset seen words handler — global reset ──────────────────────────────
  const handleResetSeenWords = useCallback(async () => {
    if (!user?.token || !user?.uid) return;
    await resetAllSeenWords(user.token, user.uid);
    await fetchStats();
  }, [user, fetchStats]);

  // ── Guess handler ────────────────────────────────────────────────────────
  const handleGuess = (char) => {
    if (isLoser || isWinner || guessed.has(char) || letters.length === 0) return;
    const next = new Set(guessed).add(char);
    setGuessed(next);
    if (!wordKeySet.has(char)) setWrongCount((p) => p + 1);
  };

  const keyState = (char) => {
    if (!guessed.has(char)) return "idle";
    if (wordKeySet.has(char)) return "correct";
    return "wrong";
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return <Loader isDarkMode={isDarkMode} message={t("challenges.loading_word")} />;
  }

  // ── Error state ──────────────────────────────────────────────────────────
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

  // ── Game render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row items-start gap-6 w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95">

      {/* ── Main game column ── */}
      <div className="flex flex-col items-center flex-1 min-w-0">

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

        {/* Scaffold */}
        <div className={`w-48 h-48 mb-8 rounded-2xl border-4 flex items-center justify-center relative ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-yellow-100 border-slate-900"
        }`}>
          <HangmanScaffold wrongCount={wrongCount} isDarkMode={isDarkMode} />
        </div>

        {/* Word Display */}
        <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-8 px-4">
          {letters.map((letter, i) => {
            const isSpace  = letter === " ";
            const key      = hardMode ? letter.toUpperCase() : normalizeChar(letter);
            const revealed = isSpace || guessed.has(key) || isLoser;
            if (isSpace) {
              return <div key={`space-${i}`} className="w-5 sm:w-6" aria-hidden="true" />;
            }
            return (
              <div
                key={`${letter}-${i}`}
                className={`w-7 sm:w-12 h-8 sm:h-14 border-b-4 sm:border-b-8 flex items-center justify-center text-xl sm:text-3xl font-black ${
                  isDarkMode ? "border-yellow-400 text-white" : "border-slate-900 text-slate-900"
                }`}
              >
                {revealed ? letter : ""}
              </div>
            );
          })}
        </div>

        {/* Status Messages */}
        {isWinner && (
          <div className="mb-6 px-6 py-3 bg-emerald-400 border-4 border-slate-900 rounded-full font-black text-slate-900 text-xl flex items-center gap-2 neo-shadow-light">
            <Trophy /> {t("challenges.you_survived")}
          </div>
        )}
        {isLoser && (
          <div className="mb-6 px-6 py-3 bg-rose-500 border-4 border-slate-900 rounded-full font-black text-white text-xl flex items-center gap-2 neo-shadow-light">
            <Skull /> {t("challenges.hung_up")}
          </div>
        )}

        {/* Keyboard */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex flex-wrap justify-center gap-2 max-w-md">
            {baseKeys.map((char) => {
              const state = keyState(char);
              let btnClass = isDarkMode
                ? "bg-slate-800 border-slate-700 text-white"
                : "bg-white border-slate-900 text-slate-900";
              if (state === "correct") btnClass = "bg-emerald-400 border-slate-900 text-slate-900";
              if (state === "wrong")   btnClass = "bg-slate-400 border-slate-900 text-slate-900 opacity-50";
              return (
                <button
                  key={char}
                  onClick={() => handleGuess(char)}
                  disabled={state !== "idle" || isLoser || isWinner}
                  className={`w-10 h-12 rounded-lg border-4 font-black text-lg transition-all ${
                    state === "idle" && !isLoser && !isWinner
                      ? isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                      : ""
                  } ${btnClass}`}
                >
                  {char}
                </button>
              );
            })}
          </div>

          {hardMode && accentedKeys.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 max-w-md mt-1">
              {accentedKeys.map((char) => {
                const state = keyState(char);
                let btnClass = isDarkMode
                  ? "bg-slate-700 border-slate-600 text-yellow-300"
                  : "bg-yellow-50 border-slate-700 text-slate-900";
                if (state === "correct") btnClass = "bg-emerald-400 border-slate-900 text-slate-900";
                if (state === "wrong")   btnClass = "bg-slate-400 border-slate-900 text-slate-900 opacity-50";
                return (
                  <button
                    key={char}
                    onClick={() => handleGuess(char)}
                    disabled={state !== "idle" || isLoser || isWinner}
                    className={`w-10 h-12 rounded-lg border-4 font-black text-lg transition-all ${
                      state === "idle" && !isLoser && !isWinner
                        ? isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                        : ""
                    } ${btnClass}`}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Play Again */}
        {(isWinner || isLoser) && (
          <button
            onClick={() => { resetGame(); fetchWord(); }}
            className={`mt-6 px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
              isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
            }`}
          >
            {t("challenges.play_again")}
          </button>
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

HangmanGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default HangmanGame;
