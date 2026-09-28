/**
 * acquisition.js
 *
 * Where a visitor came from, kept for the length of the browser session so it
 * can be sent once, with sign-up, and stored on the new profile
 * (`users/{uid}.acquisition`). First touch: the first page of the session
 * decides, and later pages never overwrite it.
 *
 * What is kept is deliberately little, and privacy policy §2.7 lists it:
 * - the **hostname** of the page that linked here (never the full address —
 *   a referrer URL can carry somebody's search terms);
 * - the three standard campaign tags, `utm_source`, `utm_medium` and
 *   `utm_campaign`, when the link carried them;
 * - the path of the page they landed on, without its query string.
 *
 * `sessionStorage`, not `localStorage` and not a cookie: it is gone when the
 * tab closes, it is never sent anywhere by the browser on its own, and a
 * visitor who never signs up leaves nothing behind. The server cleans it
 * again before storing it (`cleanAcquisition` in the API's lib/pulse.ts).
 */

export const ACQUISITION_KEY = "ml.acquisition";

function readUtm(params, name) {
  const value = params.get(name);
  return value ? value.trim().slice(0, 100) : undefined;
}

/**
 * Record this page as the session's first touch, unless one is already kept.
 * Call once, as the app boots. Never throws.
 *
 * @param {{ href?: string, referrer?: string }} [source] - defaults to the
 *   current page; injectable for tests.
 */
export function captureAcquisition(source = {}) {
  try {
    if (sessionStorage.getItem(ACQUISITION_KEY)) return;
    const url = new URL(source.href ?? window.location.href);
    const referrer = source.referrer ?? document.referrer;

    let referrerHost;
    if (referrer) {
      const host = new URL(referrer).hostname;
      // A link from inside the app is not somewhere they came from.
      if (host && host !== url.hostname) referrerHost = host;
    }

    const record = {
      referrerHost,
      utmSource: readUtm(url.searchParams, "utm_source"),
      utmMedium: readUtm(url.searchParams, "utm_medium"),
      utmCampaign: readUtm(url.searchParams, "utm_campaign"),
      landingPath: url.pathname,
    };
    sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(record));
  } catch {
    // Storage blocked (private mode on some browsers) or a malformed
    // referrer: there is simply nothing to report.
  }
}

/** The session's first touch, or undefined. Never throws. */
export function readAcquisition() {
  try {
    const raw = sessionStorage.getItem(ACQUISITION_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

/** Forget it once it has been sent with a sign-in. Never throws. */
export function clearAcquisition() {
  try {
    sessionStorage.removeItem(ACQUISITION_KEY);
  } catch {
    // Nothing to clear.
  }
}
