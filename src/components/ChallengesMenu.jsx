import { lazy, Suspense, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { ArrowLeft, BrainCircuit, Swords, NotebookPen, Search, EggFried } from "lucide-react";
import StatusBadge from "./StatusBadge";
import ReportButton from "./ReportButton";

// ── Lazy-loaded game components ───────────────────────────────────────────────
const HangmanGame     = lazy(() => import("./HangmanGame"));
const CrosswordsGame  = lazy(() => import("./CrosswordsGame"));
const WordQuizGame    = lazy(() => import("./WordQuizGame"));
const WordSearchGame  = lazy(() => import("./WordSearchGame"));
const ScrambledWordGame = lazy(() => import("./ScrambledWordGame"));

// ── Game Registry ─────────────────────────────────────────────────────────────
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
    id: "word_search",
    icon: Search,
    color: "bg-purple-400",
    titleKey: "challenges.word_search",
    descKey: "challenges.word_search_desc",
    component: WordSearchGame,
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
    id: "crosswords",
    icon: BrainCircuit,
    color: "bg-blue-400",
    titleKey: "challenges.crosswords",
    descKey: "challenges.crosswords_desc",
    component: CrosswordsGame,
    comingSoon: true,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
const Breadcrumb = ({ isDarkMode, onBackToDashboard, onBackToMenu, currentViewLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <button
        onClick={onBackToDashboard}
        className={`flex items-center gap-1 text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
          isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <ArrowLeft size={14} />
        <span className="hidden xs:inline">{t("dashboard.back")}</span>
      </button>
      <span className={isDarkMode ? "text-slate-600" : "text-slate-400"}>/</span>
      {currentViewLabel ? (
        <>
          <button
            onClick={onBackToMenu}
            className={`text-xs sm:text-sm font-black uppercase tracking-widest transition-colors ${
              isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t("challenges.title")}
          </button>
          <span className={isDarkMode ? "text-slate-600" : "text-slate-400"}>/</span>
          <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
            isDarkMode ? "text-rose-400" : "text-rose-600"
          }`}>
            {currentViewLabel}
          </span>
        </>
      ) : (
        <span className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
          isDarkMode ? "text-rose-400" : "text-rose-600"
        }`}>
          {t("challenges.title")}
        </span>
      )}
    </div>
  );
};
Breadcrumb.propTypes = {
  isDarkMode:        PropTypes.bool.isRequired,
  onBackToDashboard: PropTypes.func.isRequired,
  onBackToMenu:      PropTypes.func.isRequired,
  currentViewLabel:  PropTypes.string,
};

const GameCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, comingSoon, comingSoonLabel }) => (
  <button
    onClick={onClick}
    disabled={comingSoon}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      comingSoon
        ? 'opacity-60 cursor-not-allowed'
        : 'hover:-translate-y-1 active:scale-95'
    } ${
      isDarkMode
        ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
        : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
    }`}
  >
    {comingSoon && <StatusBadge label={comingSoonLabel} />}
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-slate-900" />
    </div>
    <div>
      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
        isDarkMode ? 'text-white' : 'text-slate-900'
      }`}>{title}</h3>
      <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
        isDarkMode ? 'text-slate-400' : 'text-slate-500'
      }`}>{description}</p>
    </div>
  </button>
);
GameCard.propTypes = {
  title:          PropTypes.string.isRequired,
  description:    PropTypes.string.isRequired,
  icon:           PropTypes.elementType.isRequired,
  color:          PropTypes.string.isRequired,
  onClick:        PropTypes.func.isRequired,
  isDarkMode:     PropTypes.bool.isRequired,
  comingSoon:     PropTypes.bool,
  comingSoonLabel:PropTypes.string,
};

const GameLoader = ({ isDarkMode }) => (
  <div className={`flex items-center justify-center py-16 ${
    isDarkMode ? 'text-slate-400' : 'text-slate-500'
  }`}>
    <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin border-current" />
  </div>
);
GameLoader.propTypes = { isDarkMode: PropTypes.bool.isRequired };

// ── ChallengesMenu (Challenge Hub) ────────────────────────────────────────────
const ChallengesMenu = ({ isDarkMode, onBack }) => {
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState(null);

  const handleGameSelect = (gameId) => setActiveGame(gameId);
  const handleBackToMenu = () => setActiveGame(null);

  const activeGameDef = activeGame ? GAMES.find((g) => g.id === activeGame) : null;

  // ── Active game view ──────────────────────────────────────────────────────
  if (activeGameDef) {
    const GameComponent = activeGameDef.component;
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumb
          isDarkMode={isDarkMode}
          onBackToDashboard={onBack}
          onBackToMenu={handleBackToMenu}
          currentViewLabel={t(activeGameDef.titleKey)}
        />
        <div className="flex items-center justify-between gap-2">
          <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}>
            {t(activeGameDef.titleKey)}
          </h1>
          <ReportButton isDarkMode={isDarkMode} context={`ChallengesMenu-${activeGameDef.id}`} />
        </div>
        <Suspense fallback={<GameLoader isDarkMode={isDarkMode} />}>
          <GameComponent isDarkMode={isDarkMode} onBack={handleBackToMenu} />
        </Suspense>
      </div>
    );
  }

  // ── Menu grid ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        onBackToDashboard={onBack}
        onBackToMenu={handleBackToMenu}
      />

      {/* Page title + report flag */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          {t("challenges.title")}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="ChallengesMenu" />
      </div>

      <div className="grid grid-cols-1 gap-3 mt-2">
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
  onBack:     PropTypes.func.isRequired,
};

export default ChallengesMenu;
