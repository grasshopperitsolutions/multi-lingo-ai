import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPcmPlayer } from "../../src/utils/pcmAudio";

/**
 * PCM playback.
 *
 * The conversion itself is easy to get subtly wrong and impossible to notice
 * from a test that only checks it runs: a sample scaled past the Int16 range
 * wraps to a large negative number and arrives as a click, and chunks played on
 * arrival rather than scheduled leave a seam between every one — and the
 * model's speech comes in many small pieces.
 *
 * Capture is not exercised here. It needs AudioWorklet, which jsdom does not
 * implement, so it is verified in a browser rather than pretended at.
 */

let scheduled;
let currentTime;
/** What a fake AnalyserNode hands back. 128 is silence. */
let scopeData;
/** Set false to model an environment where reading the analyser does nothing. */
let analyserReads;

class FakeBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channel = null;
  }
  copyToChannel(data) {
    this.channel = data;
  }
}

class FakeContext {
  constructor() {
    this.destination = {};
  }
  get currentTime() {
    return currentTime;
  }
  createBuffer(channels, length, sampleRate) {
    return new FakeBuffer(channels, length, sampleRate);
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      getByteTimeDomainData: (target) => {
        if (!analyserReads) return;
        for (let i = 0; i < target.length; i += 1) {
          target[i] = scopeData[i % scopeData.length];
        }
      },
    };
  }
  createBufferSource() {
    const source = {
      buffer: null,
      connect: vi.fn(),
      stop: vi.fn(),
      onended: null,
      start: vi.fn((at) => {
        scheduled.push({ at, source });
      }),
    };
    return source;
  }
  async close() {}
}

/** 16-bit LE PCM for the given float samples, base64'd — what Gemini sends. */
function pcmBase64(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    pcm[i] = samples[i] < 0 ? samples[i] * 0x8000 : samples[i] * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  return btoa(String.fromCharCode(...bytes));
}

beforeEach(() => {
  scheduled = [];
  currentTime = 0;
  scopeData = new Uint8Array([128]);
  analyserReads = true;
  vi.stubGlobal("AudioContext", FakeContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decoding what arrives", () => {
  it("turns base64 PCM16 back into floats in range", () => {
    const player = createPcmPlayer();
    player.enqueue(pcmBase64([0, 0.5, -0.5, 1, -1]));

    const { channel } = scheduled[0].source.buffer;
    expect(channel).toHaveLength(5);
    for (const sample of channel) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
    expect(channel[1]).toBeCloseTo(0.5, 2);
    expect(channel[2]).toBeCloseTo(-0.5, 2);
  });

  it("builds the buffer at 24 kHz whatever the context runs at", () => {
    const player = createPcmPlayer();
    player.enqueue(pcmBase64([0.1, 0.2]));

    // An AudioBufferSourceNode resamples a buffer whose rate differs from the
    // context, so this needs no branch — but it does need to be declared.
    expect(scheduled[0].source.buffer.sampleRate).toBe(24000);
  });

  it("ignores an empty chunk rather than scheduling silence", () => {
    const player = createPcmPlayer();
    player.enqueue("");

    expect(scheduled).toHaveLength(0);
  });
});

describe("scheduling", () => {
  it("books each chunk where the last one ends", () => {
    const player = createPcmPlayer();
    const chunk = pcmBase64(new Array(2400).fill(0.1)); // 100ms at 24kHz

    player.enqueue(chunk);
    player.enqueue(chunk);

    // Playing each chunk on arrival leaves a seam between every one, and the
    // model's speech comes in many pieces.
    expect(scheduled[0].at).toBe(0);
    expect(scheduled[1].at).toBeCloseTo(0.1, 5);
  });

  it("never books a start time in the past", () => {
    const player = createPcmPlayer();
    player.enqueue(pcmBase64(new Array(2400).fill(0.1)));

    // After a pause the clock has moved on. Booking behind it plays everything
    // at once, in a rush.
    currentTime = 10;
    player.enqueue(pcmBase64(new Array(2400).fill(0.1)));

    expect(scheduled[1].at).toBe(10);
  });
});

describe("how loud the tutor is", () => {
  it("calls a flat 128 silence", () => {
    scopeData = new Uint8Array([128, 128, 128, 128]);
    expect(createPcmPlayer().getLevel()).toBeCloseTo(0, 5);
  });

  it("reads a full-scale signal as near 1", () => {
    // A square wave pinned to both rails: the loudest thing a byte array can
    // describe, and the top of the range the microphone is measured on.
    scopeData = new Uint8Array([255, 1, 255, 1]);
    expect(createPcmPlayer().getLevel()).toBeGreaterThan(0.95);
  });

  it("reads silence where nothing fills the buffer", () => {
    // An empty Uint8Array is all zeros, which is full negative deflection —
    // so a browser that leaves the array alone would otherwise pin the blob
    // at maximum for ever.
    analyserReads = false;
    expect(createPcmPlayer().getLevel()).toBeCloseTo(0, 5);
  });
});

describe("being interrupted", () => {
  it("stops what is playing and forgets the queue", () => {
    const player = createPcmPlayer();
    const chunk = pcmBase64(new Array(2400).fill(0.1));
    player.enqueue(chunk);
    player.enqueue(chunk);

    player.clear();

    for (const { source } of scheduled) expect(source.stop).toHaveBeenCalled();

    // The next chunk starts now, not after the queue that was abandoned.
    currentTime = 5;
    player.enqueue(chunk);
    expect(scheduled[2].at).toBe(5);
  });

  it("survives stopping a source that already finished", () => {
    const player = createPcmPlayer();
    player.enqueue(pcmBase64([0.1, 0.2]));
    scheduled[0].source.stop = () => { throw new Error("already stopped"); };

    expect(() => player.clear()).not.toThrow();
  });
});
