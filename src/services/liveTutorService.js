/**
 * liveTutorService.js
 *
 * Opens a spoken conversation with the tutor.
 *
 * **This is the one AI feature that does not go through `/api/ask-ai`**, and it
 * is not a shortcut. The Live API is a stateful WebSocket, and a Vercel
 * function is an HTTP handler with a maximum duration — it can neither accept
 * an inbound socket nor hold one open for a lesson. So the session runs
 * browser-to-Google, and the proxy's part is `POST /api/live-token`: it checks
 * the Admin feature grant and mints a token locked to this model, with
 * `uses: 1` and a short life. The API key never reaches the browser.
 *
 * The SDK is **imported dynamically**, the same treatment jspdf gets: it is a
 * sizeable dependency that only matters to the one page that talks, and a
 * GitHub Pages bundle should not carry it for everybody else.
 */

import { apiFetch } from './apiClient';
import { getPrompt, renderTemplate } from './promptService';
import { Sentry } from '../sentry';
import { AI_VOICES } from '../config/aiVoices';

/**
 * Used when `live-tutor-prompt` names no model — the state of a fresh install.
 *
 * The model is chosen here, on the prompt document, like every other model in
 * this app, and sent to `/api/live-token` the same way `providerParams.model`
 * is sent to `/api/ask-ai`. The endpoint locks the minted token to whatever it
 * is given and echoes it back; that echo is what the session is opened with,
 * since a token only works with the model it was minted for.
 */
const FALLBACK_MODEL = 'gemini-3.8-live-extended-thinking';

/**
 * The thinking level that travels with FALLBACK_MODEL, and only with it.
 *
 * **`gemini-3.8-live-extended-thinking` refuses a session that does not name
 * one** — the socket opens and closes within 300 ms with 1007 "Thinking level
 * must be specified for this model." Google's own guide says thinking is
 * "supported but not required" for this model; the server disagrees, and the
 * server is what answers.
 *
 * Low because this is a conversation: every level of thought is latency before
 * the tutor speaks, and a pause that reads as thinking in text reads as a
 * dropped line in a voice. `minimal` is not accepted by this model.
 *
 * Paired with the fallback model rather than sent for every model, so nothing
 * here guesses from a model's *name* whether it thinks. A prompt document that
 * names its own model owns its thinking level too: set `thinkingLevel` beside
 * `model` in Admin (it sits in the raw-JSON box), or leave it blank for a
 * model that does not think.
 */
const FALLBACK_THINKING_LEVEL = 'LOW';

/** The values Google accepts, in the case the wire expects. */
const THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'];

/**
 * Resolve the thinking level for a prompt document.
 *
 * Normalised here rather than trusted as typed, because it is typed by hand
 * into a JSON box: "low" and "LOW" should both work, and a typo should warn
 * rather than surface as a refusal from Google with no pointer back to Admin.
 *
 * @param {{model?: string, thinkingLevel?: string}} promptDoc
 * @returns {string} '' when none should be sent
 */
function _thinkingLevelFor(promptDoc) {
  const asked = String(promptDoc.thinkingLevel ?? '').trim().toUpperCase();

  if (asked) {
    if (THINKING_LEVELS.includes(asked)) return asked;
    console.warn(
      `[liveTutorService] "${promptDoc.thinkingLevel}" is not a thinking level `
        + `(expected one of ${THINKING_LEVELS.join(', ')}). Fix it on "live-tutor-prompt" in Admin.`,
    );
    return '';
  }

  return promptDoc.model ? '' : FALLBACK_THINKING_LEVEL;
}

/**
 * Fetch a one-session token for `model`.
 *
 * A 403 means the plan does not include this, which the caller turns into an
 * upgrade prompt rather than an error.
 *
 * The model is passed in rather than read here so that the one prompt fetch
 * `buildTutorInstructions` already makes serves both: the instruction text and
 * the model come off the same document, and reading it twice to get two
 * fields would be the sort of thing that later drifts apart.
 *
 * @param {string} token - Firebase ID token
 * @param {string} [model] - from the prompt document; blank lets the API decide
 * @returns {Promise<{token: string, model: string, expiresAt: string}>}
 */
export async function requestLiveToken(token, model) {
  const response = await apiFetch(
    '/api/live-token',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: model ? { model } : {},
    },
    'Could not start a conversation'
  );
  if (!response?.token) {
    throw new Error('[liveTutorService] No live token returned');
  }
  return response;
}

/**
 * Build the tutor's standing instructions.
 *
 * Admin-editable like every other prompt, and the variables are what make it a
 * *language* tutor rather than a chatbot that happens to talk: which language
 * is being practised, which one to explain in, and the level to pitch at.
 *
 * **The rendered template is the whole instruction — nothing is added in code.**
 * Every word the tutor is given comes from `live-tutor-prompt`, so whoever
 * reads it in Admin is reading all of it. The chosen voice is not part of the
 * prompt at all; it goes to the connection (see connectLiveTutor).
 *
 * @param {{targetLang: string, explanationLang: string, level: string, displayName?: string}} params
 * @returns {Promise<{instructions: string, model: string, thinkingLevel: string}>}
 */
export async function buildTutorInstructions({ targetLang, explanationLang, level, displayName }) {
  const promptDoc = await getPrompt('live-tutor-prompt');

  // Same guard the other prompts carry. Without {{targetLang}} the tutor has no
  // idea what it is teaching and will answer in whatever language it was
  // addressed in — which looks like a broken tutor rather than a stale prompt.
  if (!String(promptDoc.template).includes('{{targetLang}}')) {
    console.warn(
      '[liveTutorService] The "live-tutor-prompt" template has no {{targetLang}} placeholder, ' +
      'so the tutor does not know which language it is teaching. Add it in Admin > Prompts.',
    );
  }

  return {
    instructions: renderTemplate(promptDoc.template, {
      targetLang,
      explanationLang,
      level,
      learnerName: displayName || '',
    }),
    model: promptDoc.model || FALLBACK_MODEL,
    thinkingLevel: _thinkingLevelFor(promptDoc),
  };
}

/** A WebSocket close that means "finished", as opposed to "refused" or "broken". */
const NORMAL_CLOSURE = 1000;

/**
 * Say why a session ended, somewhere somebody will read it.
 *
 * **Google's close frame is the only place a refused session explains
 * itself**, and it used to be thrown away: `onclose` ignored its event, the
 * hook took every close as the learner pressing stop, and a session the server
 * refused within 300 ms looked like one that ended normally. That hid two
 * separate faults for the life of this feature.
 *
 * Code, reason and model only — never audio, never a transcript. Fault-fixing,
 * which is what the privacy policy lists Sentry for.
 */
function _reportClose(event, { code, reason }, model) {
  console.error(`[liveTutorService] ${event}: ${code} ${reason}`, { model });
  Sentry.captureMessage(event, { level: 'error', extra: { code, reason, model } });
}

/**
 * Connect, and hand back a session.
 *
 * `onAudio` receives base64 PCM16 at 24 kHz, in arrival order. `onInterrupted`
 * fires when the model is cut off mid-sentence — everything already queued for
 * playback has to stop, or the tutor keeps talking over the learner.
 *
 * **A refused setup rejects, with Google's reason as the message.** The SDK's
 * `live.connect` resolves only once the server acknowledges the setup; when the
 * server closes the socket instead, that promise never settles at all. So it
 * is raced against the close, and the caller gets an error it can show rather
 * than a `start()` that waits for ever.
 *
 * `onClose` receives `{code, reason}` for anything after setup, so the caller
 * can tell a dropped line from the end of a lesson.
 *
 * @param {object} params
 * @param {string} params.liveToken     - from requestLiveToken
 * @param {string} params.model
 * @param {string} [params.thinkingLevel] - from buildTutorInstructions; '' sends none
 * @param {string} [params.voice]       - a name from config/aiVoices; anything else sends none
 * @param {string} params.instructions  - the system instruction
 * @param {(base64: string) => void} params.onAudio
 * @param {() => void} [params.onInterrupted]
 * @param {(text: string, isUser: boolean) => void} [params.onTranscript]
 * @param {() => void} [params.onOpen]
 * @param {(error: Error) => void} [params.onError]
 * @param {(closed: {code: number|null, reason: string}) => void} [params.onClose]
 * @returns {Promise<{sendAudio: (base64: string) => void, close: () => void}>}
 */
export async function connectLiveTutor({
  liveToken,
  model,
  thinkingLevel,
  voice,
  instructions,
  onAudio,
  onInterrupted,
  onTranscript,
  onOpen,
  onError,
  onClose,
}) {
  const { GoogleGenAI, Modality } = await import('@google/genai');

  // The ephemeral token goes where an API key would. That is the whole design:
  // it is short-lived, single-use, and locked to this model server-side.
  const ai = new GoogleGenAI({ apiKey: liveToken });

  // All of this reaches the model only because /api/live-token sends a
  // `fieldMask`. Without one, the token's own setup replaced this object
  // wholesale — the instruction below was silently dropped and the tutor spoke
  // as a generic assistant. If that ever happens again, look there first.
  const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: instructions,
    // Asked for explicitly so the conversation can be shown as it happens.
    // A spoken lesson with no text is impossible to follow back over, and a
    // learner who mishears a correction has no way to check it.
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
  if (thinkingLevel) config.thinkingConfig = { thinkingLevel };

  // Only a name from the list. Google does not refuse one it does not know —
  // "NotARealVoice" connected without complaint and spoke in some default at
  // 218 Hz — so a stale or misspelt name would quietly give the learner a
  // different voice from the one they picked, with nothing to say so.
  if (voice && AI_VOICES.includes(voice)) {
    config.speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } };
  } else if (voice) {
    console.warn(`[liveTutorService] "${voice}" is not a known voice; using the model's default.`);
  }

  let setupDone = false;
  let closingOnPurpose = false;
  let refuse = () => {};
  const refused = new Promise((_, reject) => { refuse = reject; });

  const session = await Promise.race([
    ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => onOpen?.(),
        onmessage: (message) => {
          const content = message?.serverContent;

          // Interruption first: whatever else this message carries, the queued
          // audio is now stale and must not keep playing.
          if (content?.interrupted) onInterrupted?.();

          for (const part of content?.modelTurn?.parts ?? []) {
            if (part?.inlineData?.data) onAudio(part.inlineData.data);
          }

          if (content?.inputTranscription?.text) {
            onTranscript?.(content.inputTranscription.text, true);
          }
          if (content?.outputTranscription?.text) {
            onTranscript?.(content.outputTranscription.text, false);
          }
        },
        onerror: (event) => onError?.(new Error(event?.message ?? 'Live session error')),
        onclose: (event) => {
          const closed = { code: event?.code ?? null, reason: event?.reason ?? '' };

          if (!setupDone) {
            _reportClose('live_session_refused', closed, model);
            refuse(Object.assign(
              new Error(closed.reason || `Live session refused (${closed.code})`),
              closed,
            ));
            return;
          }

          // Our own close() arrives here too, usually as 1005 rather than
          // 1000, and reporting every lesson a learner finished would bury the
          // ones that actually broke.
          if (!closingOnPurpose && closed.code !== NORMAL_CLOSURE) {
            _reportClose('live_session_dropped', closed, model);
          }
          onClose?.(closed);
        },
      },
    }),
    refused,
  ]);
  setupDone = true;

  return {
    sendAudio(base64) {
      session.sendRealtimeInput({
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
      });
    },
    close() {
      closingOnPurpose = true;
      try {
        session.close();
      } catch {
        /* already gone */
      }
    },
  };
}
