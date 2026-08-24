/**
 * dashboardGroups.js
 *
 * The dashboard tab bar. Each group is one tab; the tiles inside it come from
 * DASHBOARD_FEATURES in ./dashboardFeatures.js, which carries a `group` id
 * matching one of these.
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
 * Grouping axis: **what the user is about to do**, not what the feature is
 * made of. "Look It Up" and "Get It Done" describe an intent the user already
 * has when they open the app, which is what makes a tab guessable.
 */

import { Compass, Gamepad2, Search, Headphones, Briefcase } from "lucide-react";

/** Stable group ids. Used in the `?tab=` query param, so treat as structural. */
export const DASHBOARD_GROUP_IDS = {
  TODAY: "today",
  PRACTICE: "practice",
  LOOK_IT_UP: "look_it_up",
  WATCH_LISTEN: "watch_listen",
  GET_IT_DONE: "get_it_done",
};

/**
 * The tabs, in bar order.
 *
 * Practice sits directly after Today on purpose: the product is moving toward
 * a gamified feel, and the games are the strongest first thing to put in front
 * of somebody who has just signed up.
 *
 * `descriptionKey` is not rendered by the flat tab bar. It exists because the
 * planned 3D book presentation shows a per-tab description on the left page,
 * and writing that copy alongside the label is cheaper than retrofitting it.
 */
export const DASHBOARD_GROUPS = [
  {
    id: DASHBOARD_GROUP_IDS.TODAY,
    icon: Compass,
    labelKey: "dashboard.tabs.today",
    descriptionKey: "dashboard.tabs.today_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.PRACTICE,
    icon: Gamepad2,
    labelKey: "dashboard.tabs.practice",
    descriptionKey: "dashboard.tabs.practice_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.LOOK_IT_UP,
    icon: Search,
    labelKey: "dashboard.tabs.look_it_up",
    descriptionKey: "dashboard.tabs.look_it_up_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.WATCH_LISTEN,
    icon: Headphones,
    labelKey: "dashboard.tabs.watch_listen",
    descriptionKey: "dashboard.tabs.watch_listen_desc",
  },
  {
    id: DASHBOARD_GROUP_IDS.GET_IT_DONE,
    icon: Briefcase,
    labelKey: "dashboard.tabs.get_it_done",
    descriptionKey: "dashboard.tabs.get_it_done_desc",
  },
];

/** The tab shown when no `?tab=` is present and nothing was restored. */
export const DEFAULT_GROUP_ID = DASHBOARD_GROUP_IDS.TODAY;

/**
 * Where a tile lands when its `group` matches no tab.
 *
 * Deliberately the busiest tab rather than a quiet catch-all: a mis-configured
 * tile should be noticed on the next visit, not hide until somebody audits it.
 */
export const FALLBACK_GROUP_ID = DASHBOARD_GROUP_IDS.PRACTICE;

/** Whether a string is a real group id — guards the value read from the URL. */
export function isGroupId(value) {
  return DASHBOARD_GROUPS.some((group) => group.id === value);
}
