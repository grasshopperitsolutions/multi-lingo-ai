import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { getAlbumStickers, saveAlbumStickers } from "../services/userService";
import { play } from "../services/soundService";

/**
 * Sticker writes are debounced, not sent one per answer: the games are a
 * tapping interaction, and four right answers in a row must be one write.
 * Same shape as usePersonalSettings, for the same reason.
 */
const SAVE_DELAY_MS = 800;

/**
 * useAlbumStickers
 *
 * A Caderneta: the concepts this player has collected, for their practice
 * language. Every word answered right in a picture game sticks its picture.
 *
 * - **`collect(conceptIds)`** adds stickers and returns the ones that were
 *   *new*, so a game can say "new sticker!" and play the sound only for those.
 *   It is safe to call before the album has loaded: what is collected waits and
 *   is merged when the saved list arrives, so an early answer is never lost.
 * - **Saved by the whole list**, debounced, and flushed when the page is left
 *   or hidden. Nothing leaves the device but concept ids.
 * - **A failed save is not shown.** The sticker is on screen and will be written
 *   with the next one; a banner for a decoration would be the wrong weight.
 *
 * @returns {{ stickers: Set<string>|null, isLoaded: boolean, collect: (conceptIds: string[]) => string[] }}
 */
export function useAlbumStickers() {
  const { user } = useAppContext();
  const token = user?.token;
  const uid = user?.uid;
  const dialect = user?.learningDialect ?? "pt-PT";

  const [stickers, setStickers] = useState(null);

  // Everything the save needs, in one ref, so flushing on unmount sees the
  // latest values rather than the ones from the render that scheduled it.
  const live = useRef({ token, uid, dialect, set: null, pending: new Set(), dirty: false, timer: null });

  // Kept in step by an effect, not during render, and the order matters: when
  // the practice language changes, the previous load effect's cleanup runs
  // *before* this does, so it still flushes the old album under the old
  // language. Assigned during render, the cleanup would see the new language
  // and write one language's stickers into another's album.
  useEffect(() => {
    live.current.token = token;
    live.current.uid = uid;
    live.current.dialect = dialect;
  }, [token, uid, dialect]);

  const flush = useCallback(async () => {
    const current = live.current;
    if (current.timer) {
      clearTimeout(current.timer);
      current.timer = null;
    }
    if (!current.dirty || !current.set || !current.token || !current.uid) return;
    current.dirty = false;
    try {
      await saveAlbumStickers(current.token, current.uid, current.dialect, [...current.set]);
    } catch (err) {
      // Left dirty: the next sticker writes the whole list again.
      current.dirty = true;
      console.warn("[useAlbumStickers] save failed:", err.message);
    }
  }, []);

  // Load the album for this language, and carry over whatever was collected
  // before it arrived.
  useEffect(() => {
    if (!token || !uid) return undefined;
    let cancelled = false;
    const current = live.current;
    current.set = null;
    setStickers(null);

    getAlbumStickers(token, uid, dialect)
      .catch((err) => {
        console.warn("[useAlbumStickers] load failed:", err.message);
        return [];
      })
      .then((saved) => {
        if (cancelled) return;
        const merged = new Set([...saved, ...current.pending]);
        if (merged.size > saved.length) {
          current.dirty = true;
          current.timer = setTimeout(flush, SAVE_DELAY_MS);
        }
        current.pending = new Set();
        current.set = merged;
        setStickers(merged);
      });

    return () => {
      cancelled = true;
      // A language change or sign-out must not strand a sticker.
      flush();
    };
  }, [token, uid, dialect, flush]);

  // Write what is waiting when the page goes to the background or is closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  const collect = useCallback(
    (conceptIds) => {
      const current = live.current;
      const owned = current.set;
      const fresh = [];

      for (const id of new Set(conceptIds ?? [])) {
        if (!id) continue;
        if (owned) {
          if (owned.has(id)) continue;
        } else if (current.pending.has(id)) {
          continue;
        }
        fresh.push(id);
      }
      if (fresh.length === 0) return [];

      if (owned) {
        const next = new Set(owned);
        fresh.forEach((id) => next.add(id));
        current.set = next;
        setStickers(next);
        current.dirty = true;
        if (current.timer) clearTimeout(current.timer);
        current.timer = setTimeout(flush, SAVE_DELAY_MS);
      } else {
        fresh.forEach((id) => current.pending.add(id));
      }

      play("sticker");
      return fresh;
    },
    [flush],
  );

  return { stickers, isLoaded: stickers !== null, collect };
}

export default useAlbumStickers;
