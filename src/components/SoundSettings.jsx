import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MousePointerClick, Volume2, VolumeX } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { play, setSoundPreferences } from "../services/soundService";

/** Wait this long after the slider stops before saving, so a drag is one write. */
const VOLUME_SAVE_DELAY_MS = 400;

/**
 * SoundSettings
 *
 * Settings › Appearance: sound on or off, the volume, and whether interface
 * clicks sound. Saved on pick like the theme and the cursor beside it, not
 * with the Save button.
 *
 * The slider changes the volume live and saves once it settles, then plays a
 * short sound at the new level, so the reader hears what they chose. The
 * clicks switch turns off only the UI category: the one people most often want
 * gone while keeping the game sounds.
 */
const SoundSettings = ({ isDarkMode, labelClasses }) => {
  const { t } = useTranslation();
  const { sound, setSoundPreference } = useAppContext();
  const [volume, setVolume] = useState(Math.round((sound?.volume ?? 0.8) * 100));
  const timerRef = useRef(null);

  // Follow a value that arrives later (the profile loading after the page).
  useEffect(() => {
    setVolume(Math.round((sound?.volume ?? 0.8) * 100));
  }, [sound?.volume]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const muted = sound?.muted ?? false;
  const uiClicks = sound?.uiClicks ?? true;

  const toggleMuted = () => {
    const next = !muted;
    setSoundPreferences({ muted: next });
    setSoundPreference({ muted: next });
    if (!next) play("unmute");
  };

  const toggleClicks = () => {
    const next = !uiClicks;
    setSoundPreferences({ uiClicks: next });
    setSoundPreference({ uiClicks: next });
    if (next) play("tap");
  };

  const changeVolume = (value) => {
    setVolume(value);
    setSoundPreferences({ volume: value / 100 });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSoundPreference({ volume: value / 100 });
      play("info");
    }, VOLUME_SAVE_DELAY_MS);
  };

  const switchClasses = (on) =>
    `w-full flex items-center justify-between px-5 py-3 rounded-xl border-4 font-black uppercase tracking-widest transition-all active:scale-95 ${
      on
        ? isDarkMode
          ? "bg-slate-700 border-emerald-400 text-emerald-400 shadow-[4px_4px_0px_0px_#047857]"
          : "bg-emerald-300 border-slate-900 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]"
        : isDarkMode
          ? "bg-slate-800 border-slate-600 text-slate-400 shadow-[4px_4px_0px_0px_#0f172a]"
          : "bg-white border-slate-300 text-slate-500 shadow-[4px_4px_0px_0px_#cbd5e1]"
    }`;
  const hint = `mt-2 text-xs font-bold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  return (
    <>
      <div>
        <label className={labelClasses}>
          {muted ? <VolumeX size={12} className="inline mr-1" /> : <Volume2 size={12} className="inline mr-1" />}
          {t("settings.sound")}
        </label>
        <button type="button" onClick={toggleMuted} aria-pressed={!muted} className={switchClasses(!muted)}>
          <span>{muted ? t("settings.sound_off") : t("settings.sound_on")}</span>
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <p className={hint}>{t("settings.sound_hint")}</p>
      </div>

      <div>
        <label className={labelClasses} htmlFor="sound-volume">
          {t("settings.sound_volume")} · <span className="tabular-nums">{volume}%</span>
        </label>
        <input
          id="sound-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          disabled={muted}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className={`w-full h-11 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            isDarkMode ? "accent-emerald-400" : "accent-emerald-600"
          }`}
        />
      </div>

      <div>
        <label className={labelClasses}>
          <MousePointerClick size={12} className="inline mr-1" /> {t("settings.sound_ui_clicks")}
        </label>
        <button
          type="button"
          onClick={toggleClicks}
          disabled={muted}
          aria-pressed={uiClicks}
          className={`${switchClasses(uiClicks && !muted)} disabled:opacity-60`}
        >
          <span>{uiClicks ? t("settings.sound_ui_clicks_on") : t("settings.sound_ui_clicks_off")}</span>
          <MousePointerClick size={20} />
        </button>
        <p className={hint}>{t("settings.sound_ui_clicks_hint")}</p>
      </div>
    </>
  );
};

SoundSettings.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  labelClasses: PropTypes.string.isRequired,
};

export default SoundSettings;
