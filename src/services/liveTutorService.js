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
 * @param {{targetLang: string, explanationLang: string, level: string, displayName?: string}} params
 * @returns {Promise<{instructions: string, model: string}>}
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
  };
}

/**
 * Connect, and hand back a session.
 *
 * `onAudio` receives base64 PCM16 at 24 kHz, in arrival order. `onInterrupted`
 * fires when the model is cut off mid-sentence — everything already queued for
 * playback has to stop, or the tutor keeps talking over the learner.
 *
 * @param {object} params
 * @param {string} params.liveToken     - from requestLiveToken
 * @param {string} params.model
 * @param {string} params.instructions  - the system instruction
 * @param {(base64: string) => void} params.onAudio
 * @param {() => void} [params.onInterrupted]
 * @param {(text: string, isUser: boolean) => void} [params.onTranscript]
 * @param {() => void} [params.onOpen]
 * @param {(error: Error) => void} [params.onError]
 * @param {() => void} [params.onClose]
 * @returns {Promise<{sendAudio: (base64: string) => void, close: () => void}>}
 */
export async function connectLiveTutor({
  liveToken,
  model,
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

  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: instructions,
      // Asked for explicitly so the conversation can be shown as it happens.
      // A spoken lesson with no text is impossible to follow back over, and a
      // learner who mishears a correction has no way to check it.
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
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
      onclose: () => onClose?.(),
    },
  });

  return {
    sendAudio(base64) {
      session.sendRealtimeInput({
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' },
      });
    },
    close() {
      try {
        session.close();
      } catch {
        /* already gone */
      }
    },
  };
}
