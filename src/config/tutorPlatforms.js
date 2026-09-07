/**
 * Hostnames a tutor link is recognised on sight.
 *
 * A match here validates a link instantly and for free — no AI call, no
 * network. Anything not listed is still perfectly allowed; it just has to go
 * through the "Validate" button, because we are not affiliated with any
 * platform and tutors must be able to link wherever they actually work.
 *
 * Matching is on hostname only, so referral codes, query strings and deep
 * paths all pass through untouched: a Preply referral link and a Preply
 * profile link are both simply "Preply".
 */

/**
 * Registered hostnames, each mapping to the label shown on the chip.
 * `www.` is stripped before lookup, and a hostname also matches any of its
 * subdomains (so `nuno.youcanbook.me` matches `youcanbook.me`).
 */
export const KNOWN_PLATFORMS = {
  // Scheduling
  "calendly.com": "Calendly",
  "cal.com": "Cal.com",
  "youcanbook.me": "YouCanBook.me",
  "savvycal.com": "SavvyCal",

  // Language marketplaces
  "preply.com": "Preply",
  "italki.com": "italki",
  "verbling.com": "Verbling",
  "superprof.com": "Superprof",
  "amazingtalker.com": "AmazingTalker",
  "lingoda.com": "Lingoda",
  "tandem.net": "Tandem",
  "hellotalk.com": "HelloTalk",

  // Social and video
  "instagram.com": "Instagram",
  "youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "tiktok.com": "TikTok",
  "linkedin.com": "LinkedIn",
  "facebook.com": "Facebook",
  "x.com": "X",
  "twitter.com": "X",
  "threads.net": "Threads",
  "bsky.app": "Bluesky",

  // Contact and places
  "wa.me": "WhatsApp",
  "t.me": "Telegram",
  "maps.app.goo.gl": "Google Maps",
  "goo.gl": "Google Maps",
  "maps.google.com": "Google Maps",

  // Sites and payments tutors commonly use
  "substack.com": "Substack",
  "patreon.com": "Patreon",
  "ko-fi.com": "Ko-fi",
  "buymeacoffee.com": "Buy Me a Coffee",
  "notion.site": "Notion",
  "linktr.ee": "Linktree",
  "wordpress.com": "WordPress",
  "medium.com": "Medium",
};

/**
 * Normalizes and validates a URL string.
 *
 * https only. http is rejected rather than upgraded: these links are rendered
 * on a public directory page and clicked by strangers, and silently rewriting
 * someone's URL is worse than telling them it isn't accepted.
 *
 * @param {string} raw
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
export function parseTutorUrl(raw) {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (url.protocol !== "https:") return { ok: false, reason: "not_https" };
  if (!url.hostname.includes(".")) return { ok: false, reason: "malformed" };

  return { ok: true, url };
}

/**
 * The platform label for a URL, or null when the host isn't one we know.
 *
 * Null is not a rejection — it only means the link needs the AI check.
 *
 * @param {string} raw
 * @returns {string | null}
 */
export function matchKnownPlatform(raw) {
  const parsed = parseTutorUrl(raw);
  if (!parsed.ok) return null;

  const host = parsed.url.hostname.replace(/^www\./, "").toLowerCase();

  if (KNOWN_PLATFORMS[host]) return KNOWN_PLATFORMS[host];

  // Subdomain match: "nuno.youcanbook.me" -> "youcanbook.me". Walking the
  // labels rather than using endsWith avoids "notpreply.com" matching
  // "preply.com".
  const labels = host.split(".");
  for (let i = 1; i < labels.length - 1; i++) {
    const parent = labels.slice(i).join(".");
    if (KNOWN_PLATFORMS[parent]) return KNOWN_PLATFORMS[parent];
  }

  return null;
}
