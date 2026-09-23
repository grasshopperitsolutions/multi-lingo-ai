/**
 * aiVoices.js
 *
 * The voices a learner can choose for everything the app says out loud — every
 * read-aloud clip and the spoken tutor alike. One choice, made in Settings ›
 * Appearance, stored as `users/{uid}.preferredVoice`.
 *
 * All thirty of Gemini's prebuilt voices, by the names Google gives them,
 * alphabetically so a long list is scannable. The same names work for both
 * surfaces: Google documents the Live API as supporting any voice its TTS
 * models do, and the TTS path refuses a name it does not know with a 400 —
 * which is what made it possible to check them against the real API rather
 * than trust the list.
 *
 * Spelling matters more than it looks. The Live API does *not* refuse an
 * unknown name; it quietly speaks in a default voice, so a typo here would
 * give a learner a different voice from the one they picked in the tutor and
 * an error everywhere else.
 */

export const AI_VOICES = [
  'Achernar', 'Achird', 'Algenib', 'Algieba', 'Alnilam', 'Aoede', 'Autonoe',
  'Callirrhoe', 'Charon', 'Despina', 'Enceladus', 'Erinome', 'Fenrir', 'Gacrux',
  'Iapetus', 'Kore', 'Laomedeia', 'Leda', 'Orus', 'Puck', 'Pulcherrima',
  'Rasalgethi', 'Sadachbia', 'Sadaltager', 'Schedar', 'Sulafat', 'Umbriel',
  'Vindemiatrix', 'Zephyr', 'Zubenelgenubi',
];

/** Everyone's voice until they choose another. */
export const DEFAULT_AI_VOICE = 'Sulafat';

/**
 * The voice to actually use for a stored preference.
 *
 * Absent, blank or no longer on the list all mean the default — a profile
 * written before this existed, or a name retired later, must never reach an
 * API that either refuses it or silently swaps it.
 *
 * @param {unknown} name
 * @returns {string}
 */
export function resolveVoice(name) {
  return AI_VOICES.includes(name) ? name : DEFAULT_AI_VOICE;
}
