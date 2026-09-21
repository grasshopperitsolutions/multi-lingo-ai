import PropTypes from "prop-types";
import { Globe } from "lucide-react";
import { flagRegion } from "../utils/flagRegion";

/**
 * Renders the real SVG flag for a language code's region subtag
 * (e.g. "en-GB" -> GB flag), not the language subtag. Falls back to a
 * generic globe icon for regionless codes (e.g. user-typed "Other" entries).
 *
 * The region comes from `utils/flagRegion`, shared with the practice-language
 * card's flag field so the two can never disagree about which flag a code
 * flies. It reads an explicit region subtag first and otherwise asks CLDR what
 * the language implies, which is what gets a flag onto the codes carrying a
 * *script* where a region would go — `ja-Hira`, `ja-Latn`, `sr-Cyrl`.
 */
const LanguageFlagIcon = ({ code, className = "" }) => {
  const region = flagRegion(code);

  if (!region) {
    return <Globe size={16} className={className} aria-hidden="true" />;
  }

  return (
    <span
      className={`fi fi-${region} ${className}`}
      role="img"
      aria-label={region.toUpperCase()}
    />
  );
};

LanguageFlagIcon.propTypes = {
  code: PropTypes.string,
  className: PropTypes.string,
};

export default LanguageFlagIcon;
