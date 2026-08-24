import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import { useFeatureFavourites } from "../hooks/useFeatureFavourites";
import FeatureCard from "./FeatureCard";
import { FavouriteButton } from "./ui";

/**
 * DashboardFeatureGrid
 *
 * Renders resolved dashboard tiles (from useDashboardFeatures) as the standard
 * card grid, with a heart on each one that pins it to the Today tab.
 *
 * Takes already-resolved tiles rather than feature ids so the tier cascade runs
 * once per render of the dashboard, not once per grid.
 *
 * Why the heart is a sibling of the card rather than a child
 * ---------------------------------------------------------
 * FeatureCard *is* a <button>. Nesting FavouriteButton inside it would be
 * invalid HTML and the heart's click would bubble into "open this feature", so
 * it is absolutely positioned over the card instead. Top-left, because
 * StatusBadge and the lock icon both sit at top-right.
 */
const DashboardFeatureGrid = ({ tiles, emptyMessage }) => {
  const { isDarkMode, showAlert } = useAppContext();
  const { isFavourite, isPending, toggle } = useFeatureFavourites();
  const navigate = useNavigate();

  const handleFeatureClick = (tile) => {
    if (tile.unavailable) {
      showAlert("info", tile.unavailableReason);
      return;
    }
    if (tile.purchasable) {
      navigate("/pricing");
      return;
    }
    if (tile.locked) return;
    navigate(tile.route);
  };

  if (tiles.length === 0) {
    return emptyMessage ? (
      <p
        className={`text-sm font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}
      >
        {emptyMessage}
      </p>
    ) : null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tiles.map((tile) => (
        <div key={tile.id} className="relative">
          <FeatureCard
            icon={tile.icon}
            title={tile.title}
            description={tile.description}
            color={tile.color}
            isDarkMode={isDarkMode}
            onClick={() => handleFeatureClick(tile)}
            statusBadgeLabel={tile.statusBadgeLabel}
            disabled={tile.unavailable || tile.locked}
          />
          <div className="absolute top-3 left-3 z-20">
            <FavouriteButton
              isFavourite={isFavourite(tile.id)}
              onToggle={(event) => {
                event.stopPropagation();
                toggle(tile.id);
              }}
              disabled={isPending(tile.id)}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

DashboardFeatureGrid.propTypes = {
  /** Resolved tiles from useDashboardFeatures — not raw config entries. */
  tiles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      icon: PropTypes.elementType.isRequired,
      title: PropTypes.string,
      description: PropTypes.string,
      color: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
      statusBadgeLabel: PropTypes.string,
      unavailable: PropTypes.bool,
      unavailableReason: PropTypes.string,
      purchasable: PropTypes.bool,
      locked: PropTypes.bool,
    }),
  ).isRequired,
  /** Shown instead of the grid when there is nothing to render. */
  emptyMessage: PropTypes.string,
};

DashboardFeatureGrid.defaultProps = {
  emptyMessage: undefined,
};

export default DashboardFeatureGrid;
