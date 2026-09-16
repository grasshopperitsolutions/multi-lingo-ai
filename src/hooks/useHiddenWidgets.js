import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { updateUserProfile } from "../services/userService";
import { HIDDEN_WIDGETS_FIELD } from "../config/personalWidgets";

/** How long to wait after the last toggle before writing. */
const FLUSH_DELAY_MS = 600;

/**
 * A single frozen empty array, not a fresh `[]` per call.
 *
 * `getFavouriteIds` returns a new empty array when its field is absent, which
 * makes the value a new identity on every render and has already caused one
 * infinite render loop in this codebase. The field here is absent for every
 * user until the first time they hide something — i.e. almost always — so the
 * stable reference is the default case, not the edge case.
 */
const NONE = Object.freeze([]);

/**
 * useHiddenWidgets
 *
 * Which personal-dashboard widgets this user has turned off.
 *
 * Stored as `users/{uid}.hiddenPersonalWidgets`, on the profile rather than in
 * `personalSettings/main`. The profile is already hydrated into context for
 * every page, so both the dashboard and the Settings picker read it with **no
 * request at all** — putting it in the subcollection would cost Settings a
 * fetch it does not otherwise make. The field is not in the API's
 * `ALWAYS_PROTECTED_USER_FIELDS`, so the existing `updateUserProfile` PUT
 * writes it with no endpoint change.
 *
 * ## Why the write is debounced
 *
 * The obvious build flips the switch, writes, and disables every switch until
 * the write lands. That is safe and it is horrible: turning off three widgets
 * becomes three round trips you have to wait out one at a time, and a slow
 * network makes the whole panel look broken.
 *
 * Allowing concurrent writes instead is worse, not better. Each write PUTs the
 * whole array, so two in flight can land out of order and the server ends up
 * with a list the screen disagrees with — the failure mode where the UI is
 * right and the data is wrong.
 *
 * So: state flips immediately, and the full array is written once,
 * {@link FLUSH_DELAY_MS} after the last toggle. One request no matter how many
 * switches were flicked, no disabled controls, and no ordering to get wrong —
 * the same shape `usePersonalSettings` uses for the lesson counter, and for
 * the same reason.
 *
 * Flushed on unmount so navigating away mid-change does not lose it.
 *
 * @returns {{
 *   hidden: readonly string[],
 *   isHidden: (id: string) => boolean,
 *   toggle: (id: string) => void,
 *   isSaving: boolean,
 * }}
 */
export function useHiddenWidgets() {
  const { user, setUser, showAlert } = useAppContext();
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  const hidden = user?.[HIDDEN_WIDGETS_FIELD] ?? NONE;

  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  // The list as the server last accepted it, so a failed write rolls back to
  // the truth rather than to whatever the previous optimistic step was.
  const committedRef = useRef(hidden);

  // Kept in a ref so `flush` does not have to be rebuilt when the profile
  // object changes — rebuilding it would re-run the unmount effect below and
  // fire a flush on every profile refresh. Assigned in an effect, never during
  // render.
  const authRef = useRef({ token: undefined, uid: undefined });
  useEffect(() => {
    authRef.current = { token: user?.token, uid: user?.uid };
  }, [user?.token, user?.uid]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingRef.current;
    const { token, uid } = authRef.current;
    if (next === null || !token || !uid) return;
    pendingRef.current = null;

    const rollbackTo = committedRef.current;
    setIsSaving(true);
    try {
      await updateUserProfile(token, uid, { [HIDDEN_WIDGETS_FIELD]: next });
      committedRef.current = next;
    } catch (err) {
      setUser((prev) => (prev ? { ...prev, [HIDDEN_WIDGETS_FIELD]: rollbackTo } : prev));
      showAlert("error", err.message || t("settings.errors.save_failed"));
    } finally {
      setIsSaving(false);
    }
  }, [setUser, showAlert, t]);

  useEffect(() => () => { flush(); }, [flush]);

  const isHidden = useCallback((id) => hidden.includes(id), [hidden]);

  const toggle = useCallback(
    (id) => {
      if (!user?.token || !user?.uid) return;

      // Read from the live value so a second toggle before the write lands
      // builds on the first rather than replacing it.
      const current = pendingRef.current ?? hidden;
      const next = current.includes(id)
        ? current.filter((existing) => existing !== id)
        : [...current, id];

      setUser((prev) => (prev ? { ...prev, [HIDDEN_WIDGETS_FIELD]: next } : prev));
      pendingRef.current = next;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [user, hidden, setUser, flush],
  );

  return { hidden, isHidden, toggle, isSaving };
}
