import { lazy, Suspense, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BrainCircuit, Swords, NotebookPen, Search, EggFried } from "lucide-react";
import StatusBadge from "./StatusBadge";

// ── Lazy-loaded game components ─────────────────────────────────────────────
const HangmanGame = lazy(() => import("./HangmanGame"));
const CrosswordsGame = lazy(() => import("./CrosswordsGame"));
const WordQuizGame = lazy(() => import("./WordQuizGame"));
const WordSearchGame = lazy(() => import("./WordSearchGame"));
const ScrambledWordGame = lazy(() => import("./ScrambledWordGame"));

// ── Game Registry ───────────────────────────────────────────────────────────
// Add new games here — one entry per game.
// Set `comingSoon: true` to show a "Coming soon..." badge instead of a game.
const GAMES = [
  {
    id: "hangman",
    icon: Swords,
    color: "bg-rose-400",
    titleKey: "challenges.hangman",
    descKey: "challenges.hangman_desc",
    component: HangmanGame,
    comingSoon: false,
  },
  {
    id: "scrambled_word",
    icon: EggFried,
    color: "bg-yellow-400",
    titleKey: "challenges.scrambled_word",
    descKey: "challenges.scrambled_word_desc",
    component: ScrambledWordGame,
    comingSoon: false,
  },
  {
    id: "word_quiz",
    icon: NotebookPen,
    color: "bg-emerald-400",
    titleKey: "challenges.word_quiz",
    descKey: "challenges.word_quiz_desc",
    component: WordQuizGame,
    comingSoon: true,
  },
  {
    id: "word_search",
    icon: Search,
    color: "bg-purple-400",
    titleKey: "challenges.word_search",
    descKey: "challenges.word_search_desc",
    component: WordSearchGame,
    comingSoon: false,
  },
  {
    id: "crosswords",
    icon: BrainCircuit,
    color: "bg-blue-400",
    titleKey: "challenges.crosswords",
    descKey: "challenges.crosswords_desc",
    component: CrosswordsGame,
    comingSoon: true,
  },
];

// ── Sub-components ──────────────────────────────────────────────────────────

const Breadcrumb = ({ isDarkMode, onBackToDashboard, onBackToMenu, currentViewLabel }) => {
  const { t } = useTranslation();
  return (
    <nav className="flex items-center gap-1.5 text-sm font-black uppercase tracking-widest mb-8">
      <button
        onClick={onBackToDashboard}
        className={`flex items-center gap-1 transition-all hover:-translate-x-0.5 ${
          isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft size={16} />
        {t("dashboard.back")}
      </button>
      <span className={`mx-1 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>/</span>
      {currentViewLabel ? (
        <>
          <button
            onClick={onBackToMenu}
            className={`transition-all ${
              isDarkMode ? "text-yellow-400 hover:text-yellow-300" : "text-yellow-600 hover:text-yellow-800"
            }`}
          >
            {t("challenges.title")}
          </button>
          <span className={`mx-1 ${isDarkMode ? "text-slate-600" : "text-slate-400"}`}>/</span>
          <span className={isDarkMode ? "text-yellow-400" : "text-yellow-600"}>
            {currentViewLabel}
          </span>
        </>
      ) : (
        <span className={isDarkMode ? "text-yellow-400" : "text-yellow-600"}>
          {t("challenges.title")}
        </span>
      )}
    </nav>
  );
};

Breadcrumb.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBackToDashboard: PropTypes.func.isRequired,
  onBackToMenu: PropTypes.func.isRequired,
  currentViewLabel: PropTypes.string,
};

const GameCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, comingSoon, comingSoonLabel }) => (
  <button
    onClick={onClick}
    disabled={comingSoon}
    className={`relative p-6 rounded-[2rem] border-4 flex flex-col items-center text-center transition-all w-full
      ${
        comingSoon
          ? "opacity-60 cursor-not-allowed"
          : isDarkMode
            ? "bg-slate-800 border-slate-700 hover-neo-dark text-white"
            : "bg-white border-slate-900 hover-neo-light text-slate-900 active-neo"
      }`}
  >
    {comingSoon && <StatusBadge label={comingSoonLabel} isDarkMode={isDarkMode} />}
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

GameCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  color: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  comingSoon: PropTypes.bool,
  comingSoonLabel: PropTypes.string,
};

// ── Fallback loader for Suspense ────────────────────────────────────────────
const GameLoader = ({ isDarkMode }) => (
  <div className="flex items-center justify-center py-32">
    <div
      className={`w-12 h-12 rounded-full border-4 border-t-transparent animate-spin ${
        isDarkMode ? "border-yellow-400" : "border-slate-900"
      }`}
    />
  </div>
);

GameLoader.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

// ── ChallengesMenu (Challenge Hub) ──────────────────────────────────────────
const ChallengesMenu = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState(null);

  const handleGameSelect = (gameId) => {
    setActiveGame(gameId);
  };

  const handleBackToMenu = () => {
    setActiveGame(null);
  };

  // Find the active game definition
  const activeGameDef = activeGame
    ? GAMES.find((g) => g.id === activeGame)
    : null;

  // ── Active game view ────────────────────────────────────────────────────
  if (activeGameDef) {
    const GameComponent = activeGameDef.component;
    return (
      <div className="w-full animate-in fade-in zoom-in-95">
        <Breadcrumb
          isDarkMode={isDarkMode}
          onBackToDashboard={onBack}
          onBackToMenu={handleBackToMenu}
          currentViewLabel={t(activeGameDef.titleKey)}
        />
        <Suspense fallback={<GameLoader isDarkMode={isDarkMode} />}>
          <GameComponent isDarkMode={isDarkMode} />
        </Suspense>
      </div>
    );
  }

  // ── Menu grid ───────────────────────────────────────────────────────────
  return (
    <div className="w-full animate-in fade-in zoom-in-95">
      <Breadcrumb
        isDarkMode={isDarkMode}
        onBackToDashboard={onBack}
        onBackToMenu={handleBackToMenu}
      />

      <div className="flex items-center justify-between mb-12 border-b-8 border-yellow-400 pb-4">
        <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter">
          {t("challenges.title")}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {GAMES.map((game) => (
          <GameCard
            key={game.id}
            title={t(game.titleKey)}
            description={t(game.descKey)}
            icon={game.icon}
            color={game.color}
            onClick={() => handleGameSelect(game.id)}
            isDarkMode={isDarkMode}
            comingSoon={game.comingSoon}
            comingSoonLabel={t("challenges.coming_soon")}
          />
        ))}
      </div>
    </div>
  );
};

ChallengesMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  onBack: PropTypes.func.isRequired,
};

export default ChallengesMenu;
