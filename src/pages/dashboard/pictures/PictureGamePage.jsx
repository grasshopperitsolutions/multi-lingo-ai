import { lazy, Suspense, useEffect } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../../contexts/AppContext";
import { useTierAccess } from "../../../hooks/useTierAccess";
import { FeaturePageShell } from "../../../components/ui";
import { reportLockedAttempt } from "../../../services/pulseReportService";
import Loader from "../../../components/Loader";

/**
 * Each game is its own chunk, loaded when its page opens. They share this page
 * because everything around them is the same: the route guard, the breadcrumb,
 * the header with its heart and report flag, and the practice-language badge.
 */
const GAMES = {
  picture_match: {
    Game: lazy(() => import("../../../components/pictures/PictureMatchGame")),
    titleKey: "picture_games.match.title",
    reportContext: "PictureMatchPage",
  },
  picture_memory: {
    Game: lazy(() => import("../../../components/pictures/PictureMemoryGame")),
    titleKey: "picture_games.memory.title",
    reportContext: "PictureMemoryPage",
  },
  picture_odd_one_out: {
    Game: lazy(() => import("../../../components/pictures/PictureOddOneOutGame")),
    titleKey: "picture_games.odd.title",
    reportContext: "PictureOddOneOutPage",
  },
  picture_album: {
    Game: lazy(() => import("../../../components/pictures/PictureAlbum")),
    titleKey: "picture_games.album.title",
    reportContext: "PictureAlbumPage",
  },
  picture_describe: {
    Game: lazy(() => import("../../../components/pictures/PictureDescribeGame")),
    titleKey: "picture_games.describe.title",
    reportContext: "PictureDescribePage",
  },
};

/**
 * PictureGamePage
 *
 * The route for one picture game, by its gate key (`picture_match`, …).
 *
 * Access is configured in Admin > Tiers & Features. The route is guarded here
 * as well as the menu card, so it cannot be bypassed by visiting the URL: a
 * locked game sends the player back to the menu with the usual upgrade prompt.
 */
const PictureGamePage = ({ gameId }) => {
  const { isDarkMode, showAlert } = useAppContext();
  const { canAccess, isReady } = useTierAccess();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Only a loaded config can lock the route: redirecting on the first render
  // would bounce everybody out before their access is known.
  const isLocked = isReady && !canAccess(gameId);

  useEffect(() => {
    if (isLocked) {
      reportLockedAttempt(gameId);
      navigate("/dashboard/picture-games", { replace: true });
      showAlert("warning", t("subscription.errors.upgrade_required"), {
        label: t("pricing.upgrade"),
        onClick: () => navigate("/pricing"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked]);

  const game = GAMES[gameId];
  if (!game || isLocked) return null;
  const { Game, titleKey, reportContext } = game;

  return (
    <FeaturePageShell
      isDarkMode={isDarkMode}
      showPracticeLanguage
      accentColor="sky"
      title={t(titleKey)}
      reportContext={reportContext}
      breadcrumbItems={[
        { label: t("common.back", "Back"), onClick: () => navigate("/dashboard") },
        { label: t("picture_games.title"), onClick: () => navigate("/dashboard/picture-games") },
        { label: t(titleKey) },
      ]}
    >
      <Suspense fallback={<Loader isDarkMode={isDarkMode} />}>
        <Game isDarkMode={isDarkMode} />
      </Suspense>
    </FeaturePageShell>
  );
};

PictureGamePage.propTypes = {
  gameId: PropTypes.oneOf(Object.keys(GAMES)).isRequired,
};

export default PictureGamePage;
