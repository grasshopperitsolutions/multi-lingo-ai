/**
 * dashboardBooks.js
 *
 * Look and geometry for the floating-book presentation of the dashboard tabs.
 *
 * Split out from dashboardGroups.js on purpose: the groups are the information
 * architecture and outlive any particular skin, while everything here is
 * presentation for one of the two presentations (see useDashboardPresentation).
 * Deleting this file should cost the tab bar nothing.
 *
 * Colours are drawn from palettes already in use on the tiles, so the shelf
 * reads as the same product rather than a separate theme.
 */

import { DASHBOARD_GROUP_IDS } from "./dashboardGroups";

/**
 * Per-group book skin.
 *
 * `cover`/`spine` are Tailwind background classes; `ink` is the text colour
 * that sits on them. `edge` is the hard offset shadow colour that gives the
 * closed book its neo-brutalist weight.
 */
export const BOOK_SKINS = {
  [DASHBOARD_GROUP_IDS.PRACTICE]: {
    cover: "bg-yellow-400",
    spine: "bg-yellow-500",
    ink: "text-slate-900",
    edge: "#a16207",
  },
  [DASHBOARD_GROUP_IDS.LOOK_IT_UP]: {
    cover: "bg-sky-400",
    spine: "bg-sky-500",
    ink: "text-slate-900",
    edge: "#0369a1",
  },
  [DASHBOARD_GROUP_IDS.WATCH_LISTEN]: {
    cover: "bg-rose-400",
    spine: "bg-rose-500",
    ink: "text-slate-900",
    edge: "#9f1239",
  },
  [DASHBOARD_GROUP_IDS.GET_IT_DONE]: {
    cover: "bg-indigo-400",
    spine: "bg-indigo-500",
    ink: "text-slate-900",
    edge: "#3730a3",
  },
};

/** Fallback skin, so a group added without one still renders a book. */
export const DEFAULT_BOOK_SKIN = {
  cover: "bg-slate-300",
  spine: "bg-slate-400",
  ink: "text-slate-900",
  edge: "#334155",
};

export function bookSkinFor(groupId) {
  return BOOK_SKINS[groupId] ?? DEFAULT_BOOK_SKIN;
}

/**
 * Shelf geometry — spine-forward.
 *
 * The books stand on an arc whose centre is the viewer, each placed with
 * `rotateY(angle) translateZ(-radius)`: the rotation puts it at a point on the
 * circle and simultaneously turns it back toward the middle, which is where the
 * camera is. That is what makes the arc wrap around the reader rather than
 * curve away from them.
 *
 * What faces the reader is the **spine**, the way it would on a real shelf when
 * you go to pick one out. The cover is hinged off the spine's right edge and
 * recedes into the shelf, so books toward the ends of the arc show a sliver of
 * it and the row reads as solid objects rather than flat cards.
 *
 * Spacing is a fixed angular STEP per book rather than a fixed total spread, so
 * adding a fifth or sixth group widens the arc instead of squeezing the gaps.
 * The gap between spines therefore stays constant however many books there are.
 */
export const SHELF = {
  /** Distance from the viewer to the arc, in px. */
  RADIUS: 520,
  /** Angle between adjacent books, in degrees. Constant — see above. */
  STEP: 13,
  /** The spine: what the reader actually sees and clicks. */
  SPINE_WIDTH: 74,
  HEIGHT: 300,
  /** How far the cover recedes into the shelf behind the spine. */
  COVER_DEPTH: 150,
};

/** Mobile shelf: closer camera, tighter arc, smaller books. */
export const SHELF_MOBILE = {
  RADIUS: 300,
  STEP: 14,
  SPINE_WIDTH: 52,
  HEIGHT: 210,
  COVER_DEPTH: 104,
};

/**
 * How far a book lifts and leans out when the pointer is on it — the "about to
 * pick this one" cue. Toward the reader and up, plus a small turn that opens
 * the cover edge into view.
 */
export const BOOK_HOVER = {
  Z: 54,
  LIFT: -20,
  TURN: 9,
};

/**
 * Animation timings, in seconds. Total flight + open stays inside the 2s
 * budget: 0.7 to fly, then 0.75 to swing the cover, overlapping slightly.
 *
 * Exported rather than inlined so they can be tuned in one place — the felt
 * weight of the book is almost entirely these five numbers.
 */
export const BOOK_TIMING = {
  FLY: 0.7,
  /** Cover swing starts before the flight fully settles, which reads as one
   *  continuous motion instead of two chained ones. */
  OPEN_DELAY: 0.45,
  OPEN: 0.75,
  CLOSE: 0.5,
  RETURN: 0.6,
  /** Mobile page flip, between the description page and the cards page. */
  PAGE_FLIP: 0.45,
};

/**
 * The angle a book sits at on the arc.
 *
 * Fixed step, centred on zero — so the gap between any two neighbouring spines
 * is identical no matter how many books there are, and a new group widens the
 * arc rather than crowding the existing ones.
 *
 * @param {number} index - position in the shelf
 * @param {number} total - how many books are on the shelf
 * @param {number} step - SHELF.STEP or the mobile equivalent, in degrees
 * @returns {number} degrees
 */
export function shelfAngle(index, total, step) {
  if (total <= 1) return 0;
  return (index - (total - 1) / 2) * step;
}
