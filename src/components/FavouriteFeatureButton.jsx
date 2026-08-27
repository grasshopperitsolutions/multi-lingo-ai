import PropTypes from "prop-types";
import { useLocation } from "react-router-dom";
import { useFeatureFavourites } from "../hooks/useFeatureFavourites";
import { useAppContext } from "../contexts/AppContext";
import { favouriteIdForRoute } from "../config/favouritableFeatures";
import { FavouriteButton } from "./ui";

/**
 * FavouriteFeatureButton
 *
 * The heart that pins a feature to the Today panel. Sits immediately left of
 * the ReportButton in a feature page's title row.
 *
 * It lives on the page itself rather than on the dashboard tile so the thing
 * being pinned can be as specific as the user likes: the Challenges hub, or
 * Hangman inside it.
 *
 * `featureId` is the feature's gate key — the same string featureStatus() takes
 * — and must exist in config/favouritableFeatures.js, or Today will have no way
 * to render what was pinned.
 *
 * Omit it and the button works out where it is from the current route, which is
 * how the shared page shell covers every game, exercise and section without
 * each page declaring an id that could drift from the route table. Renders
 * nothing on a route that isn't favouritable.
 */
const FavouriteFeatureButton = ({ featureId, className }) => {
  const { isDarkMode } = useAppContext();
  const { isFavourite, isPending, toggle } = useFeatureFavourites();
  const { pathname } = useLocation();

  const resolvedId = featureId ?? favouriteIdForRoute(pathname);
  if (!resolvedId) return null;

  return (
    <span className={className}>
      <FavouriteButton
        isFavourite={isFavourite(resolvedId)}
        onToggle={() => toggle(resolvedId)}
        disabled={isPending(resolvedId)}
        isDarkMode={isDarkMode}
      />
    </span>
  );
};

FavouriteFeatureButton.propTypes = {
  /** Gate key of the feature or sub-feature being pinned. */
  featureId: PropTypes.string,
  className: PropTypes.string,
};

FavouriteFeatureButton.defaultProps = {
  featureId: undefined,
  className: undefined,
};

export default FavouriteFeatureButton;
