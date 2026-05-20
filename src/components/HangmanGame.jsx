import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, Skull, RefreshCw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { getHangmanWord } from "../challenges-services/HangmanService";

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
    {/* Scaffold */}
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
  // AppContext merges Firestore profile fields directly onto the user object
  // via loadUserProfile — so learningDialect, nativeDialect, interests, and
  // token are all available as user.fieldName.
  const { user } = useAppContext();

  // ── Word state ──
  const [word, setWord]       = useState("");
  const [hint, setHint]       = useState("");
  const [wordId, setWordId]   = useState(null);
  const [source, setSource]   = useState(null); // 'db' | 'ai'

  // ── Game state ──
  const [guessed, setGuessed]         = useState(new Set());
  const [wrongCount, setWrongCount]   = useState(0);

  // ── Loading / error state ──
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const maxWrong  = 6;
  const isLoser   = wrongCount >= maxWrong;
  const isWinner  = word.length > 0 && word.split("").every((c) => guessed.has(c));
  const keyboard  = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ── Fetch a new word from HangmanService ──
  const fetchWord = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setGuessed(new Set());
    setWrongCount(0);
    setWord("");
    setHint("");
    setWordId(null);
    setSource(null);

    try {
      // user.token is the plain ID token string kept fresh by AppContext's
      // onAuthStateChanged listener. No need to call getIdToken() here.
      const token = user.token;

      if (!token) throw new Error(t("challenges.word_fetch_error"));

      // Profile fields merged into user by AppContext.loadUserProfile.
      // Fall back to pt-PT / en defaults if not yet loaded.
      const learningDialect = user.learningDialect ?? "pt-PT";
      const userDialect     = user.nativeDialect   ?? "en";
      // Use first interest as category; default to 'general'.
      const category = user.interests?.[0] ?? "general";

      /** @type {import('../challenges-services/types').WordResult} */
      const result = await getHangmanWord({
        uid: user.uid,
        token,
        userDialect,
        learningDialect,
        category,
      });

      setWord(result.word.toUpperCase());
      setHint(result.hint);
      setWordId(result.wordId);
      setSource(result.source);
    } catch (err) {
      setError(err.message ?? t("challenges.word_fetch_error"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  // Fetch a word on mount — calls getHangmanWord directly and uses promise
  // chains so setState calls happen in microtask callbacks rather than
  // synchronously in the effect body, satisfying react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    getHangmanWord({
      uid: user.uid,
      token: user.token,
      userDialect: user.nativeDialect ?? "en",
      learningDialect: user.learningDialect ?? "pt-PT",
      category: user.interests?.[0] ?? "general",
    })
      .then((result) => {
        if (cancelled) return;
        setWord(result.word.toUpperCase());
        setHint(result.hint);
        setWordId(result.wordId);
        setSource(result.source);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? t("challenges.word_fetch_error"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // Intentionally run only on mount — defaults are kept in sync with
    // fetchWord's defaults via the useCallback below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guess handler ──
  const handleGuess = (char) => {
    if (isLoser || isWinner || guessed.has(char) || !word) return;
    const next = new Set(guessed).add(char);
    setGuessed(next);
    if (!word.includes(char)) setWrongCount((p) => p + 1);
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
          onClick={fetchWord}
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
      <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-8">
        {t("challenges.hangman")}
      </h2>

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

      {/* Word Display */}
      <div className="flex gap-1 sm:gap-2 mb-8">
        {word.split("").map((char, i) => (
          <div
            key={i}
            className={`w-7 sm:w-12 h-8 sm:h-14 border-b-4 sm:border-b-8 flex items-center justify-center text-xl sm:text-3xl font-black ${
              isDarkMode ? "border-yellow-400 text-white" : "border-slate-900 text-slate-900"
            }`}
          >
            {guessed.has(char) || isLoser ? char : ""}
          </div>
        ))}
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
      <div className="flex flex-wrap justify-center gap-2 max-w-md">
        {keyboard.map((char) => {
          const isGuessed = guessed.has(char);
          const isCorrect = isGuessed && word.includes(char);
          const isWrong   = isGuessed && !word.includes(char);

          let btnClass = isDarkMode
            ? "bg-slate-800 border-slate-700 text-white"
            : "bg-white border-slate-900 text-slate-900";
          if (isCorrect) btnClass = "bg-emerald-400 border-slate-900 text-slate-900";
          if (isWrong)   btnClass = "bg-slate-400 border-slate-900 text-slate-900 opacity-50";

          return (
            <button
              key={char}
              onClick={() => handleGuess(char)}
              disabled={isGuessed || isLoser || isWinner}
              className={`w-10 h-12 rounded-lg border-4 font-black text-lg transition-all
                ${ !isGuessed && !isLoser && !isWinner
                  ? isDarkMode ? "hover-neo-dark active-neo" : "hover-neo-light active-neo"
                  : "" }
                ${btnClass}`}
            >
              {char}
            </button>
          );
        })}
      </div>

      {/* Play Again */}
      {(isWinner || isLoser) && (
        <button
          onClick={fetchWord}
          className={`mt-6 px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
            isDarkMode ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          {t("challenges.play_again")}
        </button>
      )}

      {/* Dev badge — remove before production */}
      {source && (
        <span className={`mt-4 text-xs opacity-30 font-mono`}>
          source: {source} · id: {wordId}
        </span>
      )}
    </div>
  );
};

HangmanGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default HangmanGame;
