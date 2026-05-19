import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, Skull } from "lucide-react";

const HangmanGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const word = "AZULEJO".toUpperCase();
  const [guessed, setGuessed] = useState(new Set());
  const [wrongCount, setWrongCount] = useState(0);

  const maxWrong = 6;
  const isLoser = wrongCount >= maxWrong;
  const isWinner = word.split("").every((char) => guessed.has(char));

  const handleGuess = (char) => {
    if (isLoser || isWinner || guessed.has(char)) return;

    const newGuessed = new Set(guessed).add(char);
    setGuessed(newGuessed);

    if (!word.includes(char)) {
      setWrongCount((prev) => prev + 1);
    }
  };

  const handleReset = () => {
    setGuessed(new Set());
    setWrongCount(0);
  };

  const keyboard = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95">
      <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-8">
        {t("challenges.hangman")}
      </h2>

      {/* Hangman Graphic */}
      <div
        className={`w-48 h-48 mb-8 rounded-2xl border-4 flex items-center justify-center relative ${
          isDarkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-yellow-100 border-slate-900"
        }`}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-32 h-32 stroke-current stroke-[4] fill-none"
          strokeLinecap="square"
        >
          {/* Scaffold */}
          <path
            d="M10,90 L40,90 M25,90 L25,10 L60,10 L60,20"
            className={isDarkMode ? "text-white" : "text-slate-900"}
          />
          {/* Body Parts based on wrong count */}
          {wrongCount > 0 && (
            <circle cx="60" cy="30" r="10" className="text-rose-500" />
          )}
          {wrongCount > 1 && (
            <path d="M60,40 L60,65" className="text-rose-500" />
          )}
          {wrongCount > 2 && (
            <path d="M60,45 L45,55" className="text-rose-500" />
          )}
          {wrongCount > 3 && (
            <path d="M60,45 L75,55" className="text-rose-500" />
          )}
          {wrongCount > 4 && (
            <path d="M60,65 L45,80" className="text-rose-500" />
          )}
          {wrongCount > 5 && (
            <path d="M60,65 L75,80" className="text-rose-500" />
          )}
        </svg>
      </div>

      {/* Word Display */}
      <div className="flex gap-1 sm:gap-2 mb-8">
        {word.split("").map((char, i) => (
          <div
            key={i}
            className={`w-7 sm:w-12 h-8 sm:h-14 border-b-4 sm:border-b-8 flex items-center justify-center text-xl sm:text-3xl font-black ${
              isDarkMode
                ? "border-yellow-400 text-white"
                : "border-slate-900 text-slate-900"
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
          const isWrong = isGuessed && !word.includes(char);

          let btnClass = isDarkMode
            ? "bg-slate-800 border-slate-700 text-white"
            : "bg-white border-slate-900 text-slate-900";
          if (isCorrect)
            btnClass = "bg-emerald-400 border-slate-900 text-slate-900";
          if (isWrong)
            btnClass =
              "bg-slate-400 border-slate-900 text-slate-900 opacity-50";

          return (
            <button
              key={char}
              onClick={() => handleGuess(char)}
              disabled={isGuessed || isLoser || isWinner}
              className={`w-10 h-12 rounded-lg border-4 font-black text-lg transition-all 
                ${
                  !isGuessed && !isLoser && !isWinner
                    ? isDarkMode
                      ? "hover-neo-dark active-neo"
                      : "hover-neo-light active-neo"
                    : ""
                }
                ${btnClass}`}
            >
              {char}
            </button>
          );
        })}
      </div>

      {/* Reset Button */}
      {(isWinner || isLoser) && (
        <button
          onClick={handleReset}
          className={`mt-6 px-8 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 text-white"
              : "bg-white border-slate-900 text-slate-900"
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