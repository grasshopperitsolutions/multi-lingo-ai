import PropTypes from "prop-types";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReportButton from "../ReportButton";
import FavouriteFeatureButton from "../FavouriteFeatureButton";
import PracticeLanguage from "./PracticeLanguage";
import { favouriteIdForRoute, favouritableById } from "../../config/favouritableFeatures";

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
  indigo:  { dark: "bg-indigo-500",  light: "bg-indigo-400" },
};

/**
 * The instruction line's left rule, in the page's own accent. Separate from
 * ACCENT_BAR because a border colour and a background colour are different
 * Tailwind classes, and Tailwind cannot see a class name built by string
 * concatenation — both maps have to spell every class out.
 */
const ACCENT_BORDER = {
  rose:    { dark: "border-rose-500",    light: "border-rose-400" },
  violet:  { dark: "border-violet-500",  light: "border-violet-400" },
  sky:     { dark: "border-sky-500",     light: "border-sky-400" },
  teal:    { dark: "border-teal-500",    light: "border-teal-400" },
  emerald: { dark: "border-emerald-500", light: "border-emerald-400" },
  amber:   { dark: "border-amber-500",   light: "border-amber-400" },
  yellow:  { dark: "border-yellow-500",  light: "border-yellow-400" },
  indigo:  { dark: "border-indigo-500",  light: "border-indigo-400" },
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
  showPracticeLanguage = false,
  description,
  instructions,
}) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const accent = ACCENT_BAR[accentColor] ?? ACCENT_BAR.rose;
  const accentBorder = ACCENT_BORDER[accentColor] ?? ACCENT_BORDER.rose;

  // Resolved from the route, the same way the heart finds its feature — so a
  // page gets its subtitle without declaring one, and the copy stays the
  // single string the dashboard tile already shows. A route that is not in
  // the registry (a hub, a sub-tool) simply has nothing to say here.
  const entry = favouritableById(favouriteId ?? favouriteIdForRoute(pathname));
  const subtitle = description ?? (entry?.descKey ? t(entry.descKey) : null);
  const howTo = instructions ?? (entry?.instructionsKey ? t(entry.instructionsKey) : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h1
            className={`text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            {title}
          </h1>

          <div className="flex items-center gap-1 shrink-0">
            {/* Opt-in, not automatic. It belongs on pages whose output is *in*
                the practice language, and would contradict the Translator and
                the Professional tools, which carry their own target-language
                pickers a few pixels below. */}
            {showPracticeLanguage && (
              <PracticeLanguage variant="badge" isDarkMode={isDarkMode} />
            )}
            {/* No featureId: the button works out where it is from the route,
                which covers every game, exercise and section without each page
                declaring an id that could drift from the route table. */}
            {showFavourite && <FavouriteFeatureButton featureId={favouriteId} />}
            {reportContext && <ReportButton isDarkMode={isDarkMode} context={reportContext} />}
          </div>
        </div>

        {/* Plain weight against an all-caps black heading: the title shouts,
            this one talks. */}
        {subtitle && (
          <p
            className={`text-sm sm:text-base font-semibold leading-snug ${
              isDarkMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {subtitle}
          </p>
        )}

        {/* Italic and ruled in the page's own accent, so it reads as a
            different *kind* of sentence rather than a second description.
            Italic is almost unused in this app, which is exactly why it works
            here — see config/favouritableFeatures.js for why only a handful of
            features carry one. */}
        {howTo && (
          <p
            className={`border-l-4 pl-3 text-xs sm:text-sm font-semibold italic leading-snug ${
              isDarkMode ? accentBorder.dark : accentBorder.light
            } ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}
          >
            {howTo}
          </p>
        )}
      </div>

      <div className={`h-1 w-full rounded-full ${isDarkMode ? accent.dark : accent.light}`} />
    </div>
  );
};

FeatureHeader.propTypes = {
  title: PropTypes.string.isRequired,
  /** Show which language this page works in. Opt-in — see the comment above. */
  showPracticeLanguage: PropTypes.bool,
  isDarkMode: PropTypes.bool.isRequired,
  /** Same palette as Breadcrumb; drives the rule under the title. */
  accentColor: PropTypes.oneOf(FEATURE_ACCENTS),
  /** Omit to hide the report flag. */
  reportContext: PropTypes.string,
  /** Omit to let the heart resolve the feature from the current route. */
  favouriteId: PropTypes.string,
  /** Set false where pinning makes no sense (a hub that is not favouritable). */
  showFavourite: PropTypes.bool,
  /** Overrides the registry's description. Pass "" to suppress it entirely. */
  description: PropTypes.string,
  /** Overrides the registry's instruction line. Pass "" to suppress it. */
  instructions: PropTypes.string,
};

FeatureHeader.defaultProps = {
  accentColor: "rose",
  reportContext: undefined,
  favouriteId: undefined,
  showFavourite: true,
};

export default FeatureHeader;
