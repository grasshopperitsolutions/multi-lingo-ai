/**
 * pulseReportService.js
 *
 * The browser's half of Admin › Pulse Phase 3: telling the server, as counts,
 * what it cannot see for itself — that a signed-in user was here today, which
 * feature pages they opened, which locked features they reached for, and how
 * long a live conversation lasted. Sent to `POST /api/auth` with
 * `action: "pulse"`, which checks every id against the feature registry and
 * adds to that day's counters; nothing identifying is stored with them.
 *
 * Covered by §3.4 of the privacy policy (first-party usage counts from our own
 * servers, aggregated), and deliberately modest:
 *
 * - **Fire and forget.** Nothing here throws or is awaited by a caller. A
 *   count lost to a network blip is a count lost, never a broken page.
 * - **Batched.** Events queue and go in one request a few seconds later, or
 *   straight away when the tab is hidden, so a burst of navigation is one
 *   request rather than ten.
 * - **Signed-in only.** A guest is an anonymous uid minted per browser and
 *   would count one visitor many times; the server refuses them too.
 */

import { auth } from "../firebase";

const PROXY_URL = import.meta.env.VITE_PROXY_URL || "https://multi-lingo-ai-api.vercel.app";

/** How long events wait for company before they are sent. */
export const FLUSH_DELAY_MS = 5000;
/** The server's own cap on one request. */
export const MAX_BATCH = 20;

let queue = [];
let timer = null;
let lastOpened = null;
let listening = false;

function signedInUser() {
  const user = auth?.currentUser;
  return user && !user.isAnonymous ? user : null;
}

async function send(events) {
  const user = signedInUser();
  if (!user || events.length === 0) return;
  try {
    const token = await user.getIdToken();
    await fetch(`${PROXY_URL}/api/auth`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pulse", events }),
      // Lets a request started as the tab closes still reach the server.
      keepalive: true,
    });
  } catch {
    // A lost count is not worth a console error for the person using the app.
  }
}

/** Send whatever is queued now. Exported for tests and for page hide. */
export function flushPulse() {
  clearTimeout(timer);
  timer = null;
  while (queue.length) {
    send(queue.splice(0, MAX_BATCH));
  }
}

function enqueue(event) {
  if (!signedInUser()) return;
  if (!listening && typeof document !== "undefined") {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPulse();
    });
  }
  queue.push(event);
  if (queue.length >= MAX_BATCH) {
    flushPulse();
  } else if (!timer) {
    timer = setTimeout(flushPulse, FLUSH_DELAY_MS);
  }
}

/**
 * The user is here. Sent once per page load; the server counts each person
 * once a day and once a week however often it arrives.
 */
export function reportActive() {
  enqueue({ type: "active" });
}

/**
 * A feature page was opened. Moving around inside one feature (a sub-route,
 * a reload of the same page) counts once, until another feature is opened.
 * @param {string|undefined} featureId - a feature registry id; ignored when absent
 */
export function reportFeatureOpen(featureId) {
  if (!featureId || featureId === lastOpened) return;
  lastOpened = featureId;
  enqueue({ type: "open", feature: featureId });
}

/**
 * Somebody reached for a feature their plan does not include — pressed a
 * locked tile, or was turned away from a locked page.
 * @param {string} featureId
 */
export function reportLockedAttempt(featureId) {
  if (featureId) enqueue({ type: "locked", feature: featureId });
}

/**
 * How long a live conversation lasted. The server cannot see it: the session
 * runs browser-to-Google once it has minted the token.
 * @param {number} seconds
 */
export function reportLiveSeconds(seconds) {
  const whole = Math.round(Number(seconds));
  if (Number.isFinite(whole) && whole > 0) enqueue({ type: "liveSeconds", seconds: whole });
}

/** Test seam: forget queued events and the last page. */
export function __resetPulseReports() {
  clearTimeout(timer);
  timer = null;
  queue = [];
  lastOpened = null;
}
