import { useMemo } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useTierAccess } from "./useTierAccess";

/**
 * useInterestTopics
 *
 * Resolves the user's saved interests into `{ slug, label }` pairs for the
 * content services, and decides which tiers may use them to reorder a cached
 * pool.
 *
 * Two lists come back because the two uses have different costs:
 *
 *   topics       — themes content the AI is about to generate anyway. That
 *                  generation call is already happening, so theming it is
 *                  free. Every tier gets it.
 *
 *   preferTopics — reorders the *cached* pool so interest-matching entries are
 *                  walked first. Not free in practice: only entries created
 *                  since interests existed carry a `topics` tag, and those are
 *                  the newest ones, which are the least likely to already have
 *                  a translation cached for the user's dialect. Surfacing them
 *                  first therefore lands on the generate-a-translation path
 *                  more often. On Explorer's 3 AI calls a day that is the
 *                  difference between playing and hitting the quota wall, so
 *                  Explorer keeps plain pool order and maximum cache hits.
 *
 * @returns {{
 *   topics: Array<{slug: string, label: string}>,
 *   preferTopics: Array<{slug: string, label: string}>,
 * }}
 */
/**
 * Shared empty result. Callers put these arrays in useCallback/useEffect
 * dependency arrays, so returning a fresh `[]` on each render would change
 * their identity every render and re-fire the fetch effects that depend on
 * them — an endless refetch loop. One frozen instance keeps the reference
 * stable.
 */
const NO_TOPICS = Object.freeze([]);

export const useInterestTopics = () => {
  const { user, categories } = useAppContext();
  const { isExplorer } = useTierAccess();

  const interests = user?.interests;

  const topics = useMemo(() => {
    if (!Array.isArray(interests) || interests.length === 0) return NO_TOPICS;

    const labelBySlug = new Map(
      (Array.isArray(categories) ? categories : []).map((c) => [c.id, c.label])
    );

    const resolved = interests
      .filter(Boolean)
      // A category deleted from appConfig can still be referenced by a
      // profile. Fall back to the slug rather than dropping the interest —
      // a stale slug is still a usable theme, and silently losing one of a
      // user's two interests would be worse.
      .map((slug) => ({ slug, label: String(labelBySlug.get(slug) || slug).trim() }))
      .filter((t) => t.label);

    return resolved.length > 0 ? resolved : NO_TOPICS;
  }, [interests, categories]);

  return useMemo(
    () => ({ topics, preferTopics: isExplorer ? NO_TOPICS : topics }),
    [topics, isExplorer]
  );
};

export default useInterestTopics;
