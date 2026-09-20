import { useState } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlarmClock, Check } from "lucide-react";
import { auth } from "../firebase";
import { useAppContext } from "../contexts/AppContext";
import { updateUserProfile } from "../services/userService";
import { getPushPermission, isPushAvailable } from "../services/notificationService";
import {
  REMINDER_TOGGLES,
  WEEKDAY_KEYS,
  normalizeReminderPrefs,
} from "../config/reminders";
import NeoDropdown from "./NeoDropdown";
import { SettingsSection } from "./ui";

/** Every hour of the day, as dropdown options. */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, "0")}:00`,
}));

/**
 * ReminderSettings
 *
 * Which practice reminders go out, and when.
 *
 * Separate from `NotificationSettings`, which is the **channel** switch — do I
 * want push at all — while this is the **content** switch. Putting the two in
 * one card would mean a grid of four reminders times two channels for
 * something that only ships on one of them.
 *
 * Reminders are push-only. The email column exists in the model and is off by
 * default, because the mail outbox releases a fixed number a day and shares it
 * with transactional mail; a daily reminder email would starve it. So this card
 * says plainly when push is not on, rather than letting someone configure four
 * reminders that nothing can deliver.
 *
 * Saved immediately, like the theme: there is no Save button on this card and
 * a switch that needs one somewhere else is a switch people think they set.
 */
const ReminderSettings = ({ isDarkMode, defaultOpen = false }) => {
  const { t } = useTranslation();
  const { user, refreshUser, showAlert } = useAppContext();

  const [prefs, setPrefs] = useState(() => normalizeReminderPrefs(user?.reminderPrefs));
  const [isSaving, setIsSaving] = useState(false);

  const pushOn =
    isPushAvailable() &&
    getPushPermission() === "granted" &&
    user?.notificationPrefs?.reminders?.push === true;

  const persist = async (next) => {
    const firebaseUser = auth?.currentUser;
    if (!firebaseUser) return;

    const previous = prefs;
    setPrefs(next);
    setIsSaving(true);
    try {
      const token = await firebaseUser.getIdToken();
      await updateUserProfile(token, firebaseUser.uid, { reminderPrefs: next });
      await refreshUser();
    } catch (err) {
      setPrefs(previous);
      showAlert("error", err.message || t("settings.errors.save_failed"));
    } finally {
      setIsSaving(false);
    }
  };

  const labelClasses = `block text-xs font-black uppercase tracking-widest mb-1.5 ${
    isDarkMode ? "text-slate-400" : "text-slate-500"
  }`;

  return (
    <SettingsSection
      title={t("notifications.reminders_title")}
      icon={<AlarmClock size={16} className="inline mr-2" />}
      isDarkMode={isDarkMode}
      defaultOpen={defaultOpen}
      id="reminderSettings"
    >
      <p className={`text-sm font-bold mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
        {t("notifications.reminders_intro")}
      </p>

      {!pushOn && (
        <p className={`mb-4 text-sm font-bold ${isDarkMode ? "text-amber-400" : "text-amber-600"}`}>
          {t("notifications.reminders_push_off")}
        </p>
      )}

      <div className="flex flex-col gap-2 mb-5">
        {REMINDER_TOGGLES.map(({ id, titleKey, descKey }) => {
          const isOn = prefs[id];
          return (
            <div
              key={id}
              className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-xl ${
                isDarkMode ? "bg-slate-900" : "bg-slate-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className={`block font-bold ${
                  isOn
                    ? isDarkMode ? "text-white" : "text-slate-900"
                    : isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}>
                  {t(titleKey)}
                </span>
                <span className={`block text-sm font-semibold break-words ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                } ${isOn ? "" : "opacity-60"}`}>
                  {t(descKey)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => persist({ ...prefs, [id]: !isOn })}
                disabled={isSaving}
                aria-pressed={isOn}
                aria-label={t(titleKey)}
                className={`shrink-0 w-11 h-11 rounded-xl border-4 flex items-center justify-center transition-all active:scale-90 ${
                  isSaving ? "opacity-50" : ""
                } ${
                  isOn
                    ? isDarkMode
                      ? "bg-yellow-400 border-slate-900 text-slate-900"
                      : "bg-blue-600 border-slate-900 text-white"
                    : isDarkMode
                      ? "bg-slate-700 border-slate-600 text-slate-500"
                      : "bg-white border-slate-300 text-slate-300"
                }`}
              >
                {isOn ? <Check size={20} strokeWidth={4} /> : null}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <label className={labelClasses}>{t("notifications.reminder_hour")}</label>
          <NeoDropdown
            options={HOUR_OPTIONS}
            value={prefs.hour}
            onChange={(hour) => persist({ ...prefs, hour })}
            isDarkMode={isDarkMode}
            className="w-full"
          />
        </div>
        <div className="flex-1 min-w-0">
          <label className={labelClasses}>{t("notifications.reminder_weekday")}</label>
          <NeoDropdown
            options={WEEKDAY_KEYS.map((key, index) => ({ value: index, label: t(key) }))}
            value={prefs.weekday}
            onChange={(weekday) => persist({ ...prefs, weekday })}
            isDarkMode={isDarkMode}
            className="w-full"
          />
        </div>
      </div>

      {/* The hour is meaningless without a zone to read it in, and the zone
          lives in the Profile card three sections up. The sentence already
          said so; now it takes you there, which matters most in the case it
          renders "—" — a reminder with no zone is the one that arrives at the
          wrong hour.

          Split into three keys rather than wrapped in <Trans> because that is
          how this app already puts a link inside a sentence (see
          ChallengeThemePicker). Other locales keep the old unlinked wording
          until a force resync, and fall back to these pt-PT strings meanwhile. */}
      <p className={`mt-3 text-xs font-bold ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        {t("notifications.reminder_hour_hint_prefix", { zone: user?.timezone || "—" })}{" "}
        <Link
          to="/settings#profile"
          className={`underline font-black ${
            isDarkMode ? "text-yellow-400 hover:text-yellow-300" : "text-blue-600 hover:text-blue-800"
          }`}
        >
          {t("notifications.reminder_hour_hint_link")}
        </Link>
        {t("notifications.reminder_hour_hint_suffix")}
      </p>
    </SettingsSection>
  );
};

ReminderSettings.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  defaultOpen: PropTypes.bool,
};

export default ReminderSettings;
