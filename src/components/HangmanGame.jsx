import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, Skull, RefreshCw } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { getUserGameProgress, markConceptSeen } from "../services/userService";
import { getWord } from "../services/getWordService";

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

  // ── Word state ──
  const [word, setWord]           = useState("");
  const [graphemes, setGraphemes] = useState([]);
  const [hint, setHint]           = useState("");
  const [conceptId, setConceptId] = useState(null);

  // ── Game state ──
  const [guessed, setGuessed]       = useState(new Set());
  const [wrongCount, setWrongCount] = useState(0);

  // ── Loading / error state ──
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const maxWrong = 6;
  const isLoser  = wrongCount >= maxWrong;
  const isWinner = graphemes.length > 0 && graphemes.every((g) => guessed.has(g.toUpperCase()));
  const keyboard = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ── Core fetch function ──
  const fetchWord = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);
    setGuessed(new Set());
    setWrongCount(0);
    setWord("");
    setGraphemes([]);
    setHint("");
    setConceptId(null);

    try {
      const { token, uid }     = user;
      const learningDialect    = user.learningDialect ?? "pt-PT";
      const userDialect        = user.nativeDialect   ?? "en";

      if (!token) throw new Error(t("challenges.word_fetch_error"));

      // Step 1 — fetch this game's progress to get seen concept IDs
      const progress = await getUserGameProgress(token, uid, "hangman", learningDialect);

      // Step 2 — fetch the next unseen word
      /** @type {import('../services/getWordService').WordResult} */
      const result = await getWord({
        token,
        userDialect,
        learningDialect,
        seenConceptIds: progress?.seenConceptIds ?? [],
      });

      // Step 3 — mark concept as seen (fire-and-forget, non-blocking)
      markConceptSeen(token, uid, "hangman", learningDialect, result.conceptId, progress)
        .catch((err) => console.warn('[HangmanGame] markConceptSeen failed:', err));

      setWord(result.word.toUpperCase());
      setGraphemes(result.graphemes.map((g) => g.toUpperCase()));
      setHint(result.hint);
      setConceptId(result.conceptId);
    } catch (err) {
      setError(err.message ?? t("challenges.word_fetch_error"));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  // Fetch on mount
  useEffect(() => {
    fetchWord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guess handler — uses graphemes for correctness check ──
  const handleGuess = (char) => {
    if (isLoser || isWinner || guessed.has(char) || !word) return;
    const next = new Set(guessed).add(char);
    setGuessed(next);
    // A guess is correct if it matches any grapheme in the word
    const isCorrect = graphemes.some((g) => g.toUpperCase() === char);
    if (!isCorrect) setWrongCount((p) => p + 1);
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

      {/* Word Display — driven by graphemes array */}
      <div className="flex gap-1 sm:gap-2 mb-8">
        {graphemes.map((grapheme, i) => (
          <div
            key={`${grapheme}-${i}`}
            className={`w-7 sm:w-12 h-8 sm:h-14 border-b-4 sm:border-b-8 flex items-center justify-center text-xl sm:text-3xl font-black ${
              isDarkMode ? "border-yellow-400 text-white" : "border-slate-900 text-slate-900"
            }`}
          >
            {guessed.has(grapheme) || isLoser ? grapheme : ""}
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
          const isCorrect = isGuessed && graphemes.some((g) => g.toUpperCase() === char);
          const isWrong   = isGuessed && !graphemes.some((g) => g.toUpperCase() === char);

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
    </div>
  );
};

HangmanGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default HangmanGame;
