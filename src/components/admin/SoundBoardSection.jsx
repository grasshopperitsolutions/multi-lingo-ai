import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { Play, Repeat } from "lucide-react";
import { CATEGORY_GAINS, SOUNDS, SOUND_CATEGORIES } from "../../config/sounds";
import { getSoundPreferences, play } from "../../services/soundService";

/**
 * SoundBoardSection
 *
 * Admin › Sounds: every sound in `config/sounds.js`, by category, with a
 * button to play it. This is how the set is reviewed by ear, and how a retuned
 * ZzFX array is heard before it ships.
 *
 * "×10" plays a sound ten times in a row, a quarter of a second apart, because
 * fatigue is the usual way UI sound fails: one press always sounds fine.
 *
 * Admin-only, so English copy is fine. It plays through the same service as
 * the rest of the app, so mute, volume and "interface clicks" apply here too,
 * and the line at the top says when they are silencing it.
 */
const SoundBoardSection = ({ isDarkMode }) => {
  const [lastPlayed, setLastPlayed] = useState(null);
  const prefs = getSoundPreferences();

  const byCategory = useMemo(() => {
    const groups = Object.fromEntries(Object.values(SOUND_CATEGORIES).map((c) => [c, []]));
    for (const [id, sound] of Object.entries(SOUNDS)) groups[sound.category]?.push(id);
    return groups;
  }, []);

  const trigger = (id) => {
    play(id);
    setLastPlayed(id);
  };

  const triggerRun = (id) => {
    for (let i = 0; i < 10; i += 1) setTimeout(() => play(id), i * 250);
    setLastPlayed(`${id} ×10`);
  };

  const muted = isDarkMode ? "text-slate-400" : "text-slate-500";
  const card = isDarkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-900";
  const button = `inline-flex items-center justify-center gap-1 min-h-[36px] px-3 rounded-lg border-2 text-xs font-black uppercase tracking-wide transition-all active:scale-95 ${
    isDarkMode ? "border-slate-600 hover:bg-slate-700" : "border-slate-900 hover:bg-slate-100"
  }`;

  return (
    <div className="space-y-6">
      <p className={`text-sm font-bold ${muted}`}>
        Every sound, played through the live service. Briefs are the comments in{" "}
        <code>src/config/sounds.js</code>; arrays from the ZzFX designer paste straight in.
        {prefs.muted && " Sound is muted on this device, so nothing will play."}
        {!prefs.muted && !prefs.uiClicks && " Interface clicks are off, so the UI group is silent."}
        {lastPlayed && <span className="ml-2">Last: <code>{lastPlayed}</code></span>}
      </p>

      {Object.entries(byCategory).map(([category, ids]) => (
        <section key={category} className={`rounded-2xl border-4 p-4 ${card}`}>
          <h3 className="font-black uppercase tracking-widest text-sm mb-3">
            {category} <span className={`ml-2 text-xs ${muted}`}>gain {CATEGORY_GAINS[category]}</span>
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ids.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2">
                <code className="text-sm font-bold break-all">{id}</code>
                <span className="flex gap-1.5 shrink-0">
                  <button type="button" className={button} onClick={() => trigger(id)} aria-label={`Play ${id}`}>
                    <Play size={14} /> Play
                  </button>
                  <button type="button" className={button} onClick={() => triggerRun(id)} aria-label={`Play ${id} ten times`}>
                    <Repeat size={14} /> ×10
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};

SoundBoardSection.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};

export default SoundBoardSection;
