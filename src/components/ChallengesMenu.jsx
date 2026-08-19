import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BrainCircuit, Swords, NotebookPen, Search, EggFried, Link2, Footprints } from "lucide-react";
import { useTierAccess } from "../hooks/useTierAccess";
import StatusBadge from "./StatusBadge";
import ReportButton from "./ReportButton";
import { Breadcrumb } from "./ui";

// ── Game Registry ─────────────────────────────────────────────────────────────
const GAMES = [
  {
    id: "hangman",
    route: "/dashboard/challenges/hangman",
    icon: Swords,
    color: "bg-rose-400",
    titleKey: "challenges.hangman",
    descKey: "challenges.hangman_desc",
    comingSoon: false,
  },
  {
    id: "scrambled_word",
    route: "/dashboard/challenges/scrambled-word",
    icon: EggFried,
    color: "bg-yellow-400",
    titleKey: "challenges.scrambled_word",
    descKey: "challenges.scrambled_word_desc",
    comingSoon: false,
  },
  {
    id: "word_search",
    route: "/dashboard/challenges/word-search",
    icon: Search,
    color: "bg-purple-400",
    titleKey: "challenges.word_search",
    descKey: "challenges.word_search_desc",
    comingSoon: false,
  },
  {
    id: "word_link",
    route: "/dashboard/challenges/word-link",
    icon: Link2,
    color: "bg-indigo-400",
    titleKey: "challenges.word_link",
    descKey: "challenges.word_link_desc",
    comingSoon: false,
  },
  {
    id: "word_ladder",
    route: "/dashboard/challenges/word-ladder",
    icon: Footprints,
    color: "bg-orange-400",
    titleKey: "challenges.word_ladder",
    descKey: "challenges.word_ladder_desc",
    comingSoon: false,
  },
  {
    id: "word_quiz",
    route: "/dashboard/challenges/word-quiz",
    icon: NotebookPen,
    color: "bg-emerald-400",
    titleKey: "challenges.word_quiz",
    descKey: "challenges.word_quiz_desc",
    comingSoon: true,
  },
  {
    id: "crosswords",
    route: "/dashboard/challenges/crosswords",
    icon: BrainCircuit,
    color: "bg-blue-400",
    titleKey: "challenges.crosswords",
    descKey: "challenges.crosswords_desc",
    comingSoon: true,
  },
];

// ── Sub-components ────────────────────────────────────────────────────────────
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
  title:           PropTypes.string.isRequired,
  description:     PropTypes.string.isRequired,
  icon:            PropTypes.elementType.isRequired,
  color:           PropTypes.string.isRequired,
  onClick:         PropTypes.func.isRequired,
  isDarkMode:      PropTypes.bool.isRequired,
  comingSoon:      PropTypes.bool,
  comingSoonLabel: PropTypes.string,
};

// ── ChallengesMenu (Challenge Hub) ────────────────────────────────────────────
const ChallengesMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canAccess } = useTierAccess();

  // Game ids double as feature keys (see src/config/features.js); access is
  // configured in Admin > Tiers & Features.
  const visibleGames = GAMES.filter((game) => canAccess(game.id));

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="rose"
        items={[{ label: t('common.back', 'Back'), onClick: () => navigate('/dashboard') }]}
      />

      {/* Page title + report flag */}
      <div className="flex items-center justify-between gap-2">
        <h1 className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          {t('challenges.title', 'Challenges')}
        </h1>
        <ReportButton isDarkMode={isDarkMode} context="ChallengesMenu" />
      </div>

      <div className="grid grid-cols-1 gap-3 mt-2">
        {visibleGames.map((game) => (
          <GameCard
            key={game.id}
            title={t(game.titleKey)}
            description={t(game.descKey)}
            icon={game.icon}
            color={game.color}
            onClick={() => navigate(game.route)}
            isDarkMode={isDarkMode}
            comingSoon={game.comingSoon}
            comingSoonLabel={t('challenges.coming_soon', 'Coming Soon')}
          />
        ))}
      </div>
    </div>
  );
};

ChallengesMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default ChallengesMenu;
