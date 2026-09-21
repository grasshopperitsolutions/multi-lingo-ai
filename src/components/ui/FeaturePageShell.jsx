import PropTypes from "prop-types";
import Breadcrumb from "./Breadcrumb";
import FeatureHeader, { FEATURE_ACCENTS } from "./FeatureHeader";

/**
 * FeaturePageShell
 *
 * Shared chrome for routed game/exercise pages: a Breadcrumb, the feature
 * header (title, heart, report flag, coloured rule), then the content.
 *
 * The header used to be optional, and the exam exercises left it out so they
 * could render their own heading from inside their content. That meant the
 * heart and the report flag did not exist until an exercise had been requested
 * and loaded. Passing `title` here instead puts them on screen immediately, in
 * the same place as every other feature.
 *
 * `title` is still optional for the rare page that genuinely has no heading,
 * but prefer passing it.
 */
const FeaturePageShell = ({
  isDarkMode,
  accentColor,
  breadcrumbItems,
  title,
  reportContext,
  favouriteId,
  showFavourite,
  showPracticeLanguage,
  description,
  instructions,
  children,
}) => (
  <div className="flex flex-col gap-4">
    <Breadcrumb isDarkMode={isDarkMode} accentColor={accentColor} items={breadcrumbItems} />

    {title && (
      <FeatureHeader
        title={title}
        isDarkMode={isDarkMode}
        accentColor={accentColor}
        reportContext={reportContext}
        favouriteId={favouriteId}
        showFavourite={showFavourite}
        showPracticeLanguage={showPracticeLanguage}
        description={description}
        instructions={instructions}
      />
    )}

    {children}
  </div>
);

FeaturePageShell.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  accentColor: PropTypes.oneOf(FEATURE_ACCENTS),
  breadcrumbItems: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
    }),
  ).isRequired,
  title: PropTypes.string,
  /** Show which language this page works in, beside the title. */
  showPracticeLanguage: PropTypes.bool,
  reportContext: PropTypes.string,
  /** Omit to let the heart resolve the feature from the current route. */
  favouriteId: PropTypes.string,
  showFavourite: PropTypes.bool,
  /** Both default to the route's own registry copy; pass "" to suppress. */
  description: PropTypes.string,
  instructions: PropTypes.string,
  children: PropTypes.node,
};

FeaturePageShell.defaultProps = {
  accentColor: "rose",
  title: undefined,
  reportContext: undefined,
  favouriteId: undefined,
  showFavourite: true,
};

export default FeaturePageShell;
