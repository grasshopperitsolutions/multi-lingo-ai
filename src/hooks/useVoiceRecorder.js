import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useVoiceRecorder
 *
 * Records one take from the microphone, hands back something playable and
 * something sendable, and throws the take away when asked.
 *
 * **The recording never reaches a server.** It lives as a Blob here and as an
 * object URL for the audio element; `reset` revokes the URL and drops the
 * blob, and unmounting does the same. The only copy that leaves the device is
 * the one attached inline to the feedback request, which is written nowhere.
 *
 * A copy may outlive the page, but not this hook's doing: the caller can hand
 * the most recent take to `utils/recordingStore` so a reload or a failed
 * request does not cost somebody their reading, and hand it back through
 * `adopt`. That copy stays in the reader's own browser under their control —
 * the distinction §6 of the privacy policy draws between what *we* retain and
 * what their device holds.
 *
 * **The microphone track is stopped after every take.** A live `MediaStream`
 * keeps the browser's recording indicator lit, which correctly alarms people;
 * a fresh `getUserMedia` per take costs nothing after the first grant, because
 * the permission is remembered and only the device is reacquired.
 */

/**
 * Preference order for the container, best-supported first.
 *
 * Chrome and Edge produce webm/opus, Firefox ogg/opus, Safari mp4. All three
 * are formats Gemini accepts, so nothing is transcoded — which is the whole
 * reason this is a thin wrapper rather than an encoder. `isTypeSupported` is
 * consulted rather than assumed because Safari only grew it recently and a
 * wrong guess fails at `start()`, after the permission prompt.
 */
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/ogg;codecs=opus",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
];

/** Long enough for any passage this app hands out, short enough to stay small. */
export const MAX_RECORDING_MS = 90_000;

/** Picks the first container this browser will actually record. */
function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of PREFERRED_TYPES) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  // Recording with no explicit type is still valid — the browser picks its own
  // and reports it on the blob. Better than refusing to record at all.
  return "";
}

/** Base64 without the `data:` prefix, which is what /api/ask-ai requires. */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the recording"));
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recording, setRecording] = useState(null); // { blob, url, mimeType, durationMs }
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef(0);
  const stopTimerRef = useRef(0);
  // Survives the unmount cleanup closure, which cannot see the latest state.
  const urlRef = useRef(null);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    clearInterval(tickRef.current);
    clearTimeout(stopTimerRef.current);
    tickRef.current = 0;
    stopTimerRef.current = 0;
  }, []);

  /** Drop the take. Revoking the object URL is what actually frees the audio. */
  const reset = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setRecording(null);
    setElapsedMs(0);
    setError(null);
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop(); // onstop assembles the blob
    }
  }, [clearTimers]);

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("unsupported");
      return;
    }
    reset();

    let stream;
    try {
      // Asked for per take rather than held open, so the browser's recording
      // indicator is lit only while something is actually being recorded.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, dismissed, or no device — indistinguishable in practice and
      // the remedy is the same, so they share one message.
      setError("permission");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      releaseStream();
      setError("unsupported");
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      clearTimers();
      releaseStream();
      setIsRecording(false);

      // The recorder's own type is authoritative — the browser may have
      // ignored the requested one.
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];

      if (blob.size === 0) {
        setError("empty");
        return;
      }

      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setRecording({
        blob,
        url,
        mimeType: type,
        durationMs: Date.now() - startedAtRef.current,
      });
    };

    startedAtRef.current = Date.now();
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setElapsedMs(0);

    tickRef.current = setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      200
    );
    // A hard stop, so forgetting to press it cannot produce a recording too
    // large for the request body.
    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, MAX_RECORDING_MS);
  }, [isSupported, reset, releaseStream, clearTimers]);

  /**
   * Take on a recording that already exists — one restored from the browser
   * after a reload. The hook owns the object URL either way, so a restored
   * take is revoked on reset and on unmount exactly like a fresh one.
   */
  const adopt = useCallback((blob, mimeType) => {
    if (!blob) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    setError(null);
    setRecording({ blob, url, mimeType: mimeType || blob.type || "audio/webm", durationMs: 0 });
  }, []);

  /** The take as `{ data, mimeType }`, ready for askAI's `audio` option. */
  const toInlineAudio = useCallback(async () => {
    if (!recording?.blob) return null;
    return {
      data: await blobToBase64(recording.blob),
      // Sent with the codec parameter intact; the API strips it before
      // checking, and the model is happy either way.
      mimeType: recording.mimeType,
    };
  }, [recording]);

  useEffect(
    () => () => {
      clearTimers();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [clearTimers]
  );

  return {
    isSupported,
    isRecording,
    elapsedMs,
    recording,
    error,
    start,
    stop,
    reset,
    adopt,
    toInlineAudio,
  };
}
