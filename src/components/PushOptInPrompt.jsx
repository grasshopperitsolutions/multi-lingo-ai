import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BellRing, Loader2 } from "lucide-react";
import { auth } from "../firebase";
import { useAppContext } from "../contexts/AppContext";
import {
  enablePushNotifications,
  getPushPermission,
  isPushAvailable,
} from "../services/notificationService";
import { updateUserProfile } from "../services/userService";

/**
 * PushOptInPrompt
 *
 * The one place the app asks to send notifications. A line under the tier
 * badge in the dashboard header, shown only while this browser cannot receive
 * a push.
 *
 * ## Why it is a button and not an automatic prompt
 *
 * `Notification.requestPermission()` needs a user gesture — Chrome ignores a
 * gesture-less call and Safari refuses outright — and, more importantly, a
 * dismissal is **permanent**: once the browser records `denied`, no code can
 * ask again; only the user can undo it in browser settings. So the browser
 * dialog is only ever raised by a deliberate click on this line. Firing it on
 * page load would spend the single chance we get on someone who was not
 * looking at it.
 *
 * ## What "on" means
 *
 * Granting permission turns on **both** optional push categories, which is the
 * deal this line offers. Opting back out is per-category in Settings, and
 * turning reminders off there hides this prompt for good — otherwise the
 * warning would nag exactly the person who has already answered it.
 *
 * ## The three states
 *
 * - **not asked** — the line, clickable.
 * - **denied** — the browser will not reopen the dialog, so the line says so
 *   and stops offering a button that cannot work.
 * - **granted, or opted out** — nothing renders.
 */
const PushOptInPrompt = ({ isDarkMode }) => {
  const { t } = useTranslation();
  const { user, refreshUser, showAlert } = useAppContext();

  const [permission, setPermission] = useState(() => getPushPermission());
  const [isBusy, setIsBusy] = useState(false);

  // Explicitly off in Settings: they have answered, and the answer was no.
  const optedOut = user?.notificationPrefs?.reminders?.push === false;

  if (!user || !isPushAvailable() || permission === "granted" || optedOut) return null;

  const isBlocked = permission === "denied";

  const handleEnable = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser || isBusy) return;

    setIsBusy(true);
    try {
      const token = await firebaseUser.getIdToken();
      const { status } = await enablePushNotifications(
        token,
        firebaseUser.uid,
        user?.fcmTokens ?? [],
      );
      setPermission(status);

      if (status !== "granted") return;

      // Permission alone delivers nothing: the backend checks the stored
      // preference before every send. Turning both categories on here is what
      // the line promised, and Settings is where either is turned back off.
      const prefs = user?.notificationPrefs ?? {};
      await updateUserProfile(token, firebaseUser.uid, {
        notificationPrefs: {
          ...prefs,
          announcements: { ...(prefs.announcements ?? {}), push: true },
          reminders: { ...(prefs.reminders ?? {}), push: true },
        },
      });
      await refreshUser();
      showAlert("success", t("notifications.opt_in_done"));
    } catch (err) {
      showAlert("error", err.message || t("settings.errors.save_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  if (isBlocked) {
    return (
      <p className={`flex items-center gap-1.5 text-[11px] font-bold leading-tight ${
        isDarkMode ? "text-slate-500" : "text-slate-400"
      }`}>
        <BellRing size={12} className="shrink-0" />
        {t("notifications.opt_in_blocked")}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleEnable}
      disabled={isBusy}
      className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider leading-tight underline transition-colors ${
        isDarkMode
          ? "text-amber-400 hover:text-amber-300"
          : "text-amber-600 hover:text-amber-700"
      } ${isBusy ? "opacity-50 cursor-wait" : ""}`}
    >
      {isBusy
        ? <Loader2 size={12} className="animate-spin shrink-0" />
        : <BellRing size={12} className="shrink-0" />}
      {t("notifications.opt_in_cta")}
    </button>
  );
};

PushOptInPrompt.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default PushOptInPrompt;
