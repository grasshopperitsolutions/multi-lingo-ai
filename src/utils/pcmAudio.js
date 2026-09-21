/**
 * pcmAudio.js
 *
 * Microphone in and speaker out for a live conversation, in the one format the
 * Live API speaks: **raw little-endian 16-bit PCM, 16 kHz up, 24 kHz down.**
 *
 * None of the pronunciation feature transfers here, and it is worth knowing
 * why before someone tries to share code. `MediaRecorder` produces a
 * *container* — webm/opus, ogg/opus, mp4 — which is right for "record a take
 * and send the file" and useless for "stream what I am saying right now":
 * containers are chunked for storage, not for latency, and the Live API will
 * not read one. This reads the raw sample buffer instead.
 *
 * Two AudioContexts, deliberately. Capture has to run at 16 kHz and playback
 * arrives at 24 kHz, and a single context cannot be both.
 */

/** 64 ms at 16 kHz. Small enough to feel live, large enough not to flood the socket. */
const CAPTURE_FRAME_SAMPLES = 1024;

const CAPTURE_RATE = 16000;
const PLAYBACK_RATE = 24000;

/**
 * The worklet, as source, turned into a module at runtime.
 *
 * A Blob URL rather than a separate `.js` file so this stays one
 * self-contained module: an AudioWorklet must be loaded from a URL, and a real
 * file would mean a build asset whose path has to survive Vite, the GitHub
 * Pages base path, and anyone moving the file.
 *
 * It only buffers and forwards. Converting to Int16 here would be marginally
 * cheaper, but the main thread is where the context's real sample rate is
 * known, and that is what decides whether a resample is needed.
 */
const WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(${CAPTURE_FRAME_SAMPLES});
    this._offset = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    // No input yet is normal on the first render quanta; returning false would
    // tear the processor down permanently.
    if (!channel) return true;

    for (let i = 0; i < channel.length; i += 1) {
      this._buffer[this._offset] = channel[i];
      this._offset += 1;
      if (this._offset === this._buffer.length) {
        this.port.postMessage(this._buffer.slice());
        this._offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

/** Float32 [-1, 1] → little-endian PCM16, then base64. */
function floatsToBase64Pcm16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    // Clamped before scaling: a sample above 1 would wrap to a large negative
    // number and arrive as a click.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  // Chunked rather than one spread: String.fromCharCode(...bytes) blows the
  // argument limit on anything but a tiny frame.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** base64 little-endian PCM16 → Float32 [-1, 1]. */
function base64Pcm16ToFloats(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const floats = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) floats[i] = pcm[i] / 0x8000;
  return floats;
}

/**
 * Linear resample. Crude by the standards of audio engineering and entirely
 * adequate here: the source is a browser's own capture rate (usually 48 kHz)
 * and the destination is 16 kHz speech that a model listens to rather than a
 * person. A proper windowed-sinc filter would cost more than it returns.
 */
function resample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const next = Math.min(index + 1, samples.length - 1);
    const weight = position - index;
    out[i] = samples[index] * (1 - weight) + samples[next] * weight;
  }
  return out;
}

/**
 * How loud a frame is, 0..1-ish. Ordinary speech sits around 0.05-0.2.
 *
 * Computed from the frame the worklet already sent rather than from a second
 * AnalyserNode on the capture graph: the samples are in hand, so an analyser
 * would be a second copy of the same signal for no gain.
 */
function rootMeanSquare(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/**
 * Open the microphone and call `onChunk` with base64 PCM16 at 16 kHz.
 *
 * `onLevel` receives the loudness of each frame — once per frame, so about
 * fifteen times a second. That is coarse for an animation and deliberately not
 * smoothed here: the caller drawing it knows its own frame rate and can ease
 * towards the value, where this module would only be guessing.
 *
 * @param {{onChunk: (base64: string) => void, onLevel?: (level: number) => void}} options
 * @returns {Promise<{stop: () => Promise<void>}>}
 */
export async function startPcmCapture({ onChunk, onLevel }) {
  // Asked for at the source as well as resampled afterwards: a browser that
  // honours the constraint saves the resample entirely, and the echo and noise
  // options matter far more here than in a one-take recording — without echo
  // cancellation the model hears itself through the speakers and answers it.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: CAPTURE_RATE,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const context = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: CAPTURE_RATE,
  });
  // Safari and some Chromium builds ignore the requested rate, so the real one
  // is read back rather than assumed — this is what decides the resample.
  const actualRate = context.sampleRate;

  const workletUrl = URL.createObjectURL(
    new Blob([WORKLET_SOURCE], { type: "application/javascript" })
  );

  try {
    await context.audioWorklet.addModule(workletUrl);
  } finally {
    // The module is compiled by now; holding the URL only leaks it.
    URL.revokeObjectURL(workletUrl);
  }

  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "pcm-capture");

  node.port.onmessage = (event) => {
    const floats = resample(event.data, actualRate, CAPTURE_RATE);
    onChunk(floatsToBase64Pcm16(floats));
    // Measured before the resample: same energy, and it costs nothing to read
    // the frame that is already here.
    onLevel?.(rootMeanSquare(event.data));
  };

  source.connect(node);
  // Connected to the destination because some browsers will not pull from a
  // graph with no sink. The node emits nothing, so this makes no sound.
  node.connect(context.destination);

  return {
    async stop() {
      node.port.onmessage = null;
      node.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close().catch(() => {});
    },
  };
}

/**
 * Plays 24 kHz PCM16 chunks in the order they arrive, without gaps.
 *
 * Scheduling matters more than it looks: playing each chunk on arrival leaves
 * a seam between every one, and the model's speech comes in many small pieces.
 * Each is booked to start where the last one ends.
 *
 * @returns {{enqueue: (base64: string) => void, getLevel: () => number, clear: () => void, close: () => Promise<void>}}
 */
export function createPcmPlayer() {
  const context = new (window.AudioContext || window.webkitAudioContext)();
  let nextStartAt = 0;
  let sources = [];

  /**
   * Everything plays through an analyser so the page can show the tutor's
   * voice *as it is heard*.
   *
   * Measuring the chunks on the way in would have been easier and wrong: they
   * are booked ahead of time, sometimes seconds ahead, so the meter would move
   * before the sound came out of the speakers.
   */
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.6;
  analyser.connect(context.destination);

  // 128 is silence in a time-domain byte array. Starting at zero would read as
  // full scale until the first sample arrives — or for ever, if this is
  // running somewhere `getByteTimeDomainData` does nothing.
  const scope = new Uint8Array(analyser.fftSize).fill(128);

  return {
    enqueue(base64) {
      const floats = base64Pcm16ToFloats(base64);
      if (floats.length === 0) return;

      // Built at 24 kHz whatever the context runs at — an AudioBufferSourceNode
      // resamples a buffer whose rate differs, so this needs no branch.
      const buffer = context.createBuffer(1, floats.length, PLAYBACK_RATE);
      buffer.copyToChannel(floats, 0);

      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);

      // Never in the past: after a pause the clock has moved on, and booking a
      // start time behind it plays everything at once.
      const startAt = Math.max(context.currentTime, nextStartAt);
      source.start(startAt);
      nextStartAt = startAt + buffer.duration;

      sources.push(source);
      source.onended = () => {
        sources = sources.filter((s) => s !== source);
      };
    },

    /**
     * How loud the tutor is right now, on the same 0..1-ish scale the
     * microphone reports — so one threshold covers both voices.
     *
     * Pulled rather than pushed: whoever is drawing already has a frame loop,
     * and a callback per audio frame would fire on a schedule nothing on
     * screen is aligned to.
     */
    getLevel() {
      analyser.getByteTimeDomainData(scope);
      let sum = 0;
      for (let i = 0; i < scope.length; i += 1) {
        const deviation = (scope[i] - 128) / 128;
        sum += deviation * deviation;
      }
      return Math.sqrt(sum / scope.length);
    },

    /**
     * Stop mid-sentence and drop what is queued. This is what makes being
     * interrupted work: the model is told the user spoke, and everything it
     * had already sent has to stop coming out of the speakers.
     */
    clear() {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          /* already finished */
        }
      });
      sources = [];
      nextStartAt = 0;
    },

    async close() {
      this.clear();
      await context.close().catch(() => {});
    },
  };
}
