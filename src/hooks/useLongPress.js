import { useCallback, useEffect, useRef } from "react";

/**
 * useLongPress
 *
 * Two actions on one target: a tap and a press-and-hold.
 *
 * The story reader needs both on the same word — tap looks it up, hold banks
 * it — and the alternative, a double tap, would have cost the tap a ~300ms
 * delay on every single word while the component waited to see whether a
 * second tap was coming. The lookup is the primary action; it doesn't pay for
 * the secondary one.
 *
 * The click fires from `pointerup`, not from a real click event, because by
 * then this hook already knows whether the hold fired. Moving off the target
 * cancels both, which is also what makes a scroll-drag on mobile harmless.
 *
 * `contextmenu` is suppressed: on touch devices a long press otherwise raises
 * the selection/context UI over the word being held, and on desktop it opens
 * the browser menu instead of banking the word.
 *
 * @param {object}   params
 * @param {Function} params.onLongPress - fired once the hold completes
 * @param {Function} [params.onClick]   - fired on release when the hold did not
 * @param {number}   [params.delay=500] - hold duration in ms
 * @returns {object} props to spread onto the element
 */
export function useLongPress({ onLongPress, onClick, delay = 500 }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(
    (event) => {
      // Secondary buttons shouldn't arm a hold — a right-click is not a press.
      if (event.button != null && event.button !== 0) return;
      firedRef.current = false;
      clear();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        timerRef.current = null;
        onLongPress?.();
      }, delay);
    },
    [clear, delay, onLongPress],
  );

  const end = useCallback(() => {
    const heldLongEnough = firedRef.current;
    clear();
    if (!heldLongEnough) onClick?.();
  }, [clear, onClick]);

  // A component unmounting mid-press (navigating away, a new story arriving)
  // must not fire the hold into a dead handler.
  useEffect(() => clear, [clear]);

  return {
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (event) => event.preventDefault(),
  };
}
