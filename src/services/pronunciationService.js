/**
 * pronunciationService.js
 *
 * Backs Voice Practice: a passage to read aloud, and feedback on the reading.
 *
 * Two halves with opposite economics, which is why they are two functions.
 *
 * **The passage is cache-first**, the same contract as storyService and
 * grammarService: read what exists for this level and language, generate only
 * when the pool is empty, write it back so the next reader gets it free. A
 * passage is worth pooling precisely because it is *not* personal — everyone
 * practising pt-PT at B1 wants the same difficult sounds.
 *
 * **The feedback never is.** It is about one person's reading of it, so every
 * submission is a generation. That is the call the daily limit rations.
 *
 * Firestore schema:
 *
 *   pronunciationPassages/{passageId}
 *     level: string            // CEFR level
 *     targetLang: string       // the language it is to be read in
 *     text: string             // the passage itself, 2-4 sentences
 *     focus: string[]          // the sounds it was built to exercise
 *     status: 'ready'
 *     aiGenerated: true
 *     createdAt / updatedAt
 *
 * **No recording is stored, here or anywhere.** The audio reaches `askAI` as
 * an inline attachment and goes out of scope with the response. §2.6 and §6 of
 * the privacy policy promise exactly that, along with two things the prompt
 * must also honour: no voiceprint, and no inference about the speaker — only
 * about how the words were said. Those promises are what keep this outside
 * Illinois BIPA and Texas CUBI, so they are a constraint on the prompt text,
 * not a preference.
 */

import { queryCollection, createDocument } from './firestoreService';
import { askAI } from './aiService';
import { getPrompt, renderTemplate } from './promptService';
import { getGrammarDescription } from './examPromptTemplates';
import { parseAIJSON } from '../utils/parseAIJSON';

export const PASSAGES_COLLECTION = 'pronunciationPassages';

/**
 * Only used when the prompt document names no model of its own.
 *
 * **Both calls here use it, including the one that listens.** The feedback
 * call used to fall back to `gemini-3.5-transcribe`, on the reasoning that a
 * listening task wants a listening model. That was wrong in the way this file
 * had already written down as a risk: a transcription model returns a
 * transcript and ignores the rest of the instruction, so readers got their
 * words back with no score, no summary and no issues — the feature's entire
 * point, missing, while the call still cost them one of their daily requests.
 *
 * `gemini-3.5-flash-lite` reads the audio and writes the feedback, and is what
 * almost every other service here runs on. Gemini's 3.x text models take audio
 * the same way they take images, so there is no separate listening model to
 * configure — the same thing already noted about photo capture and vision.
 */
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Enough to hear several sounds, short enough that nobody stumbles from length. */
const SENTENCES_BY_LEVEL = { A1: 2, A2: 2, B1: 3, B2: 3, C1: 4, C2: 4 };
const DEFAULT_SENTENCES = 3;

/** More than this and the list stops being a thing you can act on. */
const MAX_ISSUES = 6;

const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    // What the model actually heard. On its own this teaches more than any
    // note — seeing "pão" come back as "pau" lands harder than being told.
    transcript: { type: 'string' },
    score: { type: 'integer' },
    summary: { type: 'string' },
    issues: {
      type: 'array',
      maxItems: MAX_ISSUES,
      items: {
        type: 'object',
        properties: {
          word: { type: 'string' },
          heard: { type: 'string' },
          tip: { type: 'string' },
        },
        required: ['word', 'tip'],
      },
    },
  },
  required: ['transcript', 'score', 'summary', 'issues'],
};

// ---------------------------------------------------------------------------
// The passage
// ---------------------------------------------------------------------------

/**
 * Keep only the sounds that are actually in the passage.
 *
 * **A prompt is not a containment constraint**, the same lesson `wordPool`
 * learned about uniqueness. Asked for a passage and the sounds to practise in
 * it, the model returned "O gato branco correu para o jardim..." alongside
 * `lh`, `ch`, `ões` — three sounds, none of them anywhere in the sentence. It
 * had answered the two halves independently. Telling it not to do that is
 * worth doing (see the schema descriptions) and is not worth relying on.
 *
 * So the list is checked against the text before anyone sees it. A learner
 * being told to practise a sound that is not on their screen has nothing to
 * practise, and quietly learns the labels are decorative.
 *
 * **Accents are compared, never stripped.** `ão` against `ao` and `ç` against
 * `c` are exactly the distinctions this feature exists to drill, so the usual
 * NFD-and-strip normalisation would make the check pass on the very pairs it
 * most needs to catch. Case is folded, because a sound can open a sentence.
 *
 * @param {string} text
 * @param {unknown} focus
 * @returns {string[]} A new array; the input is not mutated.
 */
function _soundsPresentIn(text, focus) {
  const haystack = String(text ?? '').toLowerCase();
  const kept = [];
  const seen = new Set();

  for (const raw of Array.isArray(focus) ? focus : []) {
    const sound = String(raw ?? '').trim();
    if (!sound) continue;

    const key = sound.toLowerCase();
    if (seen.has(key) || !haystack.includes(key)) continue;

    seen.add(key);
    kept.push(sound);
  }

  return kept;
}

/**
 * Fetch a passage to read, generating one if the pool has none.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.level      - CEFR level
 * @param {string} params.targetLang - language to read in
 * @param {string[]} [params.seenPassageIds]
 * @returns {Promise<{passageId: string, text: string, focus: string[], level: string, targetLang: string, source: 'db'|'ai'}>}
 */
export async function getPassage({ token, level, targetLang, seenPassageIds = [] }) {
  if (!token) throw new Error('[pronunciationService] token is required');
  if (!level) throw new Error('[pronunciationService] level is required');
  if (!targetLang) throw new Error('[pronunciationService] targetLang is required');

  const pool = await _fetchReadyPassages(token, { level, targetLang });
  const seen = new Set(seenPassageIds);
  const unseen = pool.find((passage) => !seen.has(passage.id));

  if (unseen) {
    return {
      passageId: unseen.id,
      text: unseen.text,
      // Filtered on the way out as well as on the way in, because the pool
      // already holds lists written before anything checked them — and there
      // is no admin screen for `pronunciationPassages`, so a stored passage
      // cannot be corrected from inside the app. Doing it here fixes what is
      // already there for every reader, without a migration.
      focus: _soundsPresentIn(unseen.text, unseen.focus),
      level,
      targetLang,
      source: 'db',
    };
  }

  return _generatePassage({ token, level, targetLang, existing: pool.map((p) => p.text) });
}

async function _generatePassage({ token, level, targetLang, existing }) {
  const sentenceCount = SENTENCES_BY_LEVEL[level] ?? DEFAULT_SENTENCES;
  const promptDoc = await getPrompt('pronunciation-passage-prompt');

  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    level,
    sentenceCount,
    grammarDescription: getGrammarDescription(level),
    avoidTexts: existing.filter(Boolean).slice(0, 12).join(' | ') || '(none yet)',
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    // Lowered from 0.8. The variety in this pool comes from `{{avoidTexts}}`
    // — the last twelve passages, named and ruled out — not from sampling, so
    // the temperature was buying very little and costing fidelity: a pt-PT
    // passage came back with the Spanish "pedazo" in place of "pedaço".
    // Neighbouring languages are exactly what loose sampling reaches for, and
    // a misspelt word in a read-aloud exercise teaches the misspelling.
    // A mitigation rather than a fix; the model is the stronger lever.
    temperature: 0.6,
    jsonMode: true,
    responseSchema: {
      type: 'object',
      properties: {
        // `text` before `focus` on purpose: Gemini fills a schema in the
        // order its properties are declared, so the passage is written
        // first and the sounds are picked out of something that exists.
        // Reversed, the model commits to sounds and then has to write a
        // passage around them, which is the harder job and the one it
        // visibly failed — `lh`, `ch` and `ões` offered against a sentence
        // containing none of them.
        text: {
          type: 'string',
          description:
            'The passage to read aloud, in the requested language and variety only. '
            + 'Every word must be a real word of that language.',
        },
        focus: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Two to four letter sequences copied verbatim out of `text`, each one a '
            + 'sound a learner of this language finds hard. Do not list a sequence that '
            + 'does not appear in `text`. Prefer an empty list to an invented one.',
        },
      },
      required: ['text', 'focus'],
    },
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams);
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed?.text) {
    throw new Error('[pronunciationService] AI returned no passage');
  }

  const now = new Date().toISOString();
  const text = String(parsed.text).trim();
  const focus = _soundsPresentIn(text, parsed.focus);

  // Stored filtered, so the pool holds something true rather than something
  // the read path has to keep correcting. Losing every sound is worth saying
  // out loud: the passage still reads fine and is still worth keeping, but a
  // model that cannot find its own letters in its own sentence is a signal
  // about the model — and this is the only place that signal is visible,
  // since the reader just sees a card without chips.
  if (Array.isArray(parsed.focus) && parsed.focus.length > 0 && focus.length === 0) {
    console.warn(
      '[pronunciationService] every focus sound was absent from the passage — '
        + 'check the model on pronunciation-passage-prompt',
      { focus: parsed.focus, text },
    );
  }

  const written = await createDocument(
    PASSAGES_COLLECTION,
    {
      level,
      targetLang,
      text,
      focus,
      status: 'ready',
      aiGenerated: true,
      source: 'ai',
      createdAt: now,
      updatedAt: now,
    },
    undefined,
    token
  );

  const passageId = written?.id;
  if (!passageId) throw new Error('[pronunciationService] Passage write did not return an ID');

  return { passageId, text, focus, level, targetLang, source: 'ai' };
}

// ---------------------------------------------------------------------------
// The feedback
// ---------------------------------------------------------------------------

/**
 * Listen to a reading and say how it went.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {{data: string, mimeType: string}} params.audio - one inline clip
 * @param {string} params.text           - the passage they were asked to read
 * @param {string} params.targetLang     - the language it is in
 * @param {string} params.explanationLang - the language the notes are written in
 * @param {string} params.level
 * @returns {Promise<{transcript: string, score: number, summary: string, issues: Array<{word: string, heard?: string, tip: string}>}>}
 */
export async function gradePronunciation({
  token, audio, text, targetLang, explanationLang, level,
}) {
  if (!token) throw new Error('[pronunciationService] token is required');
  if (!audio?.data) throw new Error('[pronunciationService] audio is required');
  if (!text) throw new Error('[pronunciationService] text is required');

  const promptDoc = await getPrompt('pronunciation-feedback-prompt');

  // The same guard {{requiredWords}} and {{focus}} carry elsewhere, and the
  // one that matters most here: without {{text}} the model has nothing to
  // compare the reading against, so every verdict becomes a guess at what was
  // probably meant.
  if (!String(promptDoc.template).includes('{{text}}')) {
    console.warn(
      '[pronunciationService] The "pronunciation-feedback-prompt" template has no {{text}} ' +
      'placeholder, so the model is judging a reading without knowing what was meant to be ' +
      'read. Add it in Admin > Prompts.',
    );
  }

  const prompt = renderTemplate(promptDoc.template, {
    targetLang,
    explanationLang,
    level,
    text,
    maxIssues: MAX_ISSUES,
  });

  const providerParams = {
    provider: 'gemini',
    model: promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    temperature: 0.2,
    jsonMode: true,
    responseSchema: FEEDBACK_SCHEMA,
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams, { audio: [audio] });
  const parsed = parseAIJSON(data?.text ?? '');
  if (!parsed) {
    throw new Error('[pronunciationService] AI returned no feedback');
  }

  return {
    transcript: parsed.transcript ? String(parsed.transcript).trim() : '',
    // Clamped rather than trusted. A score outside 0-100 renders as a broken
    // meter, and one missing entirely is not hypothetical — it is exactly what
    // the transcribe model this used to default to returned, every time.
    // The model is admin-editable, so the next wrong one is a field away.
    score: _clampScore(parsed.score),
    summary: parsed.summary ? String(parsed.summary).trim() : '',
    issues: Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((issue) => issue?.word && issue?.tip)
          .slice(0, MAX_ISSUES)
          .map((issue) => ({
            word: String(issue.word),
            heard: issue.heard ? String(issue.heard) : '',
            tip: String(issue.tip),
          }))
      : [],
  };
}

function _clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function _fetchReadyPassages(token, { level, targetLang }) {
  const result = await queryCollection(
    PASSAGES_COLLECTION,
    { level, targetLang, status: 'ready' },
    {},
    token
  );
  return result?.documents ?? [];
}
