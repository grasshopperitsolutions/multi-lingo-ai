import { useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { resolvePracticeLevel } from "../config/examLevels";

/**
 * The level a feature's picker shows: the learner's default for their
 * practice language until they pick another one on this page.
 *
 * The default lives in Settings (`users/{uid}.practiceLevels`) and is changed
 * there, never from here. A pick inside a feature is for that visit only, so
 * trying a harder story does not quietly move the level every other feature
 * starts at.
 *
 * Derived rather than copied into state: `level` is the page's own pick when
 * there is one and the default otherwise. So a profile that arrives after the
 * page has mounted, or a default changed in another tab, still shows through
 * until the learner picks something themselves. Passing `null` to `setLevel`
 * goes back to following the default.
 *
 * @returns {{ level: string, setLevel: (level: string | null) => void, defaultLevel: string }}
 */
export function usePracticeLevel() {
  const { user } = useAppContext();
  const defaultLevel = resolvePracticeLevel(user?.practiceLevels, user?.learningDialect);
  const [chosen, setChosen] = useState(null);
  return { level: chosen ?? defaultLevel, setLevel: setChosen, defaultLevel };
}
