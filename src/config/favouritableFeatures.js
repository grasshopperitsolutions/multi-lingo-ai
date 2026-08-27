/**
 * favouritableFeatures.js
 *
 * Every destination a user can pin with the heart, and the single place that
 * resolves a stored favourite id back into something renderable.
 *
 * Why the menus' registries live here
 * -----------------------------------
 * Favourites are no longer only the fourteen dashboard tiles — a user can pin
 * the Challenges hub *or* Hangman inside it. Today therefore has to turn an id
 * like `hangman` or `grammar_tips` into an icon, a title and a route, which
 * means that data cannot stay private to the menu that happens to render it.
 * The menus import their registry from here rather than each keeping a copy,
 * so there is still exactly one definition of what a game or a section is.
 *
 * Ids
 * ---
 * A favourite id is the feature's **gate key** — the same string
 * `useTierAccess().featureStatus()` takes. Those were already unique across
 * tiles (`challenges`), games (`hangman`), exam exercises (`exam_reading`) and
 * grammar sections (`grammar_tips`), so nothing needed renaming and previously
 * stored favourites keep resolving.
 */

import {
  BrainCircuit,
  Swords,
  NotebookPen,
  Search,
  EggFried,
  Link2,
  Footprints,
  Headphones,
  BookOpen,
  PenLine,
  ClipboardList,
  Library,
  Lightbulb,
  MessageCircleQuestion,
  Dumbbell,
} from "lucide-react";

import { DASHBOARD_FEATURES } from "./dashboardFeatures";

/** Challenge games. `id` doubles as the gate key. */
export const CHALLENGE_GAMES = [
  {
    id: "hangman",
    route: "/dashboard/challenges/hangman",
    icon: Swords,
    color: "bg-rose-400",
    titleKey: "challenges.hangman",
    descKey: "challenges.hangman_desc",
  },
  {
    id: "scrambled_word",
    route: "/dashboard/challenges/scrambled-word",
    icon: EggFried,
    color: "bg-yellow-400",
    titleKey: "challenges.scrambled_word",
    descKey: "challenges.scrambled_word_desc",
  },
  {
    id: "word_search",
    route: "/dashboard/challenges/word-search",
    icon: Search,
    color: "bg-purple-400",
    titleKey: "challenges.word_search",
    descKey: "challenges.word_search_desc",
  },
  {
    id: "word_link",
    route: "/dashboard/challenges/word-link",
    icon: Link2,
    color: "bg-indigo-400",
    titleKey: "challenges.word_link",
    descKey: "challenges.word_link_desc",
  },
  {
    id: "word_ladder",
    route: "/dashboard/challenges/word-ladder",
    icon: Footprints,
    color: "bg-orange-400",
    titleKey: "challenges.word_ladder",
    descKey: "challenges.word_ladder_desc",
  },
  {
    id: "word_quiz",
    route: "/dashboard/challenges/word-quiz",
    icon: NotebookPen,
    color: "bg-emerald-400",
    titleKey: "challenges.word_quiz",
    descKey: "challenges.word_quiz_desc",
  },
  {
    id: "crosswords",
    route: "/dashboard/challenges/crosswords",
    icon: BrainCircuit,
    color: "bg-blue-400",
    titleKey: "challenges.crosswords",
    descKey: "challenges.crosswords_desc",
  },
];

/**
 * Exam training exercises.
 *
 * These keep `id` and `featureKey` apart, because the route segment is
 * `reading` while the gate key is `exam_reading`. The favourite id is the
 * featureKey — `reading` alone would be far too generic to be unique.
 */
export const EXAM_EXERCISES = [
  {
    id: "reading",
    featureKey: "exam_reading",
    route: "/dashboard/exam-training/reading",
    icon: BookOpen,
    color: "bg-emerald-500",
    titleKey: "exam.reading",
    descKey: "exam.reading_desc",
  },
  {
    id: "listening",
    featureKey: "exam_listening",
    route: "/dashboard/exam-training/listening",
    icon: Headphones,
    color: "bg-sky-500",
    titleKey: "exam.listening",
    descKey: "exam.listening_desc",
  },
  {
    id: "writing",
    featureKey: "exam_writing",
    route: "/dashboard/exam-training/writing",
    icon: PenLine,
    color: "bg-teal-500",
    titleKey: "exam.writing",
    descKey: "exam.writing_desc",
  },
  {
    id: "full_exam",
    featureKey: "full_exam",
    route: "/dashboard/exam-training/full-exam",
    icon: ClipboardList,
    color: "bg-rose-400",
    titleKey: "exam.full_exam",
    descKey: "exam.full_exam_desc",
  },
];

/** Grammar sections. Gate keys are `grammar_${id}`. */
export const GRAMMAR_SECTIONS = [
  {
    id: "structures",
    route: "/dashboard/grammar/structures",
    icon: Library,
    color: "bg-amber-400",
    titleKey: "grammar.structures",
    descKey: "grammar.structures_desc",
  },
  {
    id: "tips",
    route: "/dashboard/grammar/tips",
    icon: Lightbulb,
    color: "bg-yellow-400",
    titleKey: "grammar.tips",
    descKey: "grammar.tips_desc",
  },
  {
    id: "ask",
    route: "/dashboard/grammar/ask",
    icon: MessageCircleQuestion,
    color: "bg-sky-400",
    titleKey: "grammar.ask",
    descKey: "grammar.ask_desc",
  },
  {
    id: "practice",
    route: "/dashboard/grammar/practice",
    icon: Dumbbell,
    color: "bg-emerald-400",
    titleKey: "grammar.practice",
    descKey: "grammar.practice_desc",
  },
];

/**
 * favourite id → { id, titleKey, descKey, route, icon }.
 *
 * Built once at module load from all four registries. Tiles carry a `color`
 * like `text-sky-500` while the sub-registries use `bg-sky-400` backgrounds, so
 * the icon colour is normalised to a text-* class here — Today renders them all
 * the same way and should not have to know where an entry came from.
 */
const REGISTRY = new Map();

DASHBOARD_FEATURES.forEach((feature) => {
  REGISTRY.set(feature.id, {
    id: feature.id,
    titleKey: feature.titleKey,
    descKey: feature.descKey,
    route: feature.route,
    icon: feature.icon,
    iconClass: feature.color,
  });
});

const addAll = (entries, keyFor) =>
  entries.forEach((entry) => {
    const id = keyFor(entry);
    REGISTRY.set(id, {
      id,
      titleKey: entry.titleKey,
      descKey: entry.descKey,
      route: entry.route,
      icon: entry.icon,
      // bg-rose-400 → text-rose-400: the shared square draws the icon in the
      // feature's colour rather than filling a tile with it.
      iconClass: entry.color.replace(/^bg-/, "text-"),
    });
  });

addAll(CHALLENGE_GAMES, (game) => game.id);
addAll(EXAM_EXERCISES, (exercise) => exercise.featureKey);
addAll(GRAMMAR_SECTIONS, (section) => `grammar_${section.id}`);

/** route → favourite id, so a page can find itself without being told. */
const BY_ROUTE = new Map([...REGISTRY.values()].map((entry) => [entry.route, entry.id]));

/**
 * The favourite id for a route, or undefined if that route isn't favouritable.
 *
 * Lets the shared page shell render the heart for every game, exercise and
 * section without each of the ~20 pages having to declare its own id — and
 * without that declaration being able to drift away from the route table.
 *
 * @param {string} pathname
 * @returns {string|undefined}
 */
export function favouriteIdForRoute(pathname) {
  if (!pathname) return undefined;
  // Tolerate a trailing slash; router paths here never have one.
  return BY_ROUTE.get(pathname.replace(/\/+$/, "")) ?? BY_ROUTE.get(pathname);
}

/**
 * Resolve a stored favourite id.
 *
 * Returns undefined for an id that no longer exists — a feature can be removed
 * long after somebody pinned it, and callers must drop those rather than
 * render a hole.
 *
 * @param {string} id
 * @returns {{id: string, titleKey: string, descKey: string, route: string, icon: Function, iconClass: string}|undefined}
 */
export function favouritableById(id) {
  return REGISTRY.get(id);
}

/** Every favouritable id, for tests and sanity checks. */
export function allFavouritableIds() {
  return [...REGISTRY.keys()];
}
