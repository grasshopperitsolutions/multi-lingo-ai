import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

/**
 * Reusable Avatar component.
 * Renders the user's photo if `src` is provided and loads, otherwise a
 * placeholder.
 *
 * The placeholder is a deliberately chunky silhouette rather than the usual
 * grey blob: flat brand fill, heavy ink outline, and a slight tilt, so a
 * profile with no picture still looks like it belongs to this app instead of
 * looking broken. It stays anonymous on purpose — initials would render as
 * junk for the accounts that have no display name, which is most of the
 * accounts that also have no photo.
 *
 * **A picture that fails to load gets the placeholder too.** A profile keeps
 * the sign-in provider's picture as a link to the provider's server, and the
 * profile only falls back to it when the field is empty — nothing notices
 * when the link itself stops working, as a Google one does once its owner
 * changes their Google picture. Without this, that showed as a broken image.
 * The failure is remembered per `src`, so a new picture is tried afresh.
 *
 * `referrerPolicy="no-referrer"` because Google-hosted profile pictures are
 * widely reported to refuse requests that carry the page's address. It costs
 * nothing for our own Storage links, which are public.
 *
 * **Google's "no photo" picture counts as no picture.** An account without a
 * photo still comes back from Google with a `picture` — a generic blue figure
 * at `.../a/default-user` — and it loads, so neither the empty check nor the
 * load failure above ever saw it. It is recognised here rather than cleaned
 * out of the data because it is already stored on existing profiles and
 * copied onto tutor cards, and this component is the one place every one of
 * them is drawn.
 */
const Avatar = ({ src, alt, size = 64, isDarkMode = false, className = "" }) => {
  const { t } = useTranslation();
  const [failedSrc, setFailedSrc] = useState(null);
  const showImage = Boolean(src) && src !== failedSrc && !_isProviderDefaultPhoto(src);
  const borderColor = isDarkMode ? "border-slate-600" : "border-slate-900";
  const shadowColor = isDarkMode ? "shadow-[4px_4px_0px_0px_#1e293b]" : "shadow-[4px_4px_0px_0px_#0f172a]";

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden border-4 ${borderColor} ${shadowColor} ${className}`}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt || t("avatar.alt_fallback")}
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
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

/**
 * A sign-in provider's stand-in for "this account has no photo".
 *
 * Only Google's is known, and only by its path: the generic figure is served
 * from `/a/default-user` on a googleusercontent.com host, at whatever size
 * suffix was asked for. The coloured initial Google draws for a personal
 * account without a photo has an ordinary-looking URL and cannot be told
 * apart from a real photo — nor does it need to be, since it is at least the
 * account's own.
 */
function _isProviderDefaultPhoto(src) {
  try {
    const { hostname, pathname } = new URL(src);
    return hostname.endsWith(".googleusercontent.com") && pathname.startsWith("/a/default-user");
  } catch {
    return false;
  }
}

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