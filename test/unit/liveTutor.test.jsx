import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * The live tutor session.
 *
 * A session owns four things at once — a WebSocket, a microphone track, a
 * capture AudioContext and a playback AudioContext — and leaking any of them is
 * worse than an ordinary leak: a live microphone keeps the browser's recording
 * indicator lit, and an open socket keeps billing. Most of what is pinned here
 * is teardown.
 *
 * The other half is the order things happen in. The token is minted before the
 * microphone is asked for, because minting is the step that can be refused, and
 * prompting somebody for their microphone only to tell them their plan does not
 * allow it is the wrong way round.
 */

const requestLiveToken = vi.fn();
const buildTutorInstructions = vi.fn();
const connectLiveTutor = vi.fn();
const startPcmCapture = vi.fn();
const createPcmPlayer = vi.fn();

vi.mock("../../src/services/liveTutorService", () => ({
  requestLiveToken: (...a) => requestLiveToken(...a),
  buildTutorInstructions: (...a) => buildTutorInstructions(...a),
  connectLiveTutor: (...a) => connectLiveTutor(...a),
}));

vi.mock("../../src/utils/pcmAudio", () => ({
  startPcmCapture: (...a) => startPcmCapture(...a),
  createPcmPlayer: (...a) => createPcmPlayer(...a),
}));

let session;
let capture;
let player;
let callbacks;

const mount = async () => {
  const { useLiveTutor, LIVE_STATUS } = await import("../../src/hooks/useLiveTutor");
  const view = renderHook(() =>
    useLiveTutor({
      user: { token: "tok", uid: "u1", displayName: "Nuno" },
      targetLang: "ja-Hira",
      explanationLang: "pt-PT",
      level: "A2",
    })
  );
  return { ...view, LIVE_STATUS };
};

beforeEach(() => {
  vi.clearAllMocks();

  session = { sendAudio: vi.fn(), close: vi.fn() };
  capture = { stop: vi.fn(async () => {}) };
  player = {
    enqueue: vi.fn(),
    clear: vi.fn(),
    close: vi.fn(async () => {}),
    getLevel: vi.fn(() => 0),
  };

  requestLiveToken.mockResolvedValue({
    token: "ephemeral",
    model: "gemini-live",
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  });
  buildTutorInstructions.mockResolvedValue({ instructions: "be a tutor", model: "from-prompt" });
  connectLiveTutor.mockImplementation(async (params) => {
    callbacks = params;
    return session;
  });
  startPcmCapture.mockResolvedValue(capture);
  createPcmPlayer.mockReturnValue(player);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("starting a session", () => {
  it("mints the token before touching the microphone", async () => {
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    // Prompting for a microphone and then refusing the session is the wrong
    // way round; minting is the step that can say no.
    expect(requestLiveToken).toHaveBeenCalledBefore(startPcmCapture);
    expect(result.current.status).toBe("live");
  });

  it("uses the model the server locked the token to", async () => {
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    // The prompt document also names one, but the server's choice is baked
    // into the token — connecting with anything else is refused, not swapped.
    expect(connectLiveTutor.mock.calls[0][0].model).toBe("gemini-live");
  });

  it("asks for a token for the model the prompt document names", async () => {
    // The model is configured on `live-tutor-prompt` and travels to the API
    // the same way providerParams.model travels to ask-ai. Drop this argument
    // and nothing visibly breaks — the endpoint just falls back and quietly
    // ignores whatever Admin chose, which is the regression worth a test.
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    expect(requestLiveToken).toHaveBeenCalledWith("tok", "from-prompt");
  });

  it("reads the prompt document before minting, and both before the microphone", async () => {
    // Minting is for a specific model, so the model has to be known first.
    // The ordering that matters is unchanged: nothing touches the mic until
    // the step that can refuse the session has run.
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    expect(buildTutorInstructions).toHaveBeenCalledBefore(requestLiveToken);
    expect(requestLiveToken).toHaveBeenCalledBefore(startPcmCapture);
  });

  it("pipes microphone chunks into the session", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    startPcmCapture.mock.calls[0][0].onChunk("AAAA");

    expect(session.sendAudio).toHaveBeenCalledWith("AAAA");
  });

  it("queues the model's audio for playback", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    act(() => { callbacks.onAudio("BBBB"); });

    expect(player.enqueue).toHaveBeenCalledWith("BBBB");
    expect(result.current.isSpeaking).toBe(true);
  });
});

describe("being interrupted", () => {
  it("drops everything already queued", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });
    act(() => { callbacks.onAudio("BBBB"); });

    act(() => { callbacks.onInterrupted(); });

    // Whatever was queued is a sentence the learner has moved past. Playing it
    // out would be the tutor talking over them.
    expect(player.clear).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });
});

describe("the transcript", () => {
  it("joins consecutive fragments from the same speaker into one turn", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    act(() => {
      callbacks.onTranscript("Olá", false);
      callbacks.onTranscript(", tudo bem?", false);
    });

    // Transcripts arrive as fragments, not sentences. A bubble per fragment
    // shreds one sentence into a dozen lines.
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0].text).toBe("Olá, tudo bem?");
  });

  it("starts a new turn when the speaker changes", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    act(() => {
      callbacks.onTranscript("Olá", false);
      callbacks.onTranscript("oi", true);
    });

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[1].isUser).toBe(true);
  });
});

describe("tearing it down", () => {
  it("releases the microphone, the socket and the player", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => { await result.current.stop(); });

    expect(capture.stop).toHaveBeenCalled();
    expect(session.close).toHaveBeenCalled();
    expect(player.close).toHaveBeenCalled();
    expect(result.current.status).toBe("ended");
  });

  it("releases the microphone first", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => { await result.current.stop(); });

    // If anything later throws, the one thing that must not survive is an
    // open mic.
    expect(capture.stop).toHaveBeenCalledBefore(session.close);
  });

  it("does it again on unmount", async () => {
    const { result, unmount } = await mount();
    await act(async () => { await result.current.start(); });

    unmount();

    await waitFor(() => expect(capture.stop).toHaveBeenCalled());
  });

  it("is idempotent", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => {
      await result.current.stop();
      await result.current.stop();
    });

    expect(session.close).toHaveBeenCalledTimes(1);
  });
});

describe("ending itself", () => {
  /**
   * These are the only brake there is. `/api/live-token` mints one token and
   * then loses sight of the session entirely — it cannot count minutes, end a
   * call, or know one is still open — so a tab left on a forgotten conversation
   * holds a microphone and a billed socket until the laptop sleeps.
   */
  it("closes after silence on both sides", async () => {
    vi.useFakeTimers();
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });

    expect(result.current.status).toBe("ended");
    expect(result.current.endedBy).toBe("idle");
    expect(capture.stop).toHaveBeenCalled();
  });

  it("counts the tutor talking as the conversation being alive", async () => {
    vi.useFakeTimers();
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    // Someone listening to a long explanation is not idle, and the audio
    // arriving is the proof — which is why this is read from the socket rather
    // than from anything on screen.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    act(() => { callbacks.onAudio("BBBB"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(result.current.status).toBe("live");
  });

  it("counts the learner talking too", async () => {
    vi.useFakeTimers();
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    act(() => { startPcmCapture.mock.calls[0][0].onLevel(0.4); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(result.current.status).toBe("live");
  });

  it("ignores room noise when deciding nobody is there", async () => {
    vi.useFakeTimers();
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    // An open microphone is never truly silent. If a fan counted as speech
    // the idle timeout would never fire, which is the whole point of it.
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    act(() => { startPcmCapture.mock.calls[0][0].onLevel(0.004); });
    await act(async () => { await vi.advanceTimersByTimeAsync(40_000); });

    expect(result.current.status).toBe("ended");
    expect(result.current.endedBy).toBe("idle");
  });

  it("stops when the token the server minted runs out", async () => {
    vi.useFakeTimers();
    requestLiveToken.mockResolvedValue({
      token: "ephemeral",
      model: "gemini-live",
      expiresAt: new Date(Date.now() + 30_000).toISOString(),
    });
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });

    expect(result.current.endedBy).toBe("limit");
  });

  it("caps the session even when the server says nothing", async () => {
    // An older deployment of /api/live-token returns no expiry. Running until
    // Google hangs up unexplained is worse than a ceiling of our own.
    requestLiveToken.mockResolvedValue({ token: "ephemeral", model: "gemini-live" });
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    expect(result.current.secondsLeft).toBeGreaterThan(0);
    expect(result.current.secondsLeft).toBeLessThanOrEqual(15 * 60);
  });

  it("does not let a click event become the reason it ended", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    // `stop` is wired to a button, and a React event landing in `endedBy`
    // would render as no explanation at all.
    await act(async () => { await result.current.stop({ type: "click" }); });

    expect(result.current.endedBy).toBe("user");
  });
});

describe("what the blob is drawn from", () => {
  it("reports both voices on demand", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    player.getLevel.mockReturnValue(0.3);
    act(() => { startPcmCapture.mock.calls[0][0].onLevel(0.12); });

    // Pulled, not pushed: this changes about fifteen times a second, and
    // pushing it through state would re-render the transcript every time.
    expect(result.current.getAudioLevels()).toEqual({ mic: 0.12, tutor: 0.3 });
  });

  it("reads as silent once the session is gone", async () => {
    const { result } = await mount();
    await act(async () => { await result.current.start(); });
    act(() => { startPcmCapture.mock.calls[0][0].onLevel(0.5); });

    await act(async () => { await result.current.stop(); });

    expect(result.current.getAudioLevels()).toEqual({ mic: 0, tutor: 0 });
  });
});

describe("when it cannot start", () => {
  it("unwinds whatever opened before the failure", async () => {
    // The player is created before the socket, so a failed connect must still
    // take it down.
    connectLiveTutor.mockRejectedValue(new Error("refused"));
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    expect(player.close).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBe("refused");
  });

  it("never opens the microphone when the plan is refused", async () => {
    requestLiveToken.mockRejectedValue(new Error("Your plan does not include live conversation"));
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    expect(startPcmCapture).not.toHaveBeenCalled();
    expect(result.current.error).toContain("plan");
  });
});

describe("what reaches the connection, and how it ends", () => {
  it("passes the thinking level from the prompt document to the connection", async () => {
    // gemini-3.8-live-extended-thinking refuses any session that does not name
    // one — 1007 within 300 ms. Resolved once, off the same prompt read as
    // the model, and dropping it here would bring that refusal straight back.
    buildTutorInstructions.mockResolvedValue({
      instructions: "be a tutor", model: "from-prompt", thinkingLevel: "LOW",
    });
    const { result } = await mount();

    await act(async () => { await result.current.start(); });

    expect(connectLiveTutor.mock.calls[0][0].thinkingLevel).toBe("LOW");
  });

  it("says the line dropped when Google hangs up, not that the learner stopped", async () => {
    // Every close used to read as END_REASON.USER, so a session the server
    // ended looked exactly like one the learner finished on purpose.
    const { result } = await mount();
    await act(async () => { await result.current.start(); });

    await act(async () => { callbacks.onClose({ code: 1011, reason: "Internal error" }); });

    await waitFor(() => expect(result.current.status).toBe("ended"));
    expect(result.current.endedBy).toBe("dropped");
  });
});

describe("the chosen voice", () => {
  it("goes to the connection, and never into the instructions", async () => {
    // The prompt is the admin's, word for word. The voice is a setting on the
    // connection, not something the tutor is told.
    const { useLiveTutor } = await import("../../src/hooks/useLiveTutor");
    const { result } = renderHook(() =>
      useLiveTutor({
        user: { token: "tok", uid: "u1", displayName: "Nuno" },
        targetLang: "pt-PT",
        explanationLang: "en-US",
        level: "A2",
        voice: "Charon",
      })
    );

    await act(async () => { await result.current.start(); });

    expect(connectLiveTutor.mock.calls[0][0].voice).toBe("Charon");
    expect(buildTutorInstructions.mock.calls[0][0]).not.toHaveProperty("voice");
  });
});
