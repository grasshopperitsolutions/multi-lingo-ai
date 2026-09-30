/**
 * dashboardGroups.js
 *
 * The dashboard's sections. The page renders the Today panel, then one section
 * of feature cards per group below it (DashboardHomePage); the tiles inside a
 * group come from DASHBOARD_FEATURES in ./dashboardFeatures.js, which carries
 * a `group` id matching one of these.
 *
 * Why this lives in code rather than in Firestore
 * -----------------------------------------------
 * Feature *gating* is configured in Admin (appConfig/config/features), but a
 * dashboard tile also needs an `icon` (a React component), a `route` and a
 * colour, none of which can be stored in a document. A genuinely new feature
 * therefore already needs a frontend change, so putting the grouping in
 * Firestore would buy nothing except a second source of truth per tile. If
 * re-grouping without a deploy ever becomes routine, add an optional `group`
 * field on the feature document and let it override the value here.
 *
 * Grouping axis: **what the learner wants from the next ten minutes** — to
 * play, to train the ear, to pick up words, to work hard, to get help, or to
 * get to know the country. Since 2026-09-30; it was grouped by kind of task
 * (practise, look up, read and watch, get things done) before that.
 */

import { Compass, Gamepad2, Ear, Sprout, Dumbbell, LifeBuoy, MapPinned } from "lucide-react";

/**
 * Stable group ids. The parked tab bar used them in its `?tab=` query param,
 * so treat them as structural; an old id in a saved link falls back to the
 * default through `isGroupId`.
 */
export const DASHBOARD_GROUP_IDS = {
  TODAY: "today",
  HAVE_FUN: "have_fun",
  TUNE_YOUR_EAR: "tune_your_ear",
  GROW_VOCABULARY: "grow_vocabulary",
  TOUGH_PRACTICE: "tough_practice",
  NEED_HELP: "need_help",
  KNOW_THE_COUNTRY: "know_the_country",
};

/**
 * The groups, in page order. Today is the panel at the top, not a section.
 *
 * Fun comes first after Today on purpose: the product is moving toward a
 * gamified feel, and the games are the strongest first thing to put in front
 * of somebody who has just signed up.
 *
 * `descriptionKey` is the one-line subtitle under each section heading. The
 * dormant book presentation shows the same string on a book's left page.
 */
export const DASHBOARD_GROUPS = [
  {
    id: DASHBOARD_GROUP_IDS.TODAY,
    icon: Compass,
    labelKey: "dashboard.groups.today",
    descriptionKey: "dashboard.groups.today_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.HAVE_FUN,
    icon: Gamepad2,
    labelKey: "dashboard.groups.have_fun",
    descriptionKey: "dashboard.groups.have_fun_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.TUNE_YOUR_EAR,
    icon: Ear,
    labelKey: "dashboard.groups.tune_your_ear",
    descriptionKey: "dashboard.groups.tune_your_ear_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.GROW_VOCABULARY,
    icon: Sprout,
    labelKey: "dashboard.groups.grow_vocabulary",
    descriptionKey: "dashboard.groups.grow_vocabulary_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.TOUGH_PRACTICE,
    icon: Dumbbell,
    labelKey: "dashboard.groups.tough_practice",
    descriptionKey: "dashboard.groups.tough_practice_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.NEED_HELP,
    icon: LifeBuoy,
    labelKey: "dashboard.groups.need_help",
    descriptionKey: "dashboard.groups.need_help_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.KNOW_THE_COUNTRY,
    icon: MapPinned,
    labelKey: "dashboard.groups.know_the_country",
    descriptionKey: "dashboard.groups.know_the_country_desc",
  },
];

/** The group the parked tab bar opened on when nothing was chosen. */
export const DEFAULT_GROUP_ID = DASHBOARD_GROUP_IDS.TODAY;

/**
 * Where a tile lands when its `group` matches no section.
 *
 * Deliberately the first section under Today rather than a quiet catch-all at
 * the bottom: a mis-configured tile should be noticed on the next visit, not
 * hide until somebody audits it.
 */
export const FALLBACK_GROUP_ID = DASHBOARD_GROUP_IDS.HAVE_FUN;

/** Whether a string is a real group id — guards the value read from the URL. */
export function isGroupId(value) {
  return DASHBOARD_GROUPS.some((group) => group.id === value);
}
