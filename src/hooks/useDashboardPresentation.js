import { useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";

/** The two ways the dashboard can present its groups. */
export const PRESENTATION = {
  BOOKS: "books",
  TABS: "tabs",
};

/** Below this width a two-page spread has nowhere to go, so the book shows one
 *  page at a time and the shelf falls back to the tab bar by default. */
const NARROW_QUERY = "(max-width: 1023px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Subscribe to a media query.
 *
 * @param {string} query
 * @returns {boolean}
 */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    setMatches(list.matches);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * useDashboardPresentation
 *
 * Decides whether the dashboard shows the floating book shelf or the flat tab
 * bar, and whether the opened book has room for a two-page spread.
 *
 * Resolution order, most specific first:
 *   1. An explicit choice in Settings always wins — including choosing books on
 *      a reduced-motion machine, because that is an informed opt-in rather than
 *      a default being imposed on somebody.
 *   2. prefers-reduced-motion falls back to tabs.
 *   3. Otherwise: books, on every screen size.
 *
 * Narrow viewports get the shelf too — they just read one book page at a time
 * instead of a two-page spread, which is what `isNarrow` is still for. Tabs
 * remain available to anyone who picks them in Settings.
 *
 * @returns {{
 *   presentation: string,
 *   isNarrow: boolean,
 *   prefersReducedMotion: boolean,
 *   isExplicit: boolean,
 * }}
 */
export function useDashboardPresentation() {
  const { user } = useAppContext();
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);

  const stored = user?.dashboardPresentation;
  const isExplicit = stored === PRESENTATION.BOOKS || stored === PRESENTATION.TABS;

  let presentation;
  if (isExplicit) {
    presentation = stored;
  } else if (prefersReducedMotion) {
    presentation = PRESENTATION.TABS;
  } else {
    presentation = PRESENTATION.BOOKS;
  }

  return { presentation, isNarrow, prefersReducedMotion, isExplicit };
}
