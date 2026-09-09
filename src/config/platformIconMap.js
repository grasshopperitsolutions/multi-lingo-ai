import {
  Instagram,
  Facebook,
  X,
  LinkedIn,
  YouTube,
  TikTok,
  Telegram,
  WhatsApp,
} from "./platformIcons";

/**
 * Label (from tutorPlatforms.js's KNOWN_PLATFORMS) → icon component.
 *
 * Split out from platformIcons.jsx on purpose: that file exports nothing but
 * components, which is what react-refresh's fast-refresh check wants of a
 * file that exports components at all, and this object is not a component —
 * mixing the two in one file made every icon export in it get flagged.
 */
export const PLATFORM_ICONS = {
  Instagram,
  Facebook,
  X,
  LinkedIn,
  YouTube,
  TikTok,
  Telegram,
  WhatsApp,
};
