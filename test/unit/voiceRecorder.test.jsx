import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useVoiceRecorder } from "../../src/hooks/useVoiceRecorder";

/**
 * useVoiceRecorder.
 *
 * Most of what matters here is what the hook *stops* doing. The microphone
 * track has to be released after every take, or the browser's recording
 * indicator stays lit and correctly alarms people. And the object URL has to
 * be revoked on reset and on unmount, because that blob is the recording —
 * §2.6 and §6 of the privacy policy promise it is kept only as long as it
 * takes to produce feedback, and having nowhere for it to live is the simplest
 * way to keep that promise.
 */

let stopTrack;
let recorderInstance;

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);

  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "audio/webm";
    this.state = "inactive";
    recorderInstance = this;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["xx"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

/**
 * renderHook rather than a hand-rolled probe component: assigning to a
 * `.current` from inside a render body is exactly what the
 * react-hooks/immutability rule exists to stop.
 */
const mount = () => renderHook(() => useVoiceRecorder());

beforeEach(() => {
  stopTrack = vi.fn();
  recorderInstance = null;

  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

  // Assigned onto the real URL rather than stubbed as a global, and left in
  // place afterwards. jsdom implements neither method, and testing-library's
  // auto-cleanup unmounts *after* vi.unstubAllGlobals has run — so a stubbed
  // URL is already gone by the time the hook's unmount effect revokes its
  // object URL, which is precisely the line these tests exist to check.
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // URL.createObjectURL / revokeObjectURL are deliberately left assigned — see
  // the note in beforeEach. Vitest isolates each test file, so they do not
  // leak anywhere that would notice.
});

describe("a take", () => {
  it("records, then hands back something playable", async () => {
    const { result } = mount();

    await act(async () => { await result.current.start(); });
    expect(result.current.isRecording).toBe(true);

    await act(async () => { result.current.stop(); });

    await waitFor(() => expect(result.current.recording).toBeTruthy());
    expect(result.current.recording.url).toBe("blob:fake-url");
    expect(result.current.isRecording).toBe(false);
  });

  it("releases the microphone as soon as the take ends", async () => {
    const { result } = mount();

    await act(async () => { await result.current.start(); });
    expect(stopTrack).not.toHaveBeenCalled();

    await act(async () => { result.current.stop(); });

    // A live stream keeps the browser's recording indicator on, which is
    // alarming and would be deserved.
    await waitFor(() => expect(stopTrack).toHaveBeenCalled());
  });

  it("keeps the recorder's own mimeType, not the one we asked for", async () => {
    // The browser may ignore the requested container, and the API validates
    // what we actually send.
    const { result } = mount();
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });

    await waitFor(() => expect(result.current.recording).toBeTruthy());
    expect(result.current.recording.mimeType).toBe(recorderInstance.mimeType);
  });

  it("converts to base64 with no data: prefix", async () => {
    const { result } = mount();
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    await waitFor(() => expect(result.current.recording).toBeTruthy());

    const inline = await result.current.toInlineAudio();

    // /api/ask-ai rejects a data: prefix outright.
    expect(inline.data.startsWith("data:")).toBe(false);
    expect(inline.mimeType).toContain("audio/");
  });
});

describe("throwing the take away", () => {
  it("revokes the object URL on reset", async () => {
    const { result } = mount();
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    await waitFor(() => expect(result.current.recording).toBeTruthy());

    await act(async () => { result.current.reset(); });

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    expect(result.current.recording).toBeNull();
  });

  it("revokes it on unmount too", async () => {
    const { result, unmount } = mount();
    await act(async () => { await result.current.start(); });
    await act(async () => { result.current.stop(); });
    await waitFor(() => expect(result.current.recording).toBeTruthy());

    unmount();

    // Navigating away is the commonest way to leave a recording behind.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });
});

describe("when it cannot record", () => {
  it("reports a refused microphone rather than throwing", async () => {
    navigator.mediaDevices.getUserMedia = vi.fn(async () => {
      throw new Error("NotAllowedError");
    });
    const { result } = mount();

    await act(async () => { await result.current.start(); });

    expect(result.current.error).toBe("permission");
    expect(result.current.isRecording).toBe(false);
  });

  it("reports a browser that cannot record at all", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = mount();

    expect(result.current.isSupported).toBe(false);

    await act(async () => { await result.current.start(); });
    expect(result.current.error).toBe("unsupported");
  });

  it("says so when a take produced no audio", async () => {
    const { result } = mount();
    await act(async () => { await result.current.start(); });

    // A stop with no data — what a muted or disconnected device produces.
    await act(async () => {
      recorderInstance.state = "inactive";
      recorderInstance.onstop();
    });

    await waitFor(() => expect(result.current.error).toBe("empty"));
    expect(result.current.recording).toBeNull();
  });
});
