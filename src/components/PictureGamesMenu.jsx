import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTierAccess } from "../hooks/useTierAccess";
import { PICTURE_GAMES as GAMES } from "../config/favouritableFeatures";
import { FEATURE_STATUS, PURCHASABLE_STATUSES, getStatusBadge, isFeatureBeta } from "../utils/featureAccess";
import { Breadcrumb, FeatureHeader, GameCard } from "./ui";
import { reportLockedAttempt } from "../services/pulseReportService";

/**
 * PictureGamesMenu ("Jogos com Imagens")
 *
 * The hub for the games built on a picture for each word. Built exactly like
 * the Challenges hub: the same cards, the same badges saying why a game is not
 * playable yet, the same route to pricing for one that can be bought, and the
 * practice-language badge, since every word here is shown in that language.
 *
 * Game ids double as feature keys, so who may play what is configured in
 * Admin > Tiers & Features. Games are never hidden from the list.
 */
const PictureGamesMenu = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { featureStatus, isReady, featureRegistry } = useTierAccess();

  const gameCards = isReady
    ? GAMES.map((game) => {
        const status = featureStatus(game.id);
        const badge = getStatusBadge(status);
        return {
          ...game,
          status,
          badgeLabel: badge && t(badge.key, badge.fallback),
          isBeta: isFeatureBeta(featureRegistry, game.id),
          locked: status !== FEATURE_STATUS.AVAILABLE && !PURCHASABLE_STATUSES.includes(status),
        };
      })
    : [];

  const handleGameSelect = (game) => {
    if (PURCHASABLE_STATUSES.includes(game.status)) {
      reportLockedAttempt(game.id);
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
        accentColor="sky"
        items={[{ label: t("common.back", "Back"), onClick: () => navigate("/dashboard") }]}
      />

      <FeatureHeader
        title={t("picture_games.title")}
        isDarkMode={isDarkMode}
        accentColor="sky"
        favouriteId="picture_games"
        showPracticeLanguage
        reportContext="PictureGamesMenu"
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
            isBeta={game.isBeta}
          />
        ))}
      </div>
    </div>
  );
};

PictureGamesMenu.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PictureGamesMenu;
