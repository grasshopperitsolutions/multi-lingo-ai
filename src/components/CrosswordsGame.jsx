import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Trophy, XCircle } from "lucide-react";

const CrosswordsGame = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const [grid, setGrid] = useState({
    "0-0": "",
    "0-1": "",
    "0-2": "",
    "1-0": "",
    "2-0": "",
  });
  const [showResult, setShowResult] = useState(null); // null | "win" | "lose"

  const correctGrid = {
    "0-0": "P",
    "0-1": "A",
    "0-2": "O",
    "1-0": "A",
    "2-0": "I",
  };

  const handleChange = (pos, val) => {
    const char = val.toUpperCase().slice(-1);
    setGrid((prev) => ({ ...prev, [pos]: char }));
    setShowResult(null);
  };

  const handleSubmit = () => {
    const isWinner = Object.keys(correctGrid).every(
      (key) => grid[key] === correctGrid[key],
    );
    setShowResult(isWinner ? "win" : "lose");
  };

  const renderCell = (row, col, num) => {
    const pos = `${row}-${col}`;
    const isActive = pos in correctGrid;

    if (!isActive) {
      return (
        <div
          className={`w-16 h-16 border-4 ${
            isDarkMode
              ? "bg-slate-900 border-slate-800"
              : "bg-slate-900 border-slate-900"
          }`}
        />
      );
    }

    return (
      <div className="relative">
        {num && (
          <span
            className={`absolute top-1 left-1.5 text-xs font-black z-10 ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {num}
          </span>
        )}
        <input
          type="text"
          value={grid[pos]}
          onChange={(e) => handleChange(pos, e.target.value)}
          maxLength={1}
          className={`w-16 h-16 border-4 text-center text-3xl font-black focus:outline-none focus:z-20 relative
            ${
              isDarkMode
                ? "bg-slate-800 border-slate-600 text-white focus:border-yellow-400"
                : "bg-white border-slate-900 text-slate-900 focus:border-blue-600"
            }`}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95">
      <h2 className="text-3xl font-black uppercase tracking-tighter mb-8">
        {t("challenges.crosswords")}
      </h2>

      <div className="flex flex-col md:flex-row gap-12 items-center md:items-start mt-8">
        {/* The Grid */}
        <div
          className={`p-4 rounded-xl border-4 neo-shadow-light ${
            isDarkMode
              ? "bg-slate-800 border-slate-700"
              : "bg-blue-100 border-slate-900"
          }`}
        >
          <div className="flex">
            {renderCell(0, 0, 1)}
            {renderCell(0, 1, null)}
            {renderCell(0, 2, null)}
          </div>
          <div className="flex">
            {renderCell(1, 0, 2)}
            {renderCell(1, 1, null)}
            {renderCell(1, 2, null)}
          </div>
          <div className="flex">
            {renderCell(2, 0, null)}
            {renderCell(2, 1, null)}
            {renderCell(2, 2, null)}
          </div>
        </div>

        {/* Clues */}
        <div
          className={`p-6 rounded-2xl border-4 ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 text-white"
              : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          <h3 className="font-black text-xl mb-4 border-b-4 border-current pb-2">
            {t("challenges.clues")}
          </h3>
          <div className="mb-4">
            <h4 className="font-bold text-lg mb-2 text-rose-500">
              {t("challenges.across")}
            </h4>
            <p className="font-semibold">1. {t("challenges.clue_bread")}</p>
          </div>
          <div>
            <h4 className="font-bold text-lg mb-2 text-blue-500">
              {t("challenges.down")}
            </h4>
            <p className="font-semibold">1. {t("challenges.clue_father")}</p>
            <p className="font-semibold opacity-50 mt-1">2. ...</p>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className={`mt-6 w-full px-6 py-3 rounded-xl border-4 font-black uppercase tracking-wider transition-all hover-neo-light active-neo ${
              isDarkMode
                ? "bg-slate-900 border-yellow-400 text-yellow-400"
                : "bg-yellow-400 border-slate-900 text-slate-900"
            }`}
          >
            {t("challenges.submit")}
          </button>
        </div>
      </div>

      {/* Result Message */}
      {showResult === "win" && (
        <div className="mt-12 px-8 py-4 bg-yellow-400 border-4 border-slate-900 rounded-full font-black text-slate-900 text-2xl flex items-center gap-3 neo-shadow-light animate-bounce">
          <Trophy /> {t("challenges.crossword_crushed")}
        </div>
      )}
      {showResult === "lose" && (
        <div className="mt-12 px-8 py-4 bg-rose-500 border-4 border-slate-900 rounded-full font-black text-white text-2xl flex items-center gap-3 neo-shadow-light">
          <XCircle /> {t("challenges.try_again")}
        </div>
      )}
    </div>
  );
};

CrosswordsGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default CrosswordsGame;