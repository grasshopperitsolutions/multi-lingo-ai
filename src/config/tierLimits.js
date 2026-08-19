/**
 * Tier limits — FALLBACK DEFAULTS ONLY.
 *
 * The live values come from Firestore (appConfig/config/tiersConfig) and are
 * edited on the Admin page; see tiersConfigService.js. This file is what the
 * app falls back to before that config loads, or if a tier has no document yet,
 * so nothing breaks on a cold start or an unseeded environment.
 *
 * These numbers are display/UX only — the backend enforces the real allowance,
 * so raising a limit here alone grants nobody extra calls. Keep the two in step.
 *
 * `aiCallsPerDay: Infinity` means unlimited. Firestore cannot store Infinity,
 * so it is persisted as `null` and converted at the boundary.
 */

import { FEATURE_KEYS } from './features';

/**
 * These defaults reproduce the app's behaviour before tiersConfig existed:
 * every tier sees everything (including the "Coming Soon" placeholder tiles,
 * which are deliberate marketing), except that Explorer has no Full Exam and no
 * open-ended AI requests — the two paid hooks that were already gated in code.
 *
 * Restricting a feature is meant to be an Admin-page decision, not a change
 * here. Note that once the subcollection is seeded, a feature key added to
 * features.js later is absent from every stored document and is therefore
 * denied automatically — which is what makes VIP-only beta testing work without
 * touching this file.
 */
const EXPLORER_LOCKED = ['full_exam', 'custom_requests'];

export const TIER_LIMITS = {
  explorer: {
    aiCallsPerDay: 3,
    label: 'Explorer',
    isFree: true,
    hidden: false,
    order: 1,
    features: FEATURE_KEYS.filter((k) => !EXPLORER_LOCKED.includes(k)),
  },
  voyager: {
    aiCallsPerDay: 20,
    label: 'Voyager',
    isFree: false,
    hidden: false,
    order: 2,
    features: FEATURE_KEYS,
  },
  maestro: {
    aiCallsPerDay: Infinity,
    label: 'Maestro',
    isFree: false,
    hidden: false,
    order: 3,
    features: FEATURE_KEYS,
  },
  // ── Hidden tier: VIP — "free Maestro", and the beta channel ──────────
  // Unlimited AI and no subscription checks, assigned manually. Granted every
  // feature including unreleased ones, so new work can be tested here before
  // it is opened to paying tiers.
  vip: {
    aiCallsPerDay: Infinity,
    label: 'VIP',
    isFree: true,
    hidden: true,
    order: 4,
    features: FEATURE_KEYS,
  },
  // ── Hidden tier: Admin ───────────────────────────────────────────────
  // Bypasses feature gating entirely in useTierAccess — the list below is
  // only what the Admin page displays.
  admin: {
    aiCallsPerDay: Infinity,
    label: 'Admin',
    isFree: true,
    hidden: true,
    order: 5,
    features: FEATURE_KEYS,
  },
};

export const TIER_IDS = Object.keys(TIER_LIMITS);
