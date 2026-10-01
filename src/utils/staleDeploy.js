/**
 * staleDeploy.js
 *
 * What to do when the app running in the browser is older than the site.
 *
 * Every deploy replaces the whole site on GitHub Pages, and every lazily
 * loaded page has a content-hashed file name (`ChallengesMenu-ESWg3ffF.js`).
 * An app loaded before a deploy still holds the old names, so the first time
 * it opens a page it hasn't loaded yet, it asks for a file that no longer
 * exists. React caches the failed import, so retrying the render can't help;
 * only loading the new index.html does. An installed app on a phone is the
 * extreme case: it stays open in memory for days and is rarely reloaded.
 *
 * The answer is one reload, guarded: if the app reloaded for this reason a
 * moment ago and the file is still missing, the deploy itself is broken, and
 * reloading again would loop. Then the error screen shows instead.
 */

/** How recently a reload for a new version counts as "just tried". */
const RELOAD_GUARD_MS = 10_000;

const STORAGE_KEY = "staleDeployReloadAt";

/**
 * Set once a reload has started. Between that moment and the page actually
 * unloading, React can still trip over the import that failed (it receives no
 * module), and the error screen should say "updating", not "something went
 * wrong", and not report a stale tab to Sentry as a crash.
 */
let reloadPending = false;

/** Whether a reload for a new version is already under way. */
export function isReloadPending() {
  return reloadPending;
}

/**
 * Whether an error is a lazily loaded file that failed to load. Each browser
 * words it differently, so match all three.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isChunkLoadError(error) {
  const message = String(error?.message ?? error ?? "");
  return (
    /Failed to fetch dynamically imported module/i.test(message) || // Chrome, Edge
    /error loading dynamically imported module/i.test(message) || // Firefox
    /Importing a module script failed/i.test(message) // Safari
  );
}

/**
 * Reload the page to pick up the new version, unless that was just tried.
 *
 * @param {{ now?: number, storage?: Storage, reload?: () => void }} [deps] -
 *   injectable for tests; the defaults are the real clock, sessionStorage and
 *   location.reload.
 * @returns {boolean} true if a reload was started
 */
export function reloadForNewVersion({
  now = Date.now(),
  storage = typeof window !== "undefined" ? window.sessionStorage : undefined,
  reload = () => window.location.reload(),
} = {}) {
  try {
    const last = Number(storage?.getItem(STORAGE_KEY)) || 0;
    if (now - last < RELOAD_GUARD_MS) return false;
    storage.setItem(STORAGE_KEY, String(now));
  } catch {
    // No storage means no loop guard. Better to show the error screen, which
    // has its own reload button, than to risk reloading forever.
    return false;
  }
  reloadPending = true;
  reload();
  return true;
}
