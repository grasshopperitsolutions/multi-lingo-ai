import { useCallback, useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { getNoteBoard, saveNoteBoard, NOTE_BOARD_MAX_CHARS } from "../services/personalService";

/** How long to wait after the last keystroke before writing. */
const FLUSH_DELAY_MS = 1200;

/**
 * usePersonalNoteBoard
 *
 * One long piece of text, held locally and written back on a delay.
 *
 * Longer than the counter's 800ms, because the interaction is different:
 * a counter is tapped in bursts and then left alone, while typing produces a
 * change every few hundred milliseconds for minutes at a time. Waiting a beat
 * past the last keystroke turns a paragraph into one write instead of thirty.
 *
 * Two flushes are forced rather than waited for — unmounting (navigating away
 * mid-sentence) and the tab being hidden (switching apps on a phone, which on
 * iOS may be the last moment any JavaScript runs).
 *
 * The status is returned and shown because this page has no save button. An
 * autosaving page that says nothing asks the user to trust it with the only
 * copy of something they wrote; one that says "saved" is telling the truth
 * about a write that has actually landed.
 *
 * @returns {{
 *   text: string,
 *   setText: (next: string) => void,
 *   isLoading: boolean,
 *   status: "idle"|"unsaved"|"saving"|"saved"|"error",
 *   flush: () => Promise<void>,
 * }}
 */
export function usePersonalNoteBoard() {
  const { user } = useAppContext();

  const [text, setTextState] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("idle");

  const token = user?.token;
  const uid = user?.uid;

  // The text to write, or null when what is on screen is already saved.
  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingRef.current;
    if (next === null || !token || !uid) return;
    pendingRef.current = null;

    setStatus("saving");
    try {
      await saveNoteBoard({ token, uid, text: next });
      setStatus("saved");
    } catch {
      // Deliberately no alert: a toast per failed autosave, while somebody is
      // still typing, would bury the page. The status line carries it, and the
      // text stays in the box either way.
      pendingRef.current = next;
      setStatus("error");
    }
  }, [token, uid]);

  useEffect(() => {
    if (!token || !uid) return;
    let cancelled = false;

    getNoteBoard({ token, uid })
      .then((board) => { if (!cancelled) setTextState(board.text); })
      .catch(() => { /* an empty board is a fine starting point */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [token, uid]);

  // Leaving the page must not lose the last sentence.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const setText = useCallback(
    (next) => {
      const capped = next.slice(0, NOTE_BOARD_MAX_CHARS);
      setTextState(capped);
      pendingRef.current = capped;
      setStatus("unsaved");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [flush],
  );

  return { text, setText, isLoading, status, flush };
}
