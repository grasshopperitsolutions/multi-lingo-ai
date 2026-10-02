import { useCallback } from "react";
import { play } from "../services/soundService";

/**
 * usePageTurnSound
 *
 * The book shelf's paper rustles. They used to be synthesised here with a
 * private AudioContext; they now live in `config/sounds.js` (`cover_open`,
 * `page_turn`) and play through `soundService`, so they obey the mute button,
 * the volume and every other rule the rest of the app's sounds follow. The
 * filtered-noise shape is unchanged.
 *
 * @returns {{ playCover: () => void, playPage: () => void }}
 */
export function usePageTurnSound() {
  const playCover = useCallback(() => play("cover_open"), []);
  const playPage = useCallback(() => play("page_turn"), []);
  return { playCover, playPage };
}
