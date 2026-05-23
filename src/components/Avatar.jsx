import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * Reusable Avatar component.
 * Renders the user's photo if `src` is provided, otherwise shows a silhouette placeholder.
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
          aria-hidden="true"
        >
          <circle cx="32" cy="32" r="32" fill="#e2e8f0" />
          <circle cx="32" cy="26" r="10" fill="#94a3b8" />
          <ellipse cx="32" cy="50" rx="16" ry="10" fill="#94a3b8" />
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