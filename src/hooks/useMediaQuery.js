import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * Extracted from useDashboardPresentation, which had it as a private helper,
 * once Settings needed the same "is this a phone?" answer to decide which
 * cards open by default. Same implementation, one copy.
 *
 * Guards on `window.matchMedia` rather than assuming it: the SSG build and the
 * jsdom test environment both run this module with no real browser behind it,
 * and returning false there is the right answer — a build step has no viewport.
 *
 * @param {string} query - e.g. "(max-width: 767px)"
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    // Re-read on mount: the initial state was computed before this effect ran,
    // and the viewport can change between the two.
    setMatches(list.matches);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Phone-sized viewport.
 *
 * Matches Tailwind's `md` breakpoint, so "collapsed on mobile" in JS and any
 * `md:` class in the markup agree about where the line is.
 */
export const MOBILE_QUERY = "(max-width: 767px)";

export default useMediaQuery;
