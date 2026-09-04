import * as Sentry from "@sentry/react";

/**
 * Browser error reporting.
 *
 * Scoped tightly on purpose, because the privacy policy is specific about
 * what this app may do:
 *
 * - No Session Replay. It records the DOM and writes to sessionStorage,
 *   which is exactly the "tecnologia de rastreio" section 2.7 promises we
 *   don't use — and it would capture whatever a user typed into a
 *   translation box on the way.
 * - No tracing and no session tracking. Section 3.4 rules out third-party
 *   audience analytics; performance sampling is the thin end of it.
 * - sendDefaultPii: false, so Sentry never infers or stores an IP address.
 *
 * What is left is the one thing section 3.4 explicitly allows: finding and
 * fixing faults. Sentry is named in the section 4 subprocessor list for
 * that purpose.
 *
 * Inert without VITE_SENTRY_DSN, so local development and any build without
 * the secret report nothing.
 */

/**
 * Failures that are noise in every web app: a browser quirk with no user
 * impact, a request the user cancelled by navigating away, and the errors
 * injected by browser extensions into pages they don't own.
 */
const IGNORED = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Non-Error promise rejection captured",
  "AbortError",
  "Failed to fetch",
  "NetworkError when attempting to fetch resource",
  "Load failed",
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
];

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    ignoreErrors: IGNORED,
    // Only report what this app actually ships. Without this, an error
    // thrown by a browser extension running on the page arrives as ours.
    allowUrls: [window.location.origin],
    integrations: (defaults) =>
      defaults
        // BrowserSession sends a session event on load and again on every
        // route change — per-page-view telemetry, which is the thing
        // section 2.7 of the privacy policy says we don't do. Note the
        // `autoSessionTracking: false` option no longer exists in v10;
        // removing the integration is now the only way to turn this off.
        .filter((integration) => integration.name !== "BrowserSession")
        // Keep the breadcrumb trail — clicks, navigation, fetch calls are
        // what make a report reproducible — but not console output. This
        // app logs verbosely and that output has never been audited for
        // user content; it isn't worth the risk of shipping a phrase
        // somebody was translating into a third-party service.
        .map((integration) =>
          integration.name === "Breadcrumbs"
            ? Sentry.breadcrumbsIntegration({ console: false })
            : integration
        ),
  });
}

/**
 * Attaches the signed-in user to subsequent reports, so an issue can be
 * traced to the account that hit it — and to the same account in the
 * backend's issues, which mask the uid identically (lib/logger.ts, and
 * lib/sentry.ts on the API side).
 *
 * The first 8 characters of the uid only. Never the email or the display
 * name: enough to group an issue by who hit it, not enough to be a user
 * identifier in a third-party service that has no need for one.
 *
 * Pass null on sign-out.
 */
export function setSentryUser(uid) {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.setUser(uid ? { id: `${uid.slice(0, 8)}...` } : null);
}

export { Sentry };
