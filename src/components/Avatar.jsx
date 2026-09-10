import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * Reusable Avatar component.
 * Renders the user's photo if `src` is provided, otherwise a placeholder.
 *
 * The placeholder is a deliberately chunky silhouette rather than the usual
 * grey blob: flat brand fill, heavy ink outline, and a slight tilt, so a
 * profile with no picture still looks like it belongs to this app instead of
 * looking broken. It stays anonymous on purpose — initials would render as
 * junk for the accounts that have no display name, which is most of the
 * accounts that also have no photo.
 */
const Avatar = ({ src, alt, size = 64, isDarkMode = false, className = "" }) => {
  const { t } = useTranslation();
  const borderColor = isDarkMode ? "border-slate-600" : "border-slate-900";
  const shadowColor = isDarkMode ? "shadow-[4px_4px_0px_0px_#1e293b]" : "shadow-[4px_4px_0px_0px_#0f172a]";

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden border-4 ${borderColor} ${shadowColor} ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={alt || t("avatar.alt_fallback")}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={alt || t("avatar.alt_fallback")}
        >
          <rect width="64" height="64" fill={isDarkMode ? "#1e293b" : "#facc15"} />
          {/* Tilted as a group so head and shoulders stay joined; the round
              container crops the shoulders, which is what gives it the
              cut-out, sticker-like look. */}
          <g
            transform="rotate(-4 32 32)"
            stroke={isDarkMode ? "#facc15" : "#0f172a"}
            strokeWidth="5"
            strokeLinejoin="round"
            fill={isDarkMode ? "#0f172a" : "#ffffff"}
          >
            <circle cx="32" cy="24" r="11" />
            <path d="M11 62 v-4 a21 17 0 0 1 42 0 v4" />
          </g>
        </svg>
      )}
    </div>
  );
};

Avatar.propTypes = {
  /** URL of the profile image */
  src: PropTypes.string,
  /** Alt text for the image */
  alt: PropTypes.string,
  /** Width & height in pixels (square) */
  size: PropTypes.number,
  /** Whether dark mode is active */
  isDarkMode: PropTypes.bool,
  /** Additional CSS classes */
  className: PropTypes.string,
};

export default Avatar;