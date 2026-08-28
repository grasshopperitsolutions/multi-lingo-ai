import PropTypes from "prop-types";
import ReportButton from "../ReportButton";
import FavouriteFeatureButton from "../FavouriteFeatureButton";

/**
 * FeatureHeader
 *
 * The title row every feature page shares: the heading, the heart and report
 * flag, and a coloured rule underneath.
 *
 * Extracted because Translator and Dictionary had grown this treatment by hand
 * while the pages behind FeaturePageShell had a plainer one, and the exam
 * exercises had no header at all until their content finished loading — so the
 * heart and the flag only appeared once you had asked for an exercise. One
 * component means the controls are in the same place, at the same moment, on
 * every feature.
 *
 * The rule's colour follows `accentColor`, the same value Breadcrumb takes, so
 * a page states its colour once.
 */
const ACCENT_BAR = {
  rose:    { dark: "bg-rose-500",    light: "bg-rose-400" },
  violet:  { dark: "bg-violet-500",  light: "bg-violet-400" },
  sky:     { dark: "bg-sky-500",     light: "bg-sky-400" },
  teal:    { dark: "bg-teal-500",    light: "bg-teal-400" },
  emerald: { dark: "bg-emerald-500", light: "bg-emerald-400" },
  amber:   { dark: "bg-amber-500",   light: "bg-amber-400" },
  yellow:  { dark: "bg-yellow-500",  light: "bg-yellow-400" },
};

// eslint-disable-next-line react-refresh/only-export-components
export const FEATURE_ACCENTS = Object.keys(ACCENT_BAR);

const FeatureHeader = ({
  title,
  isDarkMode,
  accentColor,
  reportContext,
  favouriteId,
  showFavourite,
}) => {
  const accent = ACCENT_BAR[accentColor] ?? ACCENT_BAR.rose;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1
          className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
            isDarkMode ? "text-white" : "text-slate-900"
          }`}
        >
          {title}
        </h1>

        <div className="flex items-center gap-1 shrink-0">
          {/* No featureId: the button works out where it is from the route,
              which covers every game, exercise and section without each page
              declaring an id that could drift from the route table. */}
          {showFavourite && <FavouriteFeatureButton featureId={favouriteId} />}
          {reportContext && <ReportButton isDarkMode={isDarkMode} context={reportContext} />}
        </div>
      </div>

      <div className={`h-1 w-full rounded-full ${isDarkMode ? accent.dark : accent.light}`} />
    </div>
  );
};

FeatureHeader.propTypes = {
  title: PropTypes.string.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
  /** Same palette as Breadcrumb; drives the rule under the title. */
  accentColor: PropTypes.oneOf(FEATURE_ACCENTS),
  /** Omit to hide the report flag. */
  reportContext: PropTypes.string,
  /** Omit to let the heart resolve the feature from the current route. */
  favouriteId: PropTypes.string,
  /** Set false where pinning makes no sense (a hub that is not favouritable). */
  showFavourite: PropTypes.bool,
};

FeatureHeader.defaultProps = {
  accentColor: "rose",
  reportContext: undefined,
  favouriteId: undefined,
  showFavourite: true,
};

export default FeatureHeader;
