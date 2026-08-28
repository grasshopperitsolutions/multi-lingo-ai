import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTierAccess } from "../hooks/useTierAccess";
import { CHALLENGE_GAMES as GAMES } from "../config/favouritableFeatures";
import { FEATURE_STATUS, PURCHASABLE_STATUSES, getStatusBadge } from "../utils/featureAccess";
import StatusBadge from "./StatusBadge";
import { Breadcrumb, FeatureHeader } from "./ui";

// ── Sub-components ────────────────────────────────────────────────────────────
const GameCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, locked, badgeLabel }) => (
  <button
    onClick={onClick}
    disabled={locked}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      locked
        ? 'opacity-60 cursor-not-allowed'
        : 'hover:-translate-y-1 active:scale-95'
    } ${
      isDarkMode
        ? 'bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]'
        : 'bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]'
    }`}
  >
    {badgeLabel && <StatusBadge label={badgeLabel} />}
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
  locked:          PropTypes.bool,
  badgeLabel:      PropTypes.string,
};

// ── ChallengesMenu (Challenge Hub) ────────────────────────────────────────────
const ChallengesMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { featureStatus, isReady } = useTierAccess();

  // Game ids double as feature keys; access is configured in
  // Admin > Tiers & Features. Games are never hidden — each carries a badge
  // saying why it isn't playable yet, and a purchasable one routes to pricing.
  const gameCards = isReady
    ? GAMES.map((game) => {
        const status = featureStatus(game.id);
        const badge = getStatusBadge(status);
        return {
          ...game,
          status,
          badgeLabel: badge && t(badge.key, badge.fallback),
          locked:
            status !== FEATURE_STATUS.AVAILABLE && !PURCHASABLE_STATUSES.includes(status),
        };
      })
    : [];

  const handleGameSelect = (game) => {
    if (PURCHASABLE_STATUSES.includes(game.status)) {
      navigate("/pricing");
      return;
    }
    if (game.locked) return;
    navigate(game.route);
  };

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        isDarkMode={isDarkMode}
        accentColor="rose"
        items={[{ label: t('common.back', 'Back'), onClick: () => navigate('/dashboard') }]}
      />

      <FeatureHeader
        title={t('challenges.title', 'Challenges')}
        isDarkMode={isDarkMode}
        accentColor="rose"
        favouriteId="challenges"
        reportContext="ChallengesMenu"
      />

      <div className="grid grid-cols-1 gap-3 mt-2">
        {gameCards.map((game) => (
          <GameCard
            key={game.id}
            title={t(game.titleKey)}
            description={t(game.descKey)}
            icon={game.icon}
            color={game.color}
            onClick={() => handleGameSelect(game)}
            isDarkMode={isDarkMode}
            locked={game.locked}
            badgeLabel={game.badgeLabel}
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
