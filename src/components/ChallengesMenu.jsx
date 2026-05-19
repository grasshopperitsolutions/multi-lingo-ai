import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BrainCircuit, Swords } from "lucide-react";

const ChallengeCard = ({ title, description, icon: Icon, color, onClick, isDarkMode }) => (
  <button
    onClick={onClick}
    className={`p-6 rounded-[2rem] border-4 flex flex-col items-center text-center transition-all w-full
      ${
        isDarkMode
          ? "bg-slate-800 border-slate-700 hover-neo-dark text-white"
          : "bg-white border-slate-900 hover-neo-light text-slate-900"
      } active-neo`}
  >
    <div
      className={`w-20 h-20 rounded-full border-4 border-slate-900 flex items-center justify-center mb-6 neo-shadow-light ${color}`}
    >
      <Icon size={40} className="text-slate-900" />
    </div>
    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">
      {title}
    </h3>
    <p className="font-bold opacity-70">{description}</p>
  </button>
);

ChallengeCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};

const ChallengesMenu = ({ isDarkMode, onBack, onSelect }) => {
  const { t } = useTranslation();

  return (
    <div className="w-full animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between mb-12 border-b-8 border-yellow-400 pb-4">
        <button
          onClick={onBack}
          className={`p-3 rounded-xl border-4 transition-all hover-neo-light active-neo ${
            isDarkMode
              ? "bg-slate-800 border-slate-700 text-white"
              : "bg-white border-slate-900 text-slate-900"
          }`}
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
          {t("challenges.title")}
        </h2>
        <div className="w-12" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <ChallengeCard
          title={t("challenges.crosswords")}
          description={t("challenges.crosswords_desc")}
          icon={BrainCircuit}
          color="bg-blue-400"
          onClick={() => onSelect("crosswords")}
          isDarkMode={isDarkMode}
        />
        <ChallengeCard
          title={t("challenges.hangman")}
          description={t("challenges.hangman_desc")}
          icon={Swords}
          color="bg-rose-400"
          onClick={() => onSelect("hangman")}
          isDarkMode={isDarkMode}
        />
      </div>
    </div>
  );
};

ChallengesMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default ChallengesMenu;