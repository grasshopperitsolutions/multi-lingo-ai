/**
 * dashboardFeatures.js
 *
 * The dashboard tile registry — one entry per feature card, carrying the parts
 * that cannot live in Firestore (icon component, route, colour) plus the section
 * it belongs to.
 *
 * `id` doubles as the feature key in appConfig/config/features, which is what
 * ties a tile to its tier grant, its `hidden` flag and its pricing row. Ids are
 * structural: renaming one silently revokes the feature everywhere it is
 * granted. See utils/featureAccess.js for the gating cascade.
 *
 * This is a module rather than an array inside DashboardHomePage because two
 * surfaces read it: the grouped sections, and the Today panel's favourites.
 *
 * Titles and descriptions are held as i18n keys, not resolved strings, so this
 * module stays free of React and translation state.
 */

import {
  Languages,
  BookMarked,
  PenLine,
  BotMessageSquare,
  UserRound,
  Video,
  BookOpen,
  Landmark,
  Briefcase,
  UtensilsCrossed,
  RadioTower,
  Plane,
  Gamepad2,
  GraduationCap,
} from "lucide-react";

import { DASHBOARD_GROUP_IDS, FALLBACK_GROUP_ID, isGroupId } from "./dashboardGroups";
import { isGrammarSupported } from "./grammarSupport";

/**
 * Every dashboard tile, in the order they appear within their section.
 *
 * `isUnavailable` marks a tile blocked for a reason paying cannot fix — the
 * user's learning language simply is not supported by that feature yet. It is
 * kept separate from tier gating on purpose: a language block outranks a tier
 * badge, because "upgrade" would be the wrong thing to tell that user.
 */
export const DASHBOARD_FEATURES = [
  // ── Practice ──────────────────────────────────────────────────────────────
  {
    id: "challenges",
    group: DASHBOARD_GROUP_IDS.PRACTICE,
    route: "/dashboard/challenges",
    icon: Gamepad2,
    color: "text-yellow-500",
    titleKey: "dashboard.challenges",
    descKey: "dashboard.challenges_desc",
  },
  {
    id: "exam_training",
    group: DASHBOARD_GROUP_IDS.PRACTICE,
    route: "/dashboard/exam-training",
    icon: GraduationCap,
    color: "text-teal-500",
    titleKey: "dashboard.exam_training",
    descKey: "dashboard.exam_training_desc",
    isUnavailable: ({ user, supportedLanguages }) =>
      !(supportedLanguages ?? []).some(
        (lang) => lang.code === user?.learningDialect && lang.examSupported,
      ),
    unavailableReasonKey: "dashboard.exam_not_available_for_language",
  },
  {
    id: "ai_tutor",
    group: DASHBOARD_GROUP_IDS.PRACTICE,
    route: "/dashboard/ai-tutor",
    icon: BotMessageSquare,
    color: "text-blue-500",
    titleKey: "dashboard.ai_tutor",
    descKey: "dashboard.ai_tutor_desc",
  },
  {
    id: "voice_practice",
    group: DASHBOARD_GROUP_IDS.PRACTICE,
    route: "/dashboard/voice-practice",
    icon: Video,
    color: "text-purple-500",
    titleKey: "dashboard.voice_practice",
    descKey: "dashboard.voice_practice_desc",
  },
  {
    id: "real_person_tutor",
    group: DASHBOARD_GROUP_IDS.PRACTICE,
    route: "/dashboard/real-person-tutor",
    icon: UserRound,
    color: "text-emerald-500",
    titleKey: "dashboard.real_person_tutor",
    descKey: "dashboard.real_person_tutor_desc",
  },

  // ── Look It Up ────────────────────────────────────────────────────────────
  {
    id: "translator",
    group: DASHBOARD_GROUP_IDS.LOOK_IT_UP,
    route: "/dashboard/translator",
    icon: Languages,
    color: "text-sky-500",
    titleKey: "dashboard.translator",
    descKey: "dashboard.translator_desc",
  },
  {
    id: "dictionary",
    group: DASHBOARD_GROUP_IDS.LOOK_IT_UP,
    route: "/dashboard/dictionary",
    icon: BookMarked,
    color: "text-violet-500",
    titleKey: "dashboard.dictionary",
    descKey: "dashboard.dictionary_desc",
  },
  {
    id: "grammar",
    group: DASHBOARD_GROUP_IDS.LOOK_IT_UP,
    route: "/dashboard/grammar",
    icon: PenLine,
    color: "text-amber-500",
    titleKey: "dashboard.grammar",
    descKey: "dashboard.grammar_desc",
    // Grammar ships with hand-written pt-PT material only — see
    // src/config/grammarSupport.js for why it is not offered per-language yet.
    isUnavailable: ({ user }) => !isGrammarSupported(user?.learningDialect),
    unavailableReasonKey: "grammar.not_available_for_language",
  },

  // ── Read, Watch & Listen ──────────────────────────────────────────────────
  {
    id: "story_generator",
    group: DASHBOARD_GROUP_IDS.WATCH_LISTEN,
    route: "/dashboard/story-generator",
    icon: BookOpen,
    color: "text-rose-500",
    titleKey: "dashboard.story_generator",
    descKey: "dashboard.story_generator_desc",
  },
  {
    id: "radio_tv",
    group: DASHBOARD_GROUP_IDS.WATCH_LISTEN,
    route: "/dashboard/radio-tv",
    icon: RadioTower,
    color: "text-cyan-500",
    titleKey: "dashboard.radio_tv",
    descKey: "dashboard.radio_tv_desc",
  },
  {
    id: "history_culture",
    group: DASHBOARD_GROUP_IDS.WATCH_LISTEN,
    route: "/dashboard/history-culture",
    icon: Landmark,
    color: "text-orange-500",
    titleKey: "dashboard.history_culture",
    descKey: "dashboard.history_culture_desc",
  },
  {
    id: "food",
    group: DASHBOARD_GROUP_IDS.WATCH_LISTEN,
    route: "/dashboard/food",
    icon: UtensilsCrossed,
    color: "text-lime-500",
    titleKey: "dashboard.food",
    descKey: "dashboard.food_desc",
  },

  // ── Get It Done ───────────────────────────────────────────────────────────
  {
    id: "plan_trip",
    group: DASHBOARD_GROUP_IDS.GET_IT_DONE,
    route: "/dashboard/plan-trip",
    icon: Plane,
    color: "text-pink-500",
    titleKey: "dashboard.plan_trip",
    descKey: "dashboard.plan_trip_desc",
  },
  {
    id: "professional_tools",
    group: DASHBOARD_GROUP_IDS.GET_IT_DONE,
    route: "/dashboard/professional-tools",
    icon: Briefcase,
    color: "text-indigo-500",
    titleKey: "dashboard.professional_tools",
    descKey: "dashboard.professional_tools_desc",
  },
];

/** id → tile, for the Today panel resolving stored favourite ids. */
const FEATURES_BY_ID = new Map(DASHBOARD_FEATURES.map((feature) => [feature.id, feature]));

/**
 * One tile by feature key, or undefined.
 *
 * @param {string} id
 * @returns {object|undefined}
 */
export function featureById(id) {
  return FEATURES_BY_ID.get(id);
}

/**
 * The tiles belonging to one group, in registry order.
 *
 * A tile whose `group` matches no group falls into FALLBACK_GROUP_ID rather than
 * disappearing, so forgetting the field is a visible mistake, not a silent one.
 *
 * @param {string} groupId
 * @returns {object[]}
 */
export function featuresInGroup(groupId) {
  return DASHBOARD_FEATURES.filter((feature) => {
    const group = isGroupId(feature.group) ? feature.group : FALLBACK_GROUP_ID;
    return group === groupId;
  });
}

/**
 * Onboarding interest → the features worth putting in front of that user.
 *
 * Only used for the Today panel's empty state, i.e. before somebody has
 * favourited anything. Keys are category ids from appConfig (see the
 * `categories` collection); an interest with no entry here simply contributes
 * nothing rather than erroring.
 */
export const INTEREST_FEATURE_HINTS = {
  food: ["food"],
  travel: ["plan_trip", "history_culture"],
  tech: ["professional_tools"],
  sports: ["challenges"],
  nature: ["history_culture"],
  general: ["story_generator"],
};

/**
 * What Today shows to somebody with no favourites and no useful interests.
 * Challenges leads, matching the gamified direction and the section order.
 */
export const DEFAULT_TODAY_FEATURE_IDS = ["challenges", "translator", "story_generator"];

/**
 * How many *suggestions* the Today panel offers before a user has pinned
 * anything. Favourites themselves are deliberately uncapped — the strip scrolls
 * instead — so this only ever limits the interest-based fallback.
 */
export const TODAY_SUGGESTION_LIMIT = 3;

/**
 * Suggested feature ids for a user who has not favourited anything yet: their
 * interests first, topped up from the defaults so the panel is never empty.
 *
 * @param {string[]} interests - user.interests from onboarding
 * @returns {string[]} ids, deduped, capped at TODAY_SUGGESTION_LIMIT
 */
export function suggestedFeatureIds(interests = []) {
  const fromInterests = (interests ?? []).flatMap(
    (interest) => INTEREST_FEATURE_HINTS[interest] ?? [],
  );
  return [...new Set([...fromInterests, ...DEFAULT_TODAY_FEATURE_IDS])].slice(
    0,
    TODAY_SUGGESTION_LIMIT,
  );
}
