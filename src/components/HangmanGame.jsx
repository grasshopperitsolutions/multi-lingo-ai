import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, Skull, RefreshCw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { getUserGameProgress, markConceptSeen } from "../services/userService";
import { getWord } from "../services/getWordService";

// ---------------------------------------------------------------------------
// Keyboard layout config
// base     — always shown (both modes)
// accented — shown only in Hard mode; keyed by learningDialect
// ---------------------------------------------------------------------------
const KEYBOARD_LAYOUTS = {
  base: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  accented: {
    "pt-PT": ["\u00C1", "\u00C2", "\u00C3", "\u00C0", "\u00C9", "\u00CA", "\u00CD", "\u00D3", "\u00D4", "\u00D5", "\u00DA", "\u00DC", "\u00C7"],
    // future dialects: "es": [...], "fr": [...]
  },
};

// ---------------------------------------------------------------------------
// Normalize a single character — strips NFD diacritics and uppercases.
// Used in Easy mode to match accented letters via their base letter.
// ---------------------------------------------------------------------------
const normalizeChar = (c) =>
  c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

// ---------------------------------------------------------------------------
// Hangman scaffold — draws body parts progressively as wrongCount increases
// ---------------------------------------------------------------------------
const HangmanScaffold = ({ wrongCount, isDarkMode }) => (
  <svg
    viewBox="0 0 100 100"
    className="w-32 h-32 stroke-current stroke-[4] fill-none"
    strokeLinecap="square"
    aria-label={`Hangman drawing: ${wrongCount} wrong guesses`}
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

  // Read dialects from context — fallbacks live in AppContext.loadUserProfile
  const learningDialect = user?.learningDialect ?? "pt-PT";
  const nativeDialect   = user?.nativeDialect   ?? "en-US";

  // ── Difficulty mode ──
  const [hardMode, setHardMode] = useState(false);

  // ── Word state ──
  const [word, setWord] = useState("");
  const [hint, setHint] = useState("");

  // ── Game state ──
  const [guessed, setGuessed]       = useState(new Set());
  const [wrongCount, setWrongCount] = useState(0);

  // ── Loading / error state ──
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // ── Pending markConceptSeen promise ref (prevents race on Play Again) ──
  const pendingMarkRef = useRef(null);

  const maxWrong = 6;

  // Keyboard rows
  const baseKeys     = KEYBOARD_LAYOUTS.base;
  const accentedKeys = KEYBOARD_LAYOUTS.accented[learningDialect] ?? [];

  // Derive letter array from the raw word (uppercased)
  const letters = useMemo(
    () => word.toUpperCase().split(""),
    [word]
  );

  // ---------------------------------------------------------------------------
  // The set of keys that count as a "hit" in the current word.
  // Easy mode  — keys are normalized base letters (A covers Á/Â/Ã)
  // Hard mode  — keys are exact uppercased chars (Á only covers Á)
  // ---------------------------------------------------------------------------
  const wordKeySet = useMemo(() => {
    const set = new Set();
    letters.forEach((letter) => {
      if (letter !== " ") {
        set.add(hardMode ? letter.toUpperCase() : normalizeChar(letter));
      }
    });
    return set;
  }, [letters, hardMode]);

  // Win condition: all non-space letters revealed
  const isWinner = useMemo(() => {
    if (letters.length === 0) return false;
    return letters
      .filter((l) => l !== " ")
      .every((letter) => {
        const key = hardMode ? letter.toUpperCase() : normalizeChar(letter);
        return guessed.has(key);
      });
  }, [letters, guessed, hardMode]);

  const isLoser = useMemo(
    () => wrongCount >= maxWrong,
    [wrongCount]
  );

  // ── Reset game state (used before fetching a new word) ──
  const resetGame = useCallback(() => {
    setLoading(true);
    setError(null);
    setGuessed(new Set());
    setWrongCount(0);
    setWord("");
    setHint("");
  }, []);

  // ── Core fetch function (returns data instead of setting state) ──
  const fetchWordData = useCallback(async () => {
    if (!user) throw new Error(t("challenges.word_fetch_error"));

    if (pendingMarkRef.current) {
      await pendingMarkRef.current.catch(() => {});
      pendingMarkRef.current = null;
    }

    const { token, uid } = user;
    if (!token) throw new Error(t("challenges.word_fetch_error"));

    const progress = await getUserGameProgress(token, uid, "hangman", learningDialect);

    /** @type {import('../services/getWordService').WordResult} */
    const result = await getWord({
      token,
      userDialect:    nativeDialect,
      learningDialect,
      seenConceptIds: progress?.seenConceptIds ?? [],
    });

    pendingMarkRef.current = markConceptSeen(
      token, uid, "hangman", learningDialect, result.conceptId, progress
    );
    pendingMarkRef.current.catch((err) =>
      console.warn("[HangmanGame] markConceptSeen failed:", err)
    );

    return { word: result.word.toUpperCase(), hint: result.hint };
  }, [user, learningDialect, nativeDialect, t]);

  // ── Combined fetch function used by Play Again / Try Again ──
  const fetchWord = useCallback(async () => {
    try {
      const data = await fetchWordData();
      setWord(data.word);
      setHint(data.hint);
    } catch (err) {
      setError(err.message ?? t("challenges.word_fetch_error"));
    } finally {
      setLoading(false);
    }
  }, [fetchWordData, t]);

  // Fetch word on mount
  useEffect(() => {
    let cancelled = false;
    fetchWordData()
      .then((data) => {
        if (!cancelled) {
          setWord(data.word);
          setHint(data.hint);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? t("challenges.word_fetch_error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [fetchWordData, t]);

  // ── Guess handler ──
  // char is always uppercased (base A–Z or accented Á/Â/Ç etc.)
  // In Easy mode guessed keys are normalized base letters;
  // in Hard mode they are exact uppercased chars.
  const handleGuess = (char) => {
    if (isLoser || isWinner || guessed.has(char) || letters.length === 0) return;
    const next = new Set(guessed).add(char);
    setGuessed(next);
    const isCorrect = wordKeySet.has(char);
    if (!isCorrect) setWrongCount((p) => p + 1);
  };

  // Determine display state of a keyboard key
  const keyState = (char) => {
    if (!guessed.has(char)) return "idle";
    if (wordKeySet.has(char)) return "correct";
    return "wrong";
  };

  // ── Render: loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in">
        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-8">
          {t("challenges.hangman")}
        </h2>
        <div className={`w-48 h-48 mb-8 rounded-2xl border-4 flex items-center justify-center ${
          isDarkMode ? "bg-slate-800 border-slate-700" : "bg-yellow-100 border-slate-900"
        }`}>
          <RefreshCw className="w-10 h-10 animate-spin opacity-40" />
        </div>
        <p className={`text-sm italic ${ isDarkMode ? "text-slate-400" : "text-slate-500" }`}>
          {t("challenges.loading_word")}
        </p>
      </div>
    );
  }

  // ── Render: error ──
  if (error) {
    return (
      <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in gap-4">
        <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter">
          {t("challenges.hangman")}
        </h2>
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

  // ── Render: game ──
  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95">
      <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-4">
        {t("challenges.hangman")}
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
              ? isDarkMode
                ? "bg-yellow-400 text-slate-900"
                : "bg-slate-900 text-white"
              : isDarkMode
                ? "bg-transparent text-slate-400 hover:text-white"
                : "bg-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Easy
        </button>
        <button
          type="button"
          onClick={() => setHardMode(true)}
          className={`px-5 py-1.5 text-xs font-black uppercase tracking-widest transition-colors ${
            hardMode
              ? isDarkMode
                ? "bg-yellow-400 text-slate-900"
                : "bg-slate-900 text-white"
              : isDarkMode
                ? "bg-transparent text-slate-400 hover:text-white"
                : "bg-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          Hard
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

      {/* Hangman Graphic */}
      <div className={`w-48 h-48 mb-8 rounded-2xl border-4 flex items-center justify-center relative ${
        isDarkMode ? "bg-slate-800 border-slate-700" : "bg-yellow-100 border-slate-900"
      }`}>
        <HangmanScaffold wrongCount={wrongCount} isDarkMode={isDarkMode} />
      </div>

      {/* Word Display
          - Regular letters: bordered tile, revealed when guessed or on loss
          - Space characters: wider spacer, always visible, no tile border     */}
      <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-8 px-4">
        {letters.map((letter, i) => {
          const isSpace  = letter === " ";
          const key      = hardMode ? letter.toUpperCase() : normalizeChar(letter);
          const revealed = isSpace || guessed.has(key) || isLoser;

          if (isSpace) {
            return (
              <div
                key={`space-${i}`}
                className="w-5 sm:w-6"
                aria-hidden="true"
              />
            );
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

      {/* Keyboard — base row always shown; accented row only in Hard mode */}
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
                className={`w-10 h-12 rounded-lg border-4 font-black text-lg transition-all
                  ${ state === "idle" && !isLoser && !isWinner
                    ? isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                    : "" }
                  ${btnClass}`}
              >
                {char}
              </button>
            );
          })}
        </div>

        {/* Accented row — Hard mode only */}
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
                  className={`w-10 h-12 rounded-lg border-4 font-black text-lg transition-all
                    ${ state === "idle" && !isLoser && !isWinner
                      ? isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                      : "" }
                    ${btnClass}`}
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
  );
};

HangmanGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default HangmanGame;
