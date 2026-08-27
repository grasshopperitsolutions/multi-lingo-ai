import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../contexts/AppContext";
import FeatureCard from "./FeatureCard";

/**
 * DashboardFeatureGrid
 *
 * Renders resolved dashboard tiles (from useDashboardFeatures) as the standard
 * card grid, with a heart on each one that pins it to the Today tab.
 *
 * Takes already-resolved tiles rather than feature ids so the tier cascade runs
 * once per render of the dashboard, not once per grid.
 *
 * There is deliberately no heart here. Favouriting moved onto the feature pages
 * themselves (see FavouriteFeatureButton, next to the report flag), so a user
 * can pin the Challenges hub or one specific game rather than only a whole tile.
 */
const DashboardFeatureGrid = ({ tiles, emptyMessage, gridClassName, showDescriptions }) => {
  const { isDarkMode, showAlert } = useAppContext();
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
    <div className={gridClassName}>
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
            showDescription={showDescriptions}
            compact
          />
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
  /** Grid classes. Overridden inside a book page, which is narrower than the
   *  full-width tab panel and cannot take three columns. */
  gridClassName: PropTypes.string,
  /** Print each description on its card rather than in a hover tooltip. Set
   *  inside the book pages, where a tooltip would be clipped by the scroll
   *  container. */
  showDescriptions: PropTypes.bool,
};

DashboardFeatureGrid.defaultProps = {
  emptyMessage: undefined,
  // Two columns even on the narrowest phones — a single column of tall
  // cards made the sections very long to scroll past.
  gridClassName: "grid grid-cols-2 lg:grid-cols-3 gap-4",
  showDescriptions: false,
};

export default DashboardFeatureGrid;
