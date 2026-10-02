import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../contexts/AppContext";
import { getPersonalSettings, savePersonalSettings } from "../services/personalService";
import { updateUserProfile } from "../services/userService";
import { DEFAULT_WEEKLY_TARGET, resolveWeeklyTarget } from "../utils/practiceDays";

/** How long to wait after the last change before writing. */
const FLUSH_DELAY_MS = 800;

/**
 * usePersonalSettings
 *
 * The lesson counter and the goal, held locally and written back on a delay.
 *
 * The delay is the whole reason this is a hook rather than state in a page.
 * Decrementing a counter is a tapping interaction — somebody marking off four
 * lessons at once taps four times in two seconds, and four Firestore writes
 * for one intention is both wasteful and a race with itself. Changes land in
 * state immediately and flush once, {@link FLUSH_DELAY_MS} after the last one.
 *
 * Two flushes are forced rather than waited for: unmounting (navigating away
 * mid-tap) and the tab being hidden (switching apps on a phone, which on iOS
 * may be the last moment any JavaScript runs).
 */
export function usePersonalSettings() {
  const { user, setUser, showAlert } = useAppContext();
  const { t } = useTranslation();

  const [settings, setSettings] = useState({
    lessonsRemaining: 0,
    goalLabel: "",
    goalDate: "",
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
  });
  const [isLoading, setIsLoading] = useState(true);

  const token = user?.token;
  const uid = user?.uid;
  // Read by the load effect below without re-running it when the goal changes.
  const mirroredTargetRef = useRef(user?.weeklyTarget);
  useEffect(() => { mirroredTargetRef.current = user?.weeklyTarget; }, [user?.weeklyTarget]);

  /**
   * The weekly goal also lives on the profile, because the API's reminder loop
   * and the Today panel cannot read a subcollection per user. This keeps the
   * two in step; a failed mirror costs a nudge measured against the default,
   * not the goal itself, so it is logged rather than shown.
   */
  const mirrorTarget = useCallback(
    (value) => {
      if (!token || !uid) return;
      const target = resolveWeeklyTarget(value);
      setUser((prev) => (prev ? { ...prev, weeklyTarget: target } : prev));
      updateUserProfile(token, uid, { weeklyTarget: target })
        .catch((err) => console.warn("[usePersonalSettings] Could not mirror the weekly goal:", err?.message));
    },
    [token, uid, setUser],
  );

  const pendingRef = useRef(null);
  const timerRef = useRef(null);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const patch = pendingRef.current;
    if (!patch || !token || !uid) return;
    pendingRef.current = null;

    try {
      await savePersonalSettings({ token, uid, patch });
      if (patch.weeklyTarget !== undefined) mirrorTarget(patch.weeklyTarget);
    } catch (err) {
      showAlert("error", err.message || t("settings.errors.save_failed"));
    }
  }, [token, uid, showAlert, t, mirrorTarget]);

  useEffect(() => {
    if (!token || !uid) return;
    let cancelled = false;

    getPersonalSettings({ token, uid })
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        // A goal set before the profile carried a copy of it: mirror it once.
        if (resolveWeeklyTarget(loaded.weeklyTarget) !== resolveWeeklyTarget(mirroredTargetRef.current)) {
          mirrorTarget(loaded.weeklyTarget);
        }
      })
      .catch(() => { /* defaults are a fine starting point */ })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [token, uid, mirrorTarget]);

  // Leaving the page must not lose the last tap.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const save = useCallback(
    (patch) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      pendingRef.current = { ...(pendingRef.current ?? {}), ...patch };

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [flush],
  );

  return { settings, isLoading, save, flush };
}
