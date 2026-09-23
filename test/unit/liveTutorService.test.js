import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * liveTutorService — what the browser tells Google, and what it hears back.
 *
 * Two faults hid behind one symptom here: the tutor "worked, then ended
 * immediately". The model refused every session for want of a thinking level,
 * and the reason — Google's close frame — was thrown away, so nothing said so.
 * These pin the thinking level, and that a refusal now explains itself instead
 * of leaving `connect` waiting for ever.
 *
 * The SDK is faked at the point this service uses it. Its `live.connect` only
 * resolves after the server acknowledges the setup, which is exactly the
 * behaviour a refused session exposes, so the fake reproduces that: it hands
 * back a promise the test settles, or leaves unsettled.
 */

const sdk = vi.hoisted(() => ({ connectArgs: null, resolve: null, session: null }));
const getPrompt = vi.hoisted(() => vi.fn());
const captureMessage = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  Modality: { AUDIO: "AUDIO" },
  GoogleGenAI: class {
    constructor() {
      this.live = {
        connect: (args) => {
          sdk.connectArgs = args;
          return new Promise((resolve) => { sdk.resolve = () => resolve(sdk.session); });
        },
      };
    }
  },
}));

vi.mock("../../src/services/promptService", () => ({
  getPrompt: (...a) => getPrompt(...a),
  renderTemplate: (template, vars) =>
    String(template).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)),
}));

vi.mock("../../src/services/apiClient", () => ({ apiFetch: vi.fn() }));

vi.mock("../../src/sentry", () => ({
  Sentry: { captureMessage: (...a) => captureMessage(...a) },
}));

const TEMPLATE = "Teach {{targetLang}} at {{level}}, explaining in {{explanationLang}}.";
const PARAMS = { targetLang: "pt-PT", explanationLang: "en-US", level: "A2" };

async function service() {
  return import("../../src/services/liveTutorService");
}

/** Start a connection and wait for the fake SDK to be reached. */
async function connecting(overrides = {}) {
  const { connectLiveTutor } = await service();
  const handlers = { onAudio: vi.fn(), onClose: vi.fn() };
  const pending = connectLiveTutor({
    liveToken: "auth_tokens/abc",
    model: "gemini-3.8-live-extended-thinking",
    thinkingLevel: "LOW",
    instructions: "be a tutor",
    ...handlers,
    ...overrides,
  });
  await vi.waitFor(() => expect(sdk.connectArgs).toBeTruthy());
  return { pending, handlers, callbacks: sdk.connectArgs.callbacks };
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.connectArgs = null;
  sdk.resolve = null;
  sdk.session = { sendRealtimeInput: vi.fn(), close: vi.fn() };
  getPrompt.mockResolvedValue({ template: TEMPLATE, model: "" });
});

describe("buildTutorInstructions — the thinking level", () => {
  it("pairs the fallback model with the level it requires", async () => {
    // The live prompt document names no model, so the extended-thinking
    // fallback runs — and it refuses every session without a thinking level.
    const { buildTutorInstructions } = await service();

    const built = await buildTutorInstructions(PARAMS);

    expect(built.model).toBe("gemini-3.8-live-extended-thinking");
    expect(built.thinkingLevel).toBe("LOW");
  });

  it("sends none when Admin names a model but no level", async () => {
    // A model named on the prompt owns its thinking level. Guessing one from
    // the model's name is how a non-thinking model gets refused for being
    // sent a setting it does not take.
    getPrompt.mockResolvedValue({ template: TEMPLATE, model: "gemini-3.8-live" });
    const { buildTutorInstructions } = await service();

    expect((await buildTutorInstructions(PARAMS)).thinkingLevel).toBe("");
  });

  it("accepts the level in whatever case it was typed", async () => {
    // It is typed by hand into Admin's raw-JSON box; the wire wants upper case.
    getPrompt.mockResolvedValue({ template: TEMPLATE, model: "x", thinkingLevel: " medium " });
    const { buildTutorInstructions } = await service();

    expect((await buildTutorInstructions(PARAMS)).thinkingLevel).toBe("MEDIUM");
  });

  it("warns about a level that does not exist, rather than letting Google refuse it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getPrompt.mockResolvedValue({ template: TEMPLATE, model: "x", thinkingLevel: "turbo" });
    const { buildTutorInstructions } = await service();

    expect((await buildTutorInstructions(PARAMS)).thinkingLevel).toBe("");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("turbo"));

    warn.mockRestore();
  });
});

describe("connectLiveTutor — what is sent", () => {
  it("asks for the thinking level it was given", async () => {
    const { pending } = await connecting();
    sdk.resolve();
    await pending;

    expect(sdk.connectArgs.config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
  });

  it("sends no thinking config at all for a model that does not think", async () => {
    const { pending } = await connecting({ thinkingLevel: "" });
    sdk.resolve();
    await pending;

    expect(sdk.connectArgs.config).not.toHaveProperty("thinkingConfig");
  });

  it("still sends the tutor's instructions and both transcriptions", async () => {
    // These only reach the model because /api/live-token sends a fieldMask;
    // without one the token's setup replaced them and the tutor had no
    // persona. The browser half of that contract is that it keeps sending them.
    const { pending } = await connecting();
    sdk.resolve();
    await pending;

    expect(sdk.connectArgs.config).toMatchObject({
      systemInstruction: "be a tutor",
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    });
  });
});

describe("connectLiveTutor — how it ends", () => {
  it("rejects with Google's reason when the setup is refused", async () => {
    // The reported symptom. The SDK's connect never settles when the server
    // closes before acknowledging the setup, so without the race this waited
    // for ever while the page showed an ordinary ending.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { pending, callbacks } = await connecting({ thinkingLevel: "" });

    callbacks.onclose({ code: 1007, reason: "Thinking level must be specified for this model." });

    await expect(pending).rejects.toThrow("Thinking level must be specified for this model.");
    await expect(pending).rejects.toMatchObject({ code: 1007 });
    expect(captureMessage).toHaveBeenCalledWith(
      "live_session_refused",
      expect.objectContaining({ extra: expect.objectContaining({ code: 1007 }) }),
    );
  });

  it("hands a mid-lesson drop to the caller, and reports it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { pending, handlers, callbacks } = await connecting();
    sdk.resolve();
    await pending;

    callbacks.onclose({ code: 1011, reason: "Internal error" });

    expect(handlers.onClose).toHaveBeenCalledWith({ code: 1011, reason: "Internal error" });
    expect(captureMessage).toHaveBeenCalledWith("live_session_dropped", expect.anything());
  });

  it("does not report a lesson the learner ended themselves", async () => {
    // Our own close() comes back as 1005 more often than 1000. Reporting every
    // finished lesson would bury the ones that actually broke.
    const { pending, handlers, callbacks } = await connecting();
    sdk.resolve();
    const session = await pending;

    session.close();
    callbacks.onclose({ code: 1005, reason: "" });

    expect(handlers.onClose).toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("does not report a clean close from the other end either", async () => {
    const { pending, callbacks } = await connecting();
    sdk.resolve();
    await pending;

    callbacks.onclose({ code: 1000, reason: "" });

    expect(captureMessage).not.toHaveBeenCalled();
  });
});

describe("the tutor's voice", () => {
  it("asks Google for the voice the learner picked", async () => {
    const { pending } = await connecting({ voice: "Charon" });
    sdk.resolve();
    await pending;

    expect(sdk.connectArgs.config.speechConfig).toEqual({
      voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } },
    });
  });

  it("sends no voice rather than an unknown one", async () => {
    // Google accepts a name it does not know and speaks in some default,
    // measured at 218 Hz for "NotARealVoice", so a stale or misspelt name
    // would give the learner a different voice from the one they chose, with
    // nothing to say so. Only names from the list go out.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { pending } = await connecting({ voice: "NotARealVoice" });
    sdk.resolve();
    await pending;

    expect(sdk.connectArgs.config).not.toHaveProperty("speechConfig");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("NotARealVoice"));
    warn.mockRestore();
  });

  it("leaves the instructions exactly as the template renders them", async () => {
    // Every word the tutor is given comes from live-tutor-prompt, so whoever
    // reads it in Admin is reading all of it. The voice goes to the
    // connection and never into the prompt; nothing is appended in code.
    const { buildTutorInstructions } = await service();

    const { instructions } = await buildTutorInstructions({ ...PARAMS, voice: "Sulafat" });

    expect(instructions).toBe("Teach pt-PT at A2, explaining in en-US.");
  });
});
