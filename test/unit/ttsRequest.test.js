import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Gemini 3.8 TTS takes the text as a verbatim transcript and the directions
 * separately. Wrapping instructions around the text, as the 2.5 and 3.1 models
 * allowed, makes every clip read the instructions aloud — so these pin that the
 * transcript and the style never mix, and that the request carries both.
 */

const askAI = vi.fn(async () => ({ audioData: "AAAA", mimeType: "audio/mpeg" }));
vi.mock("../../src/services/aiService", () => ({
  askAI: (...a) => askAI(...a),
}));

const getPrompt = vi.fn();
vi.mock("../../src/services/promptService", async (importOriginal) => ({
  ...(await importOriginal()),
  getPrompt: (...a) => getPrompt(...a),
}));

import { speak, stopSpeaking, stripInlineTags, isRawPcmMime, SPEECH_PACE } from "../../src/services/getTtsService";

const STYLE_TEMPLATE =
  "Read aloud in {{language}} with a natural accent from {{region}}, at a {{speechPace}} pace.";

/** An <audio> that finishes the moment it is asked to play. */
class InstantAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
  }
  play() {
    this.paused = false;
    queueMicrotask(() => this.onended?.());
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

let n = 0;
/** Each test speaks a different word: the in-memory clip cache is per module. */
const word = () => `palavra${++n}`;

beforeEach(() => {
  askAI.mockClear();
  getPrompt.mockReset();
  getPrompt.mockResolvedValue({
    id: "tts-build-prompt",
    template: STYLE_TEMPLATE,
    model: "gemini-3.8-flash-tts",
    explorerModel: "gemini-3.8-flash-lite-tts",
  });
  vi.stubGlobal("Audio", InstantAudio);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  stopSpeaking();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the request keeps the transcript and the style apart", () => {
  it("sends the text alone as the prompt and the rendered template as the style", async () => {
    const text = word();
    await speak(text, "pt-PT", { token: "t" });

    const [, prompt, params] = askAI.mock.calls[0];
    expect(prompt).toBe(text);
    expect(params.ttsStyle).toBe(
      "Read aloud in European Portuguese with a natural accent from Portugal, at a natural pace.",
    );
    expect(params.tts).toBe(true);
  });

  it("never lets the direction into the transcript", async () => {
    const text = word();
    await speak(text, "pt-PT", { token: "t" });

    const [, prompt] = askAI.mock.calls[0];
    expect(prompt).not.toMatch(/Read aloud|accent|pace|Portuguese/i);
  });

  it("puts the region and the pace in the style, so they still shape the reading", async () => {
    await speak(word(), "pt-BR", { token: "t", pace: SPEECH_PACE.SLOW });

    const params = askAI.mock.calls[0][2];
    expect(params.ttsStyle).toMatch(/Brazil/);
    expect(params.ttsStyle).toMatch(/slow, deliberate/);
  });

  it("passes both models and the feature through, as before", async () => {
    await speak(word(), "pt-PT", { token: "t" });

    expect(askAI.mock.calls[0][2]).toMatchObject({
      provider: "gemini",
      model: "gemini-3.8-flash-tts",
      explorerModel: "gemini-3.8-flash-lite-tts",
      feature: "tts-build-prompt",
    });
  });

  it("falls back to the 3.8 model when the prompt names none", async () => {
    getPrompt.mockResolvedValue({ id: "tts-build-prompt", template: STYLE_TEMPLATE });
    await speak(word(), "pt-PT", { token: "t" });

    expect(askAI.mock.calls[0][2].model).toBe("gemini-3.8-flash-tts");
  });
});

describe("guards on the template", () => {
  it("warns when the template still contains {{text}}, and does not fill it", async () => {
    getPrompt.mockResolvedValue({
      id: "tts-build-prompt",
      template: "Read this in {{language}} at a {{speechPace}} pace: {{text}}",
    });
    const text = word();
    await speak(text, "pt-PT", { token: "t" });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("{{text}}"));
    // The words stay out of the direction, so the model never reads them twice.
    const params = askAI.mock.calls[0][2];
    expect(params.ttsStyle).not.toContain(text);
    expect(params.ttsStyle).toContain("{{text}}");
  });

  it("does not warn about {{text}} for a template that is only a style", async () => {
    await speak(word(), "pt-PT", { token: "t" });

    const warned = console.warn.mock.calls.map((c) => String(c[0]));
    expect(warned.some((m) => m.includes("{{text}}"))).toBe(false);
  });

  it("still warns when a slow reading has no {{speechPace}} to change", async () => {
    getPrompt.mockResolvedValue({ id: "tts-build-prompt", template: "Read in {{language}}." });
    await speak(word(), "pt-PT", { token: "t", pace: SPEECH_PACE.SLOW });

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("{{speechPace}}"));
  });
});

describe("stripInlineTags", () => {
  it("removes <tags>, which 3.8 acts on instead of speaking", () => {
    expect(stripInlineTags("Olá <laugh> mundo")).toBe("Olá mundo");
    expect(stripInlineTags("<whisper>segredo</whisper>")).toBe("segredo");
  });

  it("removes |backchannels| with their contents", () => {
    expect(stripInlineTags("Sim |mm-hm| claro")).toBe("Sim claro");
  });

  it("drops a lone pipe", () => {
    expect(stripInlineTags("um | dois")).toBe("um dois");
  });

  it("leaves ordinary comparisons alone", () => {
    expect(stripInlineTags("3 < 5 e 7 > 4")).toBe("3 < 5 e 7 > 4");
  });

  it("keeps accents, punctuation and line breaks", () => {
    expect(stripInlineTags("Olá, como estás?\n\nEstou bem.")).toBe("Olá, como estás?\n\nEstou bem.");
  });

  it("is a no-op on plain text and tolerates nothing at all", () => {
    expect(stripInlineTags("casa")).toBe("casa");
    expect(stripInlineTags(undefined)).toBe("");
  });

  it("is applied to the transcript that is sent", async () => {
    await speak("Olá <laugh> mundo", "pt-PT", { token: "t" });

    expect(askAI.mock.calls[0][1]).toBe("Olá mundo");
  });

  it("sends nothing when the text was only markup", async () => {
    getPrompt.mockResolvedValue({ id: "tts-build-prompt", template: STYLE_TEMPLATE });
    await speak("<laugh>", "pt-PT", { token: "t", preferFallback: false });

    expect(askAI).not.toHaveBeenCalled();
  });
});

describe("isRawPcmMime", () => {
  it("is true for headerless PCM only", () => {
    expect(isRawPcmMime("audio/L16;codec=pcm;rate=24000")).toBe(true);
    expect(isRawPcmMime("audio/L16")).toBe(true);
  });

  it("is false for a WAV, even one labelled with codec=pcm", () => {
    expect(isRawPcmMime("audio/wav")).toBe(false);
    expect(isRawPcmMime("audio/x-wav")).toBe(false);
    expect(isRawPcmMime("audio/wav;codec=pcm")).toBe(false);
    expect(isRawPcmMime("audio/wave;codec=pcm;rate=24000")).toBe(false);
  });

  it("is false for compressed audio and for nothing", () => {
    expect(isRawPcmMime("audio/mpeg")).toBe(false);
    expect(isRawPcmMime(undefined)).toBe(false);
  });
});
