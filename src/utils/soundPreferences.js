/**
 * soundPreferences.js
 *
 * Mute, volume and interface clicks: the defaults, the shape check, and the
 * device copy in localStorage (`soundMuted`, `soundVolume`, `soundUiClicks`).
 * The profile copy is `users/{uid}.sound`, written by AppContext.
 */

// Sound preferences, kept on the device like the theme so the very first tap
// already respects them. On by default for everyone, quiet.
export const DEFAULT_SOUND = { muted: false, volume: 0.8, uiClicks: true };

/** A stored sound object, or the defaults for anything missing or junk. */
export const normalizeSound = (stored) => {
  const result = { ...DEFAULT_SOUND };
  if (!stored || typeof stored !== "object") return result;
  if (typeof stored.muted === "boolean") result.muted = stored.muted;
  if (typeof stored.volume === "number" && Number.isFinite(stored.volume)) {
    result.volume = Math.min(Math.max(stored.volume, 0), 1);
  }
  if (typeof stored.uiClicks === "boolean") result.uiClicks = stored.uiClicks;
  return result;
};

export const getSavedSound = () => {
  try {
    const muted = localStorage.getItem("soundMuted");
    const volume = localStorage.getItem("soundVolume");
    const uiClicks = localStorage.getItem("soundUiClicks");
    return normalizeSound({
      muted: muted === null ? undefined : muted === "true",
      volume: volume === null ? undefined : Number(volume),
      uiClicks: uiClicks === null ? undefined : uiClicks === "true",
    });
  } catch {
    return { ...DEFAULT_SOUND };
  }
};

export const saveSoundToLocalStorage = (sound) => {
  try {
    localStorage.setItem("soundMuted", String(sound.muted));
    localStorage.setItem("soundVolume", String(sound.volume));
    localStorage.setItem("soundUiClicks", String(sound.uiClicks));
  } catch {
    // localStorage unavailable
  }
};

