/**
 * useSessionRecovery.js
 *
 * What a screen does when a request comes back 401 "Invalid or expired
 * token". The app renews the sign-in token before it lapses, and again the
 * moment a tab is visible, so this is the narrow case left: a phone waking
 * up, with a request out before that check finished.
 *
 * It used to be a browser alert() and a page reload, written into each game,
 * which threw away the game in progress for something a fresh token fixes.
 *
 *   const recoverSession = useSessionRecovery();
 *   ...
 *   } catch (err) {
 *     if (await recoverSession(err)) return;
 *     failWith(err, sanitizeAIError(err.message, t("challenges.word_fetch_error")));
 *   }
 *
 * Resolves true when the error is handled:
 *   - the token was renewed. `user.token` changes, and every load built on it
 *     runs again by itself, so the caller must not show an error;
 *   - the session is over. The app signs out and says so calmly.
 * Resolves false for any other error, and for a token that could not be
 * renewed, so the caller shows its usual error. sanitizeAIError turns the
 * raw "Invalid or expired token" into the caller's own message.
 */

import { useCallback } from "react";
import { useAppContext } from "../contexts/AppContext";
import { isSessionExpiredError } from "../utils/errorUtils";

export function useSessionRecovery() {
  const { renewSession } = useAppContext();

  return useCallback(
    async (err) => {
      if (!isSessionExpiredError(err)) return false;
      return (await renewSession()) !== "failed";
    },
    [renewSession],
  );
}
