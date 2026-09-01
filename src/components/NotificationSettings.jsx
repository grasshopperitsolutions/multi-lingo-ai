import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, Check, Loader2, Mail, Monitor } from "lucide-react";
import { auth } from "../firebase";
import { updateUserProfile } from "../services/userService";
import {
  enablePushNotifications,
  disablePushNotifications,
  getPushPermission,
  isPushAvailable,
} from "../services/notificationService";

/**
 * Per-category, per-channel notification opt-outs.
 *
 * Saves on every toggle rather than through the page's Save button: turning
 * push on runs an async browser permission prompt and an FCM registration,
 * which doesn't fit the draft-then-save model the rest of the page uses.
 * Keeping all four toggles immediate avoids a page where half the controls
 * save now and half save later.
 *
 * These toggles are a convenience, not the enforcement point — the backend
 * re-checks the stored preference before every send (lib/notification-prefs.ts).
 */
const CATEGORIES = ["announcements", "reminders"];

const DEFAULT_PREFS = {
  announcements: { email: true, push: false },
  reminders: { email: true, push: false },
};

/** Merges stored prefs over the defaults, matching the backend's normalizePrefs(). */
const normalize = (stored) => {
  const result = {
    announcements: { ...DEFAULT_PREFS.announcements },
    reminders: { ...DEFAULT_PREFS.reminders },
  };
  if (!stored || typeof stored !== "object") return result;
  for (const category of CATEGORIES) {
    const value = stored[category];
    if (!value || typeof value !== "object") continue;
    if (typeof value.email === "boolean") result[category].email = value.email;
    if (typeof value.push === "boolean") result[category].push = value.push;
  }
  return result;
};

const NotificationSettings = ({ isDarkMode, user, sectionClasses, onSaved }) => {
  const { t } = useTranslation();

  const [prefs, setPrefs] = useState(() => normalize(user?.notificationPrefs));
  const [permission, setPermission] = useState(() => getPushPermission());
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);

  const pushGranted = permission === "granted";
  const pushBlocked = permission === "denied";
  const pushSupported = isPushAvailable();

  const persist = async (next) => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    await updateUserProfile(token, firebaseUser.uid, { notificationPrefs: next });
    await onSaved?.();
  };

  const toggle = async (category, channel) => {
    const key = `${category}.${channel}`;
    // Optimistic: the toggle flips immediately and is rolled back on failure,
    // so a slow network doesn't make the switch feel broken.
    const previous = prefs;
    const next = {
      ...prefs,
      [category]: { ...prefs[category], [channel]: !prefs[category][channel] },
    };

    setPrefs(next);
    setBusyKey(key);
    setError(null);
    try {
      await persist(next);
    } catch (err) {
      setPrefs(previous);
      setError(err.message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleEnablePush = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;

    setBusyKey("permission");
    setError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const { status } = await enablePushNotifications(
        token,
        firebaseUser.uid,
        user?.fcmTokens ?? [],
      );
      setPermission(status === "granted" ? "granted" : status);
      if (status === "granted") await onSaved?.();
      else if (status !== "denied") setError(t("settings.notifications.push_unsupported"));
    } catch (err) {
      console.error("[NotificationSettings] Could not enable push:", err.message);
      setError(t("settings.notifications.push_failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const handleDisablePush = async () => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;

    setBusyKey("permission");
    try {
      const token = await firebaseUser.getIdToken();
      await disablePushNotifications(token, firebaseUser.uid, user?.fcmTokens ?? []);
      // Every push opt-in goes with it: leaving them on would promise
      // notifications this browser can no longer receive.
      const next = Object.fromEntries(
        CATEGORIES.map((c) => [c, { ...prefs[c], push: false }]),
      );
      setPrefs(next);
      await persist(next);
      setPermission(getPushPermission());
    } catch (err) {
      console.error("[NotificationSettings] Could not disable push:", err.message);
      setError(t("settings.notifications.push_failed"));
    } finally {
      setBusyKey(null);
    }
  };

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-2
    ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  const cell = (category, channel) => {
    const isOn = prefs[category][channel];
    const isPushCell = channel === "push";
    const disabled = busyKey !== null || (isPushCell && !pushGranted);

    return (
      <button
        type="button"
        onClick={() => toggle(category, channel)}
        disabled={disabled}
        aria-pressed={isOn}
        aria-label={`${t(`settings.notifications.category_${category}`)} — ${t(`settings.notifications.channel_${channel}`)}`}
        className={`w-11 h-11 rounded-xl border-4 flex items-center justify-center transition-all
          ${disabled ? "opacity-40 cursor-not-allowed" : "active:scale-90"}
          ${isOn
            ? isDarkMode
              ? "bg-yellow-400 border-slate-900 text-slate-900"
              : "bg-blue-600 border-slate-900 text-white"
            : isDarkMode
              ? "bg-slate-700 border-slate-600 text-slate-500"
              : "bg-white border-slate-300 text-slate-300"
          }`}
      >
        {busyKey === `${category}.${channel}`
          ? <Loader2 size={18} className="animate-spin" />
          : isOn ? <Check size={20} strokeWidth={4} /> : null}
      </button>
    );
  };

  return (
    <div className={sectionClasses}>
      <h2 className={`text-lg font-black uppercase tracking-widest mb-2 ${isDarkMode ? "text-white" : "text-slate-900"}`}>
        <Bell size={16} className="inline mr-2" />
        {t("settings.notifications.title")}
      </h2>
      <p className={`text-sm font-bold mb-6 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("settings.notifications.intro")}
      </p>

      {/* Channel headers */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1" />
        <div className="w-11 text-center">
          <Mail size={14} className={`mx-auto mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
          <span className={labelClasses + " !mb-0 !text-[10px]"}>{t("settings.notifications.channel_email")}</span>
        </div>
        <div className="w-11 text-center">
          <Monitor size={14} className={`mx-auto mb-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`} />
          <span className={labelClasses + " !mb-0 !text-[10px]"}>{t("settings.notifications.channel_push")}</span>
        </div>
      </div>

      <div className="space-y-3">
        {CATEGORIES.map((category) => (
          <div key={category} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className={`font-black text-sm ${isDarkMode ? "text-white" : "text-slate-900"}`}>
                {t(`settings.notifications.category_${category}`)}
              </p>
              <p className={`text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {t(`settings.notifications.category_${category}_hint`)}
              </p>
            </div>
            {cell(category, "email")}
            {cell(category, "push")}
          </div>
        ))}
      </div>

      {/* Browser permission */}
      <div className={`mt-6 pt-6 border-t-2 ${isDarkMode ? "border-slate-700" : "border-slate-200"}`}>
        {!pushSupported ? (
          <p className={`text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            {t("settings.notifications.push_unsupported")}
          </p>
        ) : pushBlocked ? (
          <p className="text-xs font-bold text-rose-500">
            {t("settings.notifications.push_blocked")}
          </p>
        ) : pushGranted ? (
          <button
            type="button"
            onClick={handleDisablePush}
            disabled={busyKey !== null}
            className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95
              ${isDarkMode
                ? "bg-slate-700 border-emerald-500 text-emerald-400"
                : "bg-emerald-50 border-emerald-600 text-emerald-700"}`}
          >
            <span>{t("settings.notifications.push_enabled")}</span>
            {busyKey === "permission" ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={busyKey !== null}
              className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest text-xs transition-all active:scale-95
                ${isDarkMode
                  ? "bg-yellow-400 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#ca8a04]"
                  : "bg-blue-600 border-slate-900 text-white shadow-[4px_4px_0px_0px_#0f172a]"}`}
            >
              <span>{t("settings.notifications.enable_push")}</span>
              {busyKey === "permission" ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
            </button>
            <p className={`mt-2 text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              {t("settings.notifications.push_ios_hint")}
            </p>
          </>
        )}

        {error && <p className="mt-3 text-xs font-bold text-rose-500">{error}</p>}

        <p className={`mt-4 text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
          {t("settings.notifications.transactional_note")}
        </p>
      </div>
    </div>
  );
};

NotificationSettings.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  user: PropTypes.object,
  sectionClasses: PropTypes.string.isRequired,
  onSaved: PropTypes.func,
};

export default NotificationSettings;
