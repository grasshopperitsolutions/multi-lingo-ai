import { useCallback, useEffect, useRef, useState } from "react";
import { startPcmCapture, createPcmPlayer } from "../utils/pcmAudio";
import {
  requestLiveToken,
  buildTutorInstructions,
  connectLiveTutor,
} from "../services/liveTutorService";

/**
 * useLiveTutor
 *
 * Holds one spoken conversation: mint a token, open the session, pipe the
 * microphone in and the model's voice out, and take all of it down again.
 *
 * **Everything it owns has to be released, in order.** A live session is four
 * things at once — a WebSocket, a microphone track, a capture AudioContext and
 * a playback AudioContext — and leaking any of them is worse than the usual
 * leak: a live microphone keeps the browser's recording indicator on, and an
 * open socket keeps billing. `stop` is therefore idempotent and is called from
 * unmount as well as from the button.
 *
 * **Nothing is recorded.** Audio streams through and is gone; the transcripts
 * are React state that dies with the page. Same promise the pronunciation
 * feature makes, kept the same way — by having nowhere to put it.
 *
 * **The conversation runs until somebody ends it, and two things end it
 * without being asked.** See the timeout constants below: the server cannot
 * meter a live session at all, so the browser is the only thing in a position
 * to notice that nobody is there.
 */

/** What the UI shows, and what the button does next. */
export const LIVE_STATUS = {
  IDLE: "idle",
  CONNECTING: "connecting",
  LIVE: "live",
  ENDED: "ended",
};

/** Why a session ended — the page says a different sentence for each. */
export const END_REASON = {
  USER: "user",
  IDLE: "idle",
  LIMIT: "limit",
  // The other end hung up. Used to fall through to USER, which is how a
  // session Google refused within 300 ms read on screen as the learner having
  // pressed stop — a fault indistinguishable from a normal ending.
  DROPPED: "dropped",
};

/**
 * Silence on **both** sides for this long and the session closes itself.
 *
 * This is the fallback that matters. `/api/live-token` mints one token per
 * session and then has no further view of it — it cannot count minutes, end a
 * call or even know one is still open — so a tab left open on a forgotten
 * conversation holds a microphone and a billed socket until the laptop sleeps.
 * Ninety seconds is long enough to think about a sentence in a language you
 * barely speak, and short enough that walking away ends it.
 */
const IDLE_TIMEOUT_MS = 90_000;

/**
 * Loudness above which somebody is talking rather than breathing. Capture runs
 * with noise suppression on, so a quiet room sits an order of magnitude below
 * this.
 */
const SPEECH_LEVEL = 0.02;

/**
 * Only used when the server did not say when the token expires. The response
 * carries `expiresAt` and that is what should be trusted — a constant here is
 * a second copy of a number owned by the other repo, and it exists solely so
 * that an older deployment of the endpoint still gets a ceiling rather than
 * running until Google hangs up without explanation.
 */
const FALLBACK_SESSION_MS = 15 * 60_000;

export function useLiveTutor({ user, targetLang, explanationLang, level }) {
  const [status, setStatus] = useState(LIVE_STATUS.IDLE);
  const [error, setError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [turns, setTurns] = useState([]);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [endedBy, setEndedBy] = useState(null);

  const sessionRef = useRef(null);
  const captureRef = useRef(null);
  const playerRef = useRef(null);
  // Set the moment teardown begins, so a message still in flight cannot
  // resurrect a session that is closing.
  const stoppingRef = useRef(false);

  // Read by whatever is drawing, at its own frame rate. Deliberately refs and
  // not state: this changes about fifteen times a second and re-rendering a
  // page of transcript that often to move a shape would be absurd.
  const micLevelRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const deadlineRef = useRef(0);

  const stop = useCallback(async (reason) => {
    // Guarded because this is also an onClick handler somewhere, and a click
    // event landing in `endedBy` would render as no reason at all.
    const why = Object.values(END_REASON).includes(reason) ? reason : END_REASON.USER;

    if (stoppingRef.current) return;
    stoppingRef.current = true;

    // Microphone first. If anything below throws, the one thing that must not
    // survive is an open mic.
    await captureRef.current?.stop().catch(() => {});
    captureRef.current = null;

    sessionRef.current?.close();
    sessionRef.current = null;

    await playerRef.current?.close().catch(() => {});
    playerRef.current = null;

    micLevelRef.current = 0;
    setIsSpeaking(false);
    setSecondsLeft(null);
    setEndedBy(why);
    setStatus(LIVE_STATUS.ENDED);
  }, []);

  /**
   * Transcripts arrive as fragments, not sentences, so consecutive fragments
   * from the same speaker are appended to one turn. Starting a new bubble per
   * fragment would shred a sentence into a dozen lines.
   */
  const appendTranscript = useCallback((text, isUser) => {
    setTurns((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.isUser === isUser) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: `${Date.now()}-${prev.length}`, isUser, text }];
    });
  }, []);

  const start = useCallback(async () => {
    if (status === LIVE_STATUS.CONNECTING || status === LIVE_STATUS.LIVE) return;

    stoppingRef.current = false;
    setError(null);
    setTurns([]);
    setEndedBy(null);
    setStatus(LIVE_STATUS.CONNECTING);

    try {
      // The prompt document comes first, because the token is minted *for* a
      // model and that is where the model is configured. It is a cached read
      // in practice — promptService holds the list for the life of the tab.
      const { instructions, model, thinkingLevel } = await buildTutorInstructions({
        targetLang,
        explanationLang,
        level,
        displayName: user.displayName,
      });

      // Still ahead of the microphone, which is the ordering that actually
      // matters: minting is the step that can be refused, and asking somebody
      // for permission to record and then telling them their plan says no is
      // the wrong way round. Nothing above touches the mic.
      const {
        token: liveToken,
        model: serverModel,
        expiresAt,
      } = await requestLiveToken(user.token, model);

      const player = createPcmPlayer();
      playerRef.current = player;

      const session = await connectLiveTutor({
        liveToken,
        // What came back, not what went out. The token is locked to the model
        // it was minted for, so the echo is authoritative — and it differs
        // from `model` only when the API fell back, which is exactly the case
        // where following it rather than our own value is what connects.
        model: serverModel || model,
        thinkingLevel,
        instructions,
        onAudio: (base64) => {
          if (stoppingRef.current) return;
          // The tutor talking counts as the conversation being alive. Taken
          // here rather than from the player's analyser because the idle check
          // must not depend on anything being drawn — a backgrounded tab paints
          // no frames and would otherwise time out mid-sentence.
          lastVoiceAtRef.current = Date.now();
          setIsSpeaking(true);
          player.enqueue(base64);
        },
        onInterrupted: () => {
          // Talked over. Everything already queued is a sentence the learner
          // has moved past, and playing it out would be the tutor ignoring them.
          player.clear();
          setIsSpeaking(false);
        },
        onTranscript: appendTranscript,
        onError: (err) => {
          setError(err.message);
          stop();
        },
        onClose: () => {
          // Only reachable after setup: a refusal rejects connectLiveTutor
          // instead, and lands in the catch below with Google's reason.
          if (!stoppingRef.current) stop(END_REASON.DROPPED);
        },
      });
      sessionRef.current = session;

      captureRef.current = await startPcmCapture({
        onChunk: (base64) => {
          if (stoppingRef.current) return;
          session.sendAudio(base64);
        },
        onLevel: (loudness) => {
          micLevelRef.current = loudness;
          if (loudness > SPEECH_LEVEL) lastVoiceAtRef.current = Date.now();
        },
      });

      const parsed = Date.parse(expiresAt ?? "");
      const now = Date.now();
      deadlineRef.current = Number.isNaN(parsed) ? now + FALLBACK_SESSION_MS : parsed;
      lastVoiceAtRef.current = now;
      setSecondsLeft(Math.ceil((deadlineRef.current - now) / 1000));

      setStatus(LIVE_STATUS.LIVE);
    } catch (err) {
      // Unwind whatever did open before the failure — a token minted and a
      // player created still need taking down.
      await stop();
      setError(err.message);
      setStatus(LIVE_STATUS.IDLE);
      setEndedBy(null);
    }
  }, [status, user, targetLang, explanationLang, level, appendTranscript, stop]);

  /**
   * The two ways a conversation ends without anybody pressing anything.
   *
   * One interval rather than two timers: both questions are "what time is it
   * now", and a pair of `setTimeout`s would have to be cancelled and re-armed
   * on every sound.
   */
  useEffect(() => {
    if (status !== LIVE_STATUS.LIVE) return undefined;

    const id = setInterval(() => {
      const now = Date.now();

      if (now - lastVoiceAtRef.current >= IDLE_TIMEOUT_MS) {
        stop(END_REASON.IDLE);
        return;
      }

      const remaining = deadlineRef.current - now;
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) stop(END_REASON.LIMIT);
    }, 1000);

    return () => clearInterval(id);
  }, [status, stop]);

  /**
   * Both voices, on demand, on the same scale.
   *
   * Stable identity so the canvas can hold onto it for the life of the page;
   * it reads live refs, so it never goes stale the way a captured value would.
   */
  const getAudioLevels = useCallback(
    () => ({
      mic: micLevelRef.current,
      tutor: playerRef.current?.getLevel() ?? 0,
    }),
    [],
  );

  // Navigating away is the commonest way to leave a microphone open.
  useEffect(() => () => { stop(); }, [stop]);

  return {
    status,
    error,
    isSpeaking,
    turns,
    secondsLeft,
    endedBy,
    getAudioLevels,
    start,
    stop,
  };
}
