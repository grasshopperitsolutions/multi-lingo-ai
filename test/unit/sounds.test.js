import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SOUNDS, SOUND_IDS, SOUND_CATEGORIES, CATEGORY_GAINS } from "../../src/config/sounds";
import { buildZzfxSamples, ZZFX_SAMPLE_RATE } from "../../src/lib/zzfx";
import {
  play,
  hold,
  release,
  isHeld,
  setDucked,
  setSoundPreferences,
  getSoundPreferences,
  silenceReason,
  playScore,
  REPEAT_GUARD_MS,
  __resetSoundsForTests,
  __unlockForTests,
} from "../../src/services/soundService";
import { normalizeSound, DEFAULT_SOUND, getSavedSound, saveSoundToLocalStorage } from "../../src/utils/soundPreferences";

/**
 * The sound service and registry.
 *
 * jsdom has no Web Audio, so a small fake AudioContext counts what would have
 * been played. What these pin are the rules that fail quietly: a sound during
 * a recording, a hold released by the wrong reason, a muted app that still
 * clicks, a sound before the first tap.
 */

let started;
let masterGains;

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = {};
    this.sampleRate = 44100;
  }
  createGain() {
    const node = {
      gain: {
        value: 1,
        setTargetAtTime(v) { node.gain.value = v; },
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect: (d) => d,
    };
    masterGains.push(node);
    return node;
  }
  createBuffer(_channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    return {
      buffer: null,
      playbackRate: { value: 1 },
      connect: (d) => d ?? { connect: (x) => x },
      start: () => { started += 1; },
      stop: () => {},
    };
  }
  createBiquadFilter() {
    const filter = {
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      Q: { value: 1 },
      connect: (d) => d,
    };
    return filter;
  }
  resume() { return Promise.resolve(); }
}

beforeEach(() => {
  started = 0;
  masterGains = [];
  window.AudioContext = FakeAudioContext;
  __resetSoundsForTests();
  __unlockForTests();
});

afterEach(() => {
  delete window.AudioContext;
  vi.useRealTimers();
});

describe("the registry", () => {
  it("gives every sound a known category and at least one part", () => {
    const categories = Object.values(SOUND_CATEGORIES);
    for (const id of SOUND_IDS) {
      expect(categories, id).toContain(SOUNDS[id].category);
      expect(SOUNDS[id].parts.length, id).toBeGreaterThan(0);
      for (const part of SOUNDS[id].parts) {
        expect(Boolean(part.zzfx) || Boolean(part.noise), `${id} part`).toBe(true);
      }
    }
  });

  it("has a gain for every category", () => {
    for (const category of Object.values(SOUND_CATEGORIES)) {
      expect(typeof CATEGORY_GAINS[category]).toBe("number");
    }
  });

  it("keeps ZzFX randomness at 0, so cached buffers are the sound as written", () => {
    for (const id of SOUND_IDS) {
      for (const part of SOUNDS[id].parts) {
        if (part.zzfx) expect(part.zzfx[1], id).toBe(0);
      }
    }
  });

  it("keeps sounds short: UI under 150 ms of synthesis, everything under 1.5 s", () => {
    for (const id of SOUND_IDS) {
      const ends = SOUNDS[id].parts.map((part) => {
        const at = (part.at ?? 0) / 1000;
        if (part.noise) return at + part.noise.duration;
        return at + buildZzfxSamples(...part.zzfx).length / ZZFX_SAMPLE_RATE;
      });
      const length = Math.max(...ends);
      expect(length, id).toBeLessThan(1.5);
      if (SOUNDS[id].category === SOUND_CATEGORIES.UI) expect(length, id).toBeLessThan(0.2);
    }
  });

  it("builds real samples, never silence or NaN", () => {
    const samples = buildZzfxSamples(...SOUNDS.word_banked.parts[0].zzfx);
    expect(samples.length).toBeGreaterThan(1000);
    expect(samples.some((v) => Math.abs(v) > 0.01)).toBe(true);
    expect(samples.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("play", () => {
  it("plays every part of a sound", () => {
    expect(play("word_found")).toBe(true);
    expect(started).toBe(SOUNDS.word_found.parts.length);
  });

  it("stays silent before the first tap", () => {
    __resetSoundsForTests();
    expect(play("tap")).toBe(false);
    expect(silenceReason("tap")).toBe("locked");
    expect(started).toBe(0);
  });

  it("ignores an unknown id rather than throwing", () => {
    expect(play("no_such_sound")).toBe(false);
  });

  it("will not restart the same sound inside the guard, but will after it", () => {
    vi.useFakeTimers();
    expect(play("tap")).toBe(true);
    expect(play("tap")).toBe(false);
    // A different sound is not blocked by it.
    expect(play("select")).toBe(true);
    vi.advanceTimersByTime(REPEAT_GUARD_MS + 1);
    expect(play("tap")).toBe(true);
  });

  it("is silent when muted, and at volume zero", () => {
    setSoundPreferences({ muted: true });
    expect(play("success")).toBe(false);
    setSoundPreferences({ muted: false, volume: 0 });
    expect(play("success")).toBe(false);
    expect(started).toBe(0);
  });

  it("drops only the UI category when interface clicks are off", () => {
    setSoundPreferences({ uiClicks: false });
    expect(play("tap")).toBe(false);
    expect(play("answer_correct")).toBe(true);
  });

  it("is silent in a hidden tab", () => {
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    expect(play("info")).toBe(false);
    spy.mockRestore();
  });
});

describe("hold and release", () => {
  it("holds everything while a reason is held", () => {
    hold("recording");
    expect(isHeld()).toBe(true);
    expect(play("success")).toBe(false);
    release("recording");
    expect(play("success")).toBe(true);
  });

  it("nests: releasing one reason does not release another", () => {
    hold("recording");
    hold("live-tutor");
    release("recording");
    expect(isHeld()).toBe(true);
    expect(play("info")).toBe(false);
    release("live-tutor");
    expect(play("info")).toBe(true);
  });

  it("releasing a reason that was never held is harmless", () => {
    release("nothing");
    expect(isHeld()).toBe(false);
  });
});

describe("volume and ducking", () => {
  it("clamps the volume and ducks under speech", () => {
    setSoundPreferences({ volume: 3 });
    expect(getSoundPreferences().volume).toBe(1);
    play("info"); // creates the context and the master gain
    const master = masterGains[0];
    setDucked(true);
    expect(master.gain.value).toBeCloseTo(0.3);
    setDucked(false);
    expect(master.gain.value).toBeCloseTo(1);
  });
});

describe("playScore", () => {
  it("ticks up and ends on win, success or a neutral chime, never lose", () => {
    vi.useFakeTimers();
    // Count the parts that play: ticks plus the ending's parts.
    const record = (pct) => {
      __resetSoundsForTests();
      __unlockForTests();
      started = 0;
      playScore(pct);
      vi.runAllTimers();
      return started;
    };
    // A higher score has more ticks and the bigger ending.
    const ticks = (pct) => Math.max(1, Math.min(10, Math.round(pct / 10)));
    expect(record(95)).toBe(ticks(95) + SOUNDS.win.parts.length);
    expect(record(60)).toBe(ticks(60) + SOUNDS.success.parts.length);
    expect(record(20)).toBe(ticks(20) + SOUNDS.chime.parts.length);
  });

  it("does nothing without a number", () => {
    vi.useFakeTimers();
    playScore(undefined);
    vi.runAllTimers();
    expect(started).toBe(0);
  });
});

describe("sound preferences", () => {
  it("defaults to on, quiet-ish, with clicks", () => {
    expect(normalizeSound(undefined)).toEqual(DEFAULT_SOUND);
    expect(DEFAULT_SOUND.muted).toBe(false);
  });

  it("keeps good values and drops junk", () => {
    expect(normalizeSound({ muted: true, volume: 0.4, uiClicks: false })).toEqual({ muted: true, volume: 0.4, uiClicks: false });
    expect(normalizeSound({ muted: "yes", volume: 9, uiClicks: 1 })).toEqual({ ...DEFAULT_SOUND, volume: 1 });
  });

  it("round-trips through the device copy", () => {
    saveSoundToLocalStorage({ muted: true, volume: 0.25, uiClicks: false });
    expect(getSavedSound()).toEqual({ muted: true, volume: 0.25, uiClicks: false });
    localStorage.removeItem("soundMuted");
    localStorage.removeItem("soundVolume");
    localStorage.removeItem("soundUiClicks");
    expect(getSavedSound()).toEqual(DEFAULT_SOUND);
  });
});
