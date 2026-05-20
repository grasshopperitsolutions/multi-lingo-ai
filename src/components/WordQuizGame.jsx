import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import StatusBadge from "./StatusBadge";

const WordQuizGame = ({ isDarkMode }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center w-full py-20 animate-in fade-in zoom-in-95">
      <div
        className={`p-16 rounded-[2rem] border-4 flex flex-col items-center text-center gap-8 max-w-lg w-full ${
          isDarkMode
            ? "bg-slate-800 border-slate-700"
            : "bg-white border-slate-900"
        }`}
      >
        <div
          className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-5xl ${
            isDarkMode
              ? "border-yellow-400 text-yellow-400"
              : "border-slate-900 text-slate-900"
          }`}
        >
          🧠
        </div>
        <h2 className={`text-3xl font-black uppercase tracking-tighter ${
          isDarkMode ? "text-white" : "text-slate-900"
        }`}>
          {t("challenges.word_quiz")}
        </h2>
        <StatusBadge label={t("challenges.coming_soon")} isDarkMode={isDarkMode} />
      </div>
    </div>
  );
};

WordQuizGame.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default WordQuizGame;