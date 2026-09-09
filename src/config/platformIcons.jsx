/**
 * platformIcons.jsx
 *
 * Small brand marks for the platforms a tutor link is recognised on (see
 * config/tutorPlatforms.js). Hand-drawn rather than pulled from a package:
 * lucide-react 1.x dropped every brand icon it used to carry (see
 * CLAUDE.md), and the alternative — a library like simple-icons — ships
 * every brand's mark to cover the eight used here, for a handful of 16px
 * glyphs that never change.
 *
 * Deliberately simplified, not a pixel-accurate trace of each trademark: a
 * small monochrome glyph that reads as "that's Instagram" at 16px is the
 * actual UX goal, not asset fidelity. Every icon takes `currentColor` (so it
 * inherits the surrounding text color and needs no dark-mode variant) except
 * WhatsApp, drawn in the brand's own green — see the comment on it below.
 *
 * Two platforms deliberately have no icon here — Threads' loop and Bluesky's
 * butterfly do not reduce to a shape simple enough to draw confidently at
 * this size, and a wrong-looking "brand" glyph is worse for recognition than
 * the plain generic link icon TutorCard already falls back to.
 *
 * Only the components live in this file, each its own export — nothing else,
 * so react-refresh's "only export components" check stays happy. The lookup
 * map that ties a platform label to one of these lives in
 * platformIconMap.js, which has no component of its own to protect.
 */

export const Instagram = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
    <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
  </svg>
);

export const Facebook = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M14.5 8.5H16.5V5.5H14.5C12.29 5.5 10.5 7.29 10.5 9.5V11.5H8.5V14.5H10.5V19.5H13.5V14.5H15.5L16 11.5H13.5V9.5C13.5 8.95 13.95 8.5 14.5 8.5Z"
      fill="currentColor"
    />
  </svg>
);

export const X = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M5 5L19 19M19 5L5 19"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

export const LinkedIn = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
    <circle cx="7.8" cy="8.2" r="1.3" fill="currentColor" />
    <path
      d="M7.8 11V17M12 17V13.3C12 12 12.9 11 14.1 11C15.3 11 16.2 12 16.2 13.3V17"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const YouTube = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="4" stroke="currentColor" strokeWidth="2" />
    <path d="M10 9L15.5 12L10 15V9Z" fill="currentColor" />
  </svg>
);

export const TikTok = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M14 4V14.5C14 15.9 12.9 17 11.5 17C10.1 17 9 15.9 9 14.5C9 13.1 10.1 12 11.5 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M14 4C14 6.2 15.8 8 18 8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const Telegram = (props) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M21 4L3 11.5L9.5 13.5M21 4L18 20L9.5 13.5M21 4L9.5 13.5V18.5L13 15"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * The one icon shown in the app's own brand green rather than `currentColor`
 * — it doubles as a status signal ("this number takes WhatsApp"), not just a
 * link decoration, and the colour is most of what makes it legible as that
 * signal at a glance.
 */
export const WhatsApp = (props) => (
  <svg viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 3.5C7.31 3.5 3.5 7.31 3.5 12c0 1.58.44 3.05 1.2 4.31L3.5 20.5l4.32-1.16A8.46 8.46 0 0 0 12 20.5c4.69 0 8.5-3.81 8.5-8.5S16.69 3.5 12 3.5Zm0 1.7c3.76 0 6.8 3.04 6.8 6.8 0 3.76-3.04 6.8-6.8 6.8a6.76 6.76 0 0 1-3.45-.95l-.25-.14-2.56.68.69-2.5-.16-.26A6.75 6.75 0 0 1 5.2 12c0-3.76 3.04-6.8 6.8-6.8Z" />
    <path d="M9.65 8.13c-.19-.42-.39-.43-.57-.44l-.49-.01c-.17 0-.44.06-.67.32-.23.25-.87.85-.87 2.08s.89 2.42 1.01 2.58c.13.17 1.73 2.77 4.28 3.77 2.11.83 2.54.67 3 .62.46-.04 1.48-.6 1.69-1.19.21-.58.21-1.08.14-1.19-.06-.1-.23-.16-.48-.28-.25-.13-1.48-.73-1.71-.82-.23-.08-.4-.13-.56.13-.17.25-.65.82-.79.99-.15.17-.29.19-.54.06-.25-.13-1.05-.39-2.01-1.24-.74-.66-1.24-1.48-1.39-1.73-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.24-.42.08-.17.04-.31-.02-.44-.06-.13-.55-1.39-.77-1.9Z" />
  </svg>
);
