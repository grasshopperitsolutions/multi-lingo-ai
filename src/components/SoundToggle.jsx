import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { play, setSoundPreferences } from "../services/soundService";

/**
 * SoundToggle
 *
 * The mute button, beside the theme toggle in both headers and as a row in the
 * mobile drawer. Saved on pick, like the theme: on the device at once, and on
 * the profile for a signed-in user (`setSoundPreference` in AppContext).
 *
 * The label says what pressing it will do ("Desligar som" / "Ligar som"),
 * which is why there is no `aria-pressed`: a pressed state on a button whose
 * name changes contradicts itself to a screen reader.
 *
 * Turning sound back on plays `unmute`, which is the proof that it worked. The
 * service is told directly first, because the context's update reaches it only
 * after the next render, and the chime would otherwise fall on a muted service.
 */
const SoundToggle = ({ variant = "icon", isDarkMode, onAfterToggle }) => {
  const { t } = useTranslation();
  const { sound, setSoundPreference } = useAppContext();
  const muted = sound?.muted ?? false;
  const label = muted ? t("nav.sound_on") : t("nav.sound_off");

  const toggle = () => {
    const next = !muted;
    setSoundPreferences({ muted: next });
    setSoundPreference({ muted: next });
    if (!next) play("unmute");
    onAfterToggle?.();
  };

  const Icon = muted ? VolumeX : Volume2;

  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-center justify-between px-5 py-4 font-black uppercase tracking-wide text-sm border-b-2 transition-colors ${
          isDarkMode ? "border-slate-700 hover:bg-slate-700" : "border-slate-200 hover:bg-slate-50"
        }`}
      >
        <span>{label}</span>
        <div
          className={`p-2 rounded-full border-2 ${
            isDarkMode ? "bg-slate-600 border-emerald-400" : "bg-emerald-300 border-slate-900"
          }`}
        >
          <Icon size={18} className={isDarkMode ? "text-emerald-400" : "text-slate-900"} />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className={`p-3 rounded-full border-2 transition-transform hover:scale-110 active:scale-95 ${
        isDarkMode
          ? "bg-slate-700 border-emerald-400"
          : "bg-emerald-300 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]"
      }`}
    >
      <Icon size={20} className={isDarkMode ? "text-emerald-400" : "text-slate-900"} />
    </button>
  );
};

SoundToggle.propTypes = {
  variant: PropTypes.oneOf(["icon", "row"]),
  isDarkMode: PropTypes.bool.isRequired,
  /** Called after a toggle, e.g. to close the mobile drawer. */
  onAfterToggle: PropTypes.func,
};

export default SoundToggle;
