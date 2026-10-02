import PropTypes from "prop-types";
import StatusBadge from "../StatusBadge";
import BetaBadge from "./BetaBadge";

/**
 * GameCard
 *
 * One game in a hub menu: icon, title, one-line description, and the badge that
 * says why it cannot be played yet. Shared by the Challenges hub and the
 * picture games' hub, which used to be a private copy inside ChallengesMenu.
 *
 * A locked card is rendered, disabled, rather than hidden: the hub doubles as
 * the upsell surface, and a card with a "Coming soon" or "Upgrade" badge is
 * what tells somebody the game exists.
 */
const GameCard = ({ title, description, icon: Icon, color, onClick, isDarkMode, locked, badgeLabel, isBeta }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={locked}
    className={`relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-4 text-left transition-all ${
      locked
        ? "opacity-60 cursor-not-allowed"
        : "hover:-translate-y-1 active:scale-95"
    } ${
      isDarkMode
        ? "bg-slate-800 border-slate-700 shadow-[6px_6px_0px_0px_#1e293b]"
        : "bg-white border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]"
    }`}
  >
    {badgeLabel && <StatusBadge label={badgeLabel} />}
    {isBeta && <BetaBadge isDarkMode={isDarkMode} />}
    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl border-4 border-slate-900 flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-slate-900" />
    </div>
    <div>
      <h3 className={`text-sm sm:text-base font-black uppercase tracking-tight ${
        isDarkMode ? "text-white" : "text-slate-900"
      }`}>{title}</h3>
      <p className={`text-xs sm:text-sm font-semibold mt-0.5 ${
        isDarkMode ? "text-slate-400" : "text-slate-500"
      }`}>{description}</p>
    </div>
  </button>
);

GameCard.propTypes = {
  title:       PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  icon:        PropTypes.elementType.isRequired,
  color:       PropTypes.string.isRequired,
  onClick:     PropTypes.func.isRequired,
  isDarkMode:  PropTypes.bool.isRequired,
  locked:      PropTypes.bool,
  badgeLabel:  PropTypes.string,
  isBeta:      PropTypes.bool,
};

export default GameCard;
