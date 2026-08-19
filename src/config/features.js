/**
 * features.js
 *
 * Registry of every gateable feature in the app.
 *
 * This file is the source of truth for which feature KEYS exist. Which tiers
 * may access them lives in Firestore (appConfig/config/tiersConfig) and is
 * edited from the Admin page — see tiersConfigService.js.
 *
 * Access is an allowlist: a feature is denied unless the tier's `features`
 * array names it. That is deliberate, so adding a new key here leaves it locked
 * for everyone until it is granted — which is what makes it safe to ship a
 * half-finished feature and beta-test it on the VIP tier first. Admin bypasses
 * the list entirely (see useTierAccess).
 *
 * To add a gateable feature: add an entry here, then grant it to the tiers that
 * should see it on the Admin page.
 */

/** Groups are display-only — they organise the Admin page checkboxes. */
export const FEATURE_GROUPS = [
  { id: 'core', label: 'Core Tools' },
  { id: 'exam', label: 'Exam Training' },
  { id: 'games', label: 'Challenges' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'content', label: 'Content' },
  { id: 'upcoming', label: 'Not Yet Released' },
];

export const FEATURES = [
  // ── Core ────────────────────────────────────────────────────────────────
  { key: 'translator',         group: 'core',    label: 'Translator' },
  { key: 'dictionary',         group: 'core',    label: 'Dictionary' },

  // ── Exam training ───────────────────────────────────────────────────────
  { key: 'exam_training',      group: 'exam',    label: 'Exam Training (section)' },
  { key: 'exam_listening',     group: 'exam',    label: 'Listening' },
  { key: 'exam_reading',       group: 'exam',    label: 'Reading' },
  { key: 'exam_writing',       group: 'exam',    label: 'Writing' },
  { key: 'full_exam',          group: 'exam',    label: 'Full Exam' },

  // ── Challenges ──────────────────────────────────────────────────────────
  { key: 'challenges',         group: 'games',   label: 'Challenges (section)' },
  { key: 'hangman',            group: 'games',   label: 'Hangman' },
  { key: 'scrambled_word',     group: 'games',   label: 'Scrambled Word' },
  { key: 'word_search',        group: 'games',   label: 'Word Search' },
  { key: 'word_link',          group: 'games',   label: 'Word Link' },
  { key: 'word_ladder',        group: 'games',   label: 'Word Ladder' },

  // ── Grammar ─────────────────────────────────────────────────────────────
  { key: 'grammar',            group: 'grammar', label: 'Grammar (section)' },
  { key: 'grammar_structures', group: 'grammar', label: 'Structures' },
  { key: 'grammar_tips',       group: 'grammar', label: 'Tips' },
  { key: 'grammar_ask',        group: 'grammar', label: 'Ask a Question' },

  // ── Content ─────────────────────────────────────────────────────────────
  { key: 'story_generator',    group: 'content', label: 'Story Generator' },
  { key: 'history_culture',    group: 'content', label: 'History & Culture' },
  { key: 'custom_requests',    group: 'content', label: 'Custom AI Requests' },

  // ── Not yet released ────────────────────────────────────────────────────
  // Listed so they can be switched on for VIP/Admin only while in testing.
  { key: 'ai_tutor',           group: 'upcoming', label: 'AI Tutor' },
  { key: 'real_person_tutor',  group: 'upcoming', label: 'Real Person Tutor' },
  { key: 'voice_practice',     group: 'upcoming', label: 'Voice Practice' },
  { key: 'professional_tools', group: 'upcoming', label: 'Professional Tools' },
  { key: 'food',               group: 'upcoming', label: 'Food' },
  { key: 'radio_tv',           group: 'upcoming', label: 'Radio & TV' },
  { key: 'plan_trip',          group: 'upcoming', label: 'Plan a Trip' },
  { key: 'word_quiz',          group: 'upcoming', label: 'Word Quiz' },
  { key: 'crosswords',         group: 'upcoming', label: 'Crosswords' },
  { key: 'grammar_practice',   group: 'upcoming', label: 'Grammar Practice' },
];

export const FEATURE_KEYS = FEATURES.map((f) => f.key);

/**
 * Everything currently released. Backs the "Released only" shortcut in the
 * Admin tier editor — a quick way to revoke every in-testing feature at once.
 */
export const RELEASED_FEATURE_KEYS = FEATURES
  .filter((f) => f.group !== 'upcoming')
  .map((f) => f.key);

export const FEATURES_BY_GROUP = FEATURE_GROUPS.map((group) => ({
  ...group,
  features: FEATURES.filter((f) => f.group === group.id),
}));

/**
 * @param {string} key
 * @returns {{key: string, group: string, label: string}|undefined}
 */
export function getFeature(key) {
  return FEATURES.find((f) => f.key === key);
}
