import { useCallback, useEffect, useRef } from "react";
import { useAppContext } from "../contexts/AppContext";
import { getGlobalSeenIds, markConceptsSeenGlobal } from "../services/userService";

/** Debounced like the album and the other autosaving hooks: four right answers are one write. */
const SAVE_DELAY_MS = 800;

/**
 * useSeenConcepts
 *
 * The same "seen concept" rule every other word game follows: a concept goes on
 * `users/{uid}.seenConceptIds` when the player **gets it right**, and the pool
 * stops serving it. A wrong answer does not mark it (the word is still unmet),
 * exactly as losing a Hangman round does not.
 *
 * - **`markSeen(conceptIds)`** records right answers. The write is debounced and
 *   sent as the whole list, merged with what is stored *at the moment of the
 *   write* (read again just before), so a word marked in another game while this
 *   one was open is not lost. It is flushed when the player leaves or the page
 *   is hidden.
 * - **`seenThisSession()`** is the set marked here, whether or not it has been
 *   written yet. The next round reads the stored list from the server, which may
 *   still be 800 ms behind, and a word the player has just got right must not be
 *   handed straight back.
 * - **A failed write is not shown.** The ids stay queued and go out with the next
 *   one; a banner for bookkeeping would be the wrong weight.
 *
 * @returns {{ markSeen: (conceptIds: string[]) => void, seenThisSession: () => Set<string> }}
 */
export function useSeenConcepts() {
  const { user } = useAppContext();
  const token = user?.token;
  const uid = user?.uid;

  const live = useRef({ token, uid, session: new Set(), pending: new Set(), timer: null });

  // Kept in step by an effect, never during render (see useAlbumStickers: the
  // order matters when the identity changes under a pending write).
  useEffect(() => {
    live.current.token = token;
    live.current.uid = uid;
  }, [token, uid]);

  const flush = useCallback(async () => {
    const current = live.current;
    if (current.timer) {
      clearTimeout(current.timer);
      current.timer = null;
    }
    if (current.pending.size === 0 || !current.token || !current.uid) return;

    const ids = [...current.pending];
    current.pending = new Set();
    try {
      const stored = await getGlobalSeenIds(current.token, current.uid);
      // Nothing to write when every one was already there (a word seen in
      // another game, or put back on the list after a failed write that had in
      // fact gone through).
      const known = new Set(stored);
      if (ids.every((id) => known.has(id))) return;
      await markConceptsSeenGlobal(current.token, current.uid, ids, stored);
    } catch (err) {
      ids.forEach((id) => current.pending.add(id));
      console.warn("[useSeenConcepts] save failed:", err.message);
    }
  }, []);

  const markSeen = useCallback(
    (conceptIds) => {
      const current = live.current;
      let added = false;
      for (const id of conceptIds ?? []) {
        if (!id || current.session.has(id)) continue;
        current.session.add(id);
        current.pending.add(id);
        added = true;
      }
      if (!added) return;
      if (current.timer) clearTimeout(current.timer);
      current.timer = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  const seenThisSession = useCallback(() => live.current.session, []);

  // Write what is waiting when the player leaves, or the page goes to the background.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { markSeen, seenThisSession };
}

export default useSeenConcepts;
