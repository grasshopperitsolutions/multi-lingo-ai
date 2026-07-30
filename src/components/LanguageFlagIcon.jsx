import PropTypes from "prop-types";
import { Globe } from "lucide-react";

/**
 * Renders the real SVG flag for a language code's region subtag
 * (e.g. "en-GB" -> GB flag), not the language subtag. Falls back to a
 * generic globe icon for regionless codes (e.g. user-typed "Other" entries).
 */
const LanguageFlagIcon = ({ code, className = "" }) => {
  const region = typeof code === "string" ? code.split("-")[1] : null;

  if (!region) {
    return <Globe size={16} className={className} aria-hidden="true" />;
  }

  return (
    <span
      className={`fi fi-${region.toLowerCase()} ${className}`}
      role="img"
      aria-label={region}
    />
  );
};

LanguageFlagIcon.propTypes = {
  code: PropTypes.string,
  className: PropTypes.string,
};

export default LanguageFlagIcon;
