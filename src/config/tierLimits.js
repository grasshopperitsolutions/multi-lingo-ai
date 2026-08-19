/**
 * Bootstrap tier values.
 *
 * Tier limits and feature access live in Firestore
 * (appConfig/config/tiersConfig) and are edited on the Admin page — see
 * tiersConfigService.js. That config is required: if it can't be fetched the
 * app routes to /app-unavailable, the same as a failed translation load, rather
 * than guessing at limits it can't verify.
 *
 * This object exists only for the brief first render before that fetch
 * resolves. `useTierAccess` exposes `isReady` so callers can hold rather than
 * act on it — nothing here should be treated as a real grant. It deliberately
 * grants no features, and reports an unlimited allowance so the header doesn't
 * flash "no calls remaining" at a user who has plenty.
 */
export const BOOTSTRAP_TIER = Object.freeze({
  id: 'explorer',
  label: 'Explorer',
  order: 0,
  isFree: true,
  hidden: false,
  aiCallsPerDay: Infinity,
  features: Object.freeze([]),
});
