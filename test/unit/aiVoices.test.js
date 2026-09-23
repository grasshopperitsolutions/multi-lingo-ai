import { describe, it, expect } from "vitest";
import { AI_VOICES, DEFAULT_AI_VOICE, resolveVoice } from "../../src/config/aiVoices";

/**
 * The one voice list, for every clip and the spoken tutor.
 *
 * The names are sent to Google verbatim, and the two surfaces fail
 * differently on a bad one: TTS refuses it with a 400, the Live API quietly
 * speaks in some default voice. So the list has to be exactly Google's names,
 * and a stored preference that is not on it must never be sent at all.
 */
describe("config/aiVoices", () => {
  it("keeps Sulafat as everyone's voice until they choose another", () => {
    expect(DEFAULT_AI_VOICE).toBe("Sulafat");
    expect(AI_VOICES).toContain(DEFAULT_AI_VOICE);
  });

  it("offers every prebuilt voice, once each, alphabetically", () => {
    expect(AI_VOICES).toHaveLength(30);
    expect(new Set(AI_VOICES).size).toBe(AI_VOICES.length);
    expect(AI_VOICES).toEqual([...AI_VOICES].sort());
  });

  it("uses a stored voice that is still offered", () => {
    expect(resolveVoice("Charon")).toBe("Charon");
    expect(resolveVoice("Zubenelgenubi")).toBe("Zubenelgenubi");
  });

  it("falls back to the default for anything else", () => {
    // A profile from before this existed, a blank, or a name retired later —
    // none of them may reach an API that refuses or silently swaps it.
    for (const stored of [undefined, null, "", "NotARealVoice", "sulafat"]) {
      expect(resolveVoice(stored)).toBe(DEFAULT_AI_VOICE);
    }
  });
});
