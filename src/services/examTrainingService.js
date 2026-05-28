/**
 * examTrainingService.js
 *
 * Handles all AI calls and Firestore pool access for the Exam Training feature.
 *
 * PUBLIC API
 * ──────────
 * generateWritingPrompt({ token, level })
 *   → Ask Gemini to produce a fresh CEFR writing exercise. Low-level.
 *     Prefer getExercise() — it only calls this when the pool is exhausted.
 *
 * evaluateWriting({ token, level, exercisePrompt, userText })
 *   → Score the student's text against the 5-parameter CEFR rubric.
 *
 * getExercise({ token, uid, level, exerciseType, lang })
 *   → Fetch an unseen exercise from the shared Firestore pool, or generate
 *     a new one when the pool is exhausted (fetch-or-generate pattern).
 *
 * markExerciseSeen({ token, uid, exerciseType, lang, exerciseId, currentSeenIds })
 *   → Append an exercise ID to the user's seenExerciseIds map.
 *
 * getSeenExerciseIds({ token, uid, exerciseType, lang })
 *   → Read users/{uid}.seenExerciseIds["{exerciseType}__{lang}"].
 *
 * // TODO: Currently defaults to pt-PT as the learning language.
 * //       When multi-language support is added, pass `lang` explicitly
 * //       from the user's learningDialect in AppContext.
 */

// ---------------------------------------------------------------------------
// Types (JSDoc only)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GenerateWritingPromptParams
 * @property {string} token  - Firebase ID token
 * @property {string} level  - CEFR level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
 */

/**
 * @typedef {Object} GenerateWritingPromptResult
 * @property {string}   prompt       - The writing task description shown to the user
 * @property {string[]} instructions - Bullet-point instructions for the task
 * @property {number}   minWords     - Minimum word count required
 * @property {number}   maxWords     - Maximum word count required
 */

/**
 * @typedef {Object} EvaluateWritingParams
 * @property {string} token          - Firebase ID token
 * @property {string} level          - CEFR level
 * @property {string} exercisePrompt - The original task shown to the user
 * @property {string} userText       - The text written by the user
 */

/**
 * @typedef {Object} EvaluationParameter
 * @property {string} id       - Parameter id: 'A' | 'B' | 'C' | 'D' | 'E'
 * @property {string} name     - Human-readable parameter name
 * @property {number} score    - Score awarded (1–5)
 * @property {number} maxScore - Always 5
 * @property {string} feedback - Specific feedback for this parameter
 */

/**
 * @typedef {Object} EvaluateWritingResult
 * @property {number}               totalScore       - Final score after word count penalty
 * @property {number}               maxScore         - Always 25
 * @property {number}               rawScore         - Score before word count penalty
 * @property {number}               wordCount        - Number of words in userText
 * @property {number}               wordCountPenalty - Penalty applied (0, 1, or 2)
 * @property {EvaluationParameter[]} parameters      - Per-parameter breakdown
 * @property {string}               generalFeedback  - Overall feedback paragraph
 */

/**
 * @typedef {'writing' | 'listening' | 'reading' | 'full_exam'} ExerciseType
 */

/**
 * @typedef {Object} ExerciseDoc
 * @property {string}   id           - Firestore document ID (the pool key)
 * @property {string}   exerciseType
 * @property {string}   lang
 * @property {string}   level
 * @property {string}   prompt
 * @property {string[]} instructions
 * @property {number}   minWords
 * @property {number}   maxWords
 * @property {number}   timesServed
 */

/**
 * @typedef {Object} GetExerciseParams
 * @property {string}       token        - Firebase ID token
 * @property {string}       uid          - Firebase user UID
 * @property {string}       level        - CEFR level
 * @property {ExerciseType} exerciseType - Type of exercise
 * @property {string}       [lang]       - BCP-47 language tag (defaults to 'pt-PT')
 */

/**
 * @typedef {Object} MarkExerciseSeenParams
 * @property {string}   token        - Firebase ID token
 * @property {string}   uid          - Firebase user UID
 * @property {string}   exerciseType
 * @property {string}   lang
 * @property {string}   exerciseId   - Firestore document ID to mark as seen
 * @property {string[]} [currentSeenIds] - Pass current list to avoid an extra read
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'https://multi-lingo-ai-api.vercel.app';

/** Firestore collection that holds public exercise documents. */
const EXERCISE_POOL_COLLECTION = 'examExercisePool';

/**
 * How many pool documents to fetch per query.
 * 50 is enough to find an unseen exercise without an expensive full scan.
 */
const POOL_FETCH_LIMIT = 50;

/**
 * Gemini 2.5 Flash — fast, cost-effective, strong JSON output.
 *
 * ⚠️  DEPRECATION NOTICE: gemini-2.5-flash is scheduled for deprecation on
 *     June 17, 2026. Upgrade to gemini-3.5-flash before that date.
 *     Cost comparison per 100 sessions: 2.5-flash ~$0.43 vs 3.5-flash ~$1.59.
 *     See: https://ai.google.dev/gemini-api/docs/models
 */
const GEMINI_MODEL = 'gemini-2.5-flash';

/** Word count bounds by CEFR level (pt-PT certification standards) */
const WORD_COUNT_BOUNDS = {
  A1: { min: 60,  max: 100 },
  A2: { min: 60,  max: 100 },
  B1: { min: 100, max: 150 },
  B2: { min: 150, max: 200 },
  C1: { min: 200, max: 250 },
  C2: { min: 200, max: 250 },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * POST to /api/ask-ai with JSON mode enabled.
 * @param {string} token
 * @param {string} prompt
 * @returns {Promise<string>} Raw text from the AI response
 */
async function callAskAI(token, prompt) {
  const response = await fetch(`${PROXY_URL}/api/ask-ai`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      providerParams: {
        provider:    'gemini',
        model:       GEMINI_MODEL,
        temperature: 0.7,
        jsonMode:    true,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? `[examTrainingService] Request failed (${response.status})`
    );
  }

  return json?.data?.text ?? json?.text ?? '';
}

/**
 * Safely parse JSON from the AI response.
 * Strips markdown code fences if present.
 * @param {string} raw
 * @returns {object}
 */
function parseJSON(raw) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Count words in a string (splits on whitespace).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Calculate the word count penalty based on pt-PT certification rules.
 * - ±0 if within [min, max]
 * - −1 if between (min−20, min) or (max, max+20]
 * - −2 if below (min−20) or above (max+20)
 * @param {number} wordCount
 * @param {string} level
 * @returns {number} 0 | 1 | 2
 */
function calcWordCountPenalty(wordCount, level) {
  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;
  if (wordCount >= min && wordCount <= max)           return 0;
  if (wordCount >= min - 20 || wordCount <= max + 20) return 1;
  return 2;
}

/**
 * Build the compound Firestore document ID for a pool entry.
 * Format: "{exerciseType}__{lang}__{level}__{nanoid}"
 * The first three segments are also stored as indexed fields so the
 * GET /api/firestore filtered query can find documents without needing
 * the full ID.
 *
 * @param {string} exerciseType
 * @param {string} lang
 * @param {string} level
 * @returns {string}  e.g. "writing__pt-PT__B1__abc123"
 */
function buildPoolDocId(exerciseType, lang, level) {
  const nano = Math.random().toString(36).slice(2, 9);
  return `${exerciseType}__${lang}__${level}__${nano}`;
}

/**
 * Build the seenExerciseIds map key for a given exerciseType + lang.
 * Stored as a nested key in users/{uid}.seenExerciseIds.
 * e.g. "writing__pt-PT"
 *
 * @param {string} exerciseType
 * @param {string} lang
 * @returns {string}
 */
function buildSeenKey(exerciseType, lang) {
  return `${exerciseType}__${lang}`;
}

// ---------------------------------------------------------------------------
// Pool — Firestore read/write helpers
// ---------------------------------------------------------------------------

/**
 * Query the exercise pool for documents matching exerciseType + lang + level.
 * Returns up to POOL_FETCH_LIMIT documents.
 *
 * This is a public read — no auth check on the Firestore side for GET.
 * Auth is still sent so the proxy middleware does not reject the request.
 *
 * @param {string} token
 * @param {string} exerciseType
 * @param {string} lang
 * @param {string} level
 * @returns {Promise<ExerciseDoc[]>}
 */
async function fetchPoolExercises(token, exerciseType, lang, level) {
  const filters = JSON.stringify([
    { field: 'exerciseType', op: '==', value: exerciseType },
    { field: 'lang',         op: '==', value: lang         },
    { field: 'level',        op: '==', value: level        },
  ]);

  const url = new URL(`${PROXY_URL}/api/firestore`);
  url.searchParams.set('collection', EXERCISE_POOL_COLLECTION);
  url.searchParams.set('filters',    filters);
  url.searchParams.set('limit',      String(POOL_FETCH_LIMIT));

  const response = await fetch(url.toString(), {
    method:  'GET',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      json?.error ?? json?.message ?? '[examTrainingService] Failed to fetch exercise pool'
    );
  }

  return (json?.data?.documents ?? []).map((doc) => ({ id: doc.id, ...doc }));
}

/**
 * Persist a newly generated exercise to the shared pool.
 * Sets exerciseType, lang, level, prompt, instructions, minWords, maxWords,
 * and timesServed=0. createdBy and createdAt are added server-side.
 *
 * @param {string} token
 * @param {string} exerciseType
 * @param {string} lang
 * @param {string} level
 * @param {GenerateWritingPromptResult} exerciseData
 * @returns {Promise<string>} The new document ID
 */
async function saveExerciseToPool(token, exerciseType, lang, level, exerciseData) {
  const id = buildPoolDocId(exerciseType, lang, level);

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: EXERCISE_POOL_COLLECTION,
      id,
      data: {
        exerciseType,
        lang,
        level,
        prompt:       exerciseData.prompt,
        instructions: exerciseData.instructions,
        minWords:     exerciseData.minWords,
        maxWords:     exerciseData.maxWords,
        timesServed:  0,
      },
    }),
  });

  const json = await response.json();

  if (!response.ok) {
    // Non-fatal — the exercise was generated and can still be used this session;
    // it just won't be pooled for other users.
    console.warn('[examTrainingService] Failed to save exercise to pool (non-fatal):', json?.error ?? json?.message);
    return id;
  }

  return json?.data?.id ?? id;
}

/**
 * Increment timesServed on a pool document.
 * Fire-and-forget — failure is non-fatal.
 *
 * @param {string} token
 * @param {string} docId
 */
function incrementTimesServed(token, docId) {
  fetch(`${PROXY_URL}/api/firestore`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      collection: EXERCISE_POOL_COLLECTION,
      id:   docId,
      data: { timesServed: '__increment__' }, // handled server-side if supported, else ignored
    }),
  }).catch((err) =>
    console.warn('[examTrainingService] incrementTimesServed failed (non-fatal):', err)
  );
}

// ---------------------------------------------------------------------------
// seenExerciseIds — user document helpers
// ---------------------------------------------------------------------------

/**
 * Read the list of exercise IDs the user has already seen for a given
 * exerciseType + lang combination.
 *
 * Reads users/{uid}.seenExerciseIds["{exerciseType}__{lang}"].
 * Returns [] if the field doesn't exist yet.
 *
 * @param {string} token
 * @param {string} uid
 * @param {string} exerciseType
 * @param {string} lang
 * @returns {Promise<string[]>}
 */
export async function getSeenExerciseIds(token, uid, exerciseType, lang) {
  if (!token) throw new Error('[examTrainingService] token is required');
  if (!uid)   throw new Error('[examTrainingService] uid is required');

  const response = await fetch(
    `${PROXY_URL}/api/firestore?collection=users&id=${uid}`,
    {
      method:  'GET',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.status === 404) return [];

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? json?.message ?? '[examTrainingService] Failed to load seenExerciseIds');
  }

  const seenMap = json?.data?.data?.seenExerciseIds ?? {};
  const key     = buildSeenKey(exerciseType, lang);
  return seenMap[key] ?? [];
}

/**
 * Append an exercise ID to users/{uid}.seenExerciseIds["{exerciseType}__{lang}"].
 * Uses dot-notation PATCH so only the relevant key is touched — other
 * language/type entries are left untouched.
 *
 * Safe to call concurrently — uses a Set to deduplicate.
 *
 * @param {MarkExerciseSeenParams} params
 * @returns {Promise<void>}
 */
export async function markExerciseSeen({ token, uid, exerciseType, lang, exerciseId, currentSeenIds = [] }) {
  if (!token)      throw new Error('[examTrainingService] token is required');
  if (!uid)        throw new Error('[examTrainingService] uid is required');
  if (!exerciseId) throw new Error('[examTrainingService] exerciseId is required');

  const key     = buildSeenKey(exerciseType, lang);
  const updated = [...new Set([...currentSeenIds, exerciseId])];

  const response = await fetch(`${PROXY_URL}/api/firestore`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    // Dot-notation key updates only this entry in the seenExerciseIds map.
    // The Firestore PATCH handler uses update() so sibling keys are preserved.
    body: JSON.stringify({
      collection: 'users',
      id:         uid,
      data:       { [`seenExerciseIds.${key}`]: updated },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(json?.error ?? json?.message ?? '[examTrainingService] Failed to mark exercise as seen');
  }
}

// ---------------------------------------------------------------------------
// Public API — high-level
// ---------------------------------------------------------------------------

/**
 * Fetch an unseen exercise from the shared pool, or generate a new one
 * when the pool is exhausted for this user.
 *
 * Algorithm:
 *  1. Read the user's seenExerciseIds[key] from Firestore.
 *  2. Query examExercisePool WHERE exerciseType + lang + level match (limit 50).
 *  3. Find the first pool doc whose ID is NOT in seenIds.
 *     a. Found → serve it, fire-and-forget timesServed++, mark as seen.
 *     b. Not found → generate a new exercise via AI, save to pool, mark as seen.
 *
 * @param {GetExerciseParams} params
 * @returns {Promise<ExerciseDoc>}
 */
export async function getExercise({ token, uid, level, exerciseType, lang = 'pt-PT' }) {
  if (!token)        throw new Error('[examTrainingService] token is required');
  if (!uid)          throw new Error('[examTrainingService] uid is required');
  if (!level)        throw new Error('[examTrainingService] level is required');
  if (!exerciseType) throw new Error('[examTrainingService] exerciseType is required');

  // Step 1 — read what the user has already seen (parallel with Step 2)
  const [seenIds, poolDocs] = await Promise.all([
    getSeenExerciseIds(token, uid, exerciseType, lang),
    fetchPoolExercises(token, exerciseType, lang, level),
  ]);

  // Step 2 — find first unseen doc in the pool
  const unseenDoc = poolDocs.find((doc) => !seenIds.includes(doc.id));

  if (unseenDoc) {
    // Serve the cached exercise
    incrementTimesServed(token, unseenDoc.id); // fire-and-forget
    await markExerciseSeen({
      token, uid, exerciseType, lang,
      exerciseId:     unseenDoc.id,
      currentSeenIds: seenIds,
    });
    return unseenDoc;
  }

  // Step 3 — pool exhausted for this user: generate a fresh exercise
  let generated;
  if (exerciseType === 'writing') {
    generated = await generateWritingPrompt({ token, level });
  } else {
    // Placeholder for future exercise types (listening, reading, full_exam)
    throw new Error(`[examTrainingService] getExercise: exerciseType "${exerciseType}" is not yet supported`);
  }

  // Save to the shared pool (non-fatal if it fails)
  const newDocId = await saveExerciseToPool(token, exerciseType, lang, level, generated);

  // Mark as seen immediately
  await markExerciseSeen({
    token, uid, exerciseType, lang,
    exerciseId:     newDocId,
    currentSeenIds: seenIds,
  });

  return {
    id:           newDocId,
    exerciseType,
    lang,
    level,
    prompt:       generated.prompt,
    instructions: generated.instructions,
    minWords:     generated.minWords,
    maxWords:     generated.maxWords,
    timesServed:  0,
  };
}

/**
 * Generate a CEFR-appropriate writing exercise prompt in pt-PT.
 * Low-level — prefer getExercise() which handles pooling automatically.
 *
 * @param {GenerateWritingPromptParams} params
 * @returns {Promise<GenerateWritingPromptResult>}
 */
export async function generateWritingPrompt({ token, level }) {
  if (!token) throw new Error('[examTrainingService] token is required');
  if (!level) throw new Error('[examTrainingService] level is required');

  const { min, max } = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;

  const prompt = [
    `You are a Portuguese language examiner creating a writing exercise for CEFR level ${level}.`,
    `The exercise must be in European Portuguese (pt-PT).`,
    ``,
    `Create a realistic writing task appropriate for level ${level}.`,
    `The task should require the student to write between ${min} and ${max} words.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "prompt": "<the scenario/context description shown to the student>",`,
    `  "instructions": ["<bullet instruction 1>", "<bullet instruction 2>", ...],`,
    `  "minWords": ${min},`,
    `  "maxWords": ${max}`,
    `}`,
    ``,
    `Rules:`,
    `- The prompt and instructions must be written in European Portuguese (pt-PT).`,
    `- The instructions array should have 3 to 5 bullet points guiding what to include.`,
    `- Keep the scenario realistic and age-appropriate for a language learner.`,
    `- Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const raw = await callAskAI(token, prompt);

  if (!raw) throw new Error('[examTrainingService] Empty response from AI');

  const data = parseJSON(raw);

  if (!data?.prompt || !Array.isArray(data?.instructions)) {
    throw new Error('[examTrainingService] Unexpected response shape from generateWritingPrompt');
  }

  return {
    prompt:       data.prompt,
    instructions: data.instructions,
    minWords:     data.minWords ?? min,
    maxWords:     data.maxWords ?? max,
  };
}

/**
 * Evaluate a student's written text against the 5-parameter CEFR rubric
 * used in official pt-PT certification exams (e.g. CAPLE/DIPLE).
 *
 * Rubric parameters (each scored 1–5):
 *   A. Tema, tipologia, informação e coerência
 *   B. Estrutura e coesão
 *   C. Morfologia e sintaxe
 *   D. Vocabulário
 *   E. Ortografia
 *
 * Word count penalty (applied after summing A–E):
 *   −1 point  : 20 words below min OR 20 words above max
 *   −2 points : more than 20 words below min OR above max
 *
 * @param {EvaluateWritingParams} params
 * @returns {Promise<EvaluateWritingResult>}
 */
export async function evaluateWriting({ token, level, exercisePrompt, userText }) {
  if (!token)          throw new Error('[examTrainingService] token is required');
  if (!level)          throw new Error('[examTrainingService] level is required');
  if (!exercisePrompt) throw new Error('[examTrainingService] exercisePrompt is required');
  if (!userText?.trim()) throw new Error('[examTrainingService] userText is required');

  const wordCount        = countWords(userText);
  const wordCountPenalty = calcWordCountPenalty(wordCount, level);
  const { min, max }     = WORD_COUNT_BOUNDS[level] ?? WORD_COUNT_BOUNDS.A1;

  const prompt = [
    `You are an expert Portuguese language examiner evaluating a CEFR ${level} writing exercise.`,
    `The student was asked to write in European Portuguese (pt-PT).`,
    ``,
    `--- EXERCISE PROMPT ---`,
    exercisePrompt,
    `--- END EXERCISE PROMPT ---`,
    ``,
    `--- STUDENT TEXT ---`,
    userText.trim(),
    `--- END STUDENT TEXT ---`,
    ``,
    `Evaluate the student text using the following 5 parameters, each scored from 1 to 5:`,
    ``,
    `A. Tema, tipologia, informação e coerência`,
    `   5: Fully follows task instructions, coherent, complete information.`,
    `   3: Partially follows instructions, generally coherent with some gaps.`,
    `   1: Insufficient task completion, very little intelligible content.`,
    ``,
    `B. Estrutura e coesão`,
    `   5: Well-defined structure, correct paragraphing, punctuation, cohesive devices, appropriate verb tenses.`,
    `   3: Satisfactory structure with minor inconsistencies in cohesion and verb tense.`,
    `   1: Very poor structure, breaks in cohesion, inconsistent verb tenses.`,
    ``,
    `C. Morfologia e sintaxe`,
    `   5: Good command of sentence construction, agreement, word order. Uses complex structures.`,
    `   3: Acceptable command with some errors in agreement, selection, inflection.`,
    `   1: Poor command, serious errors throughout. No complex structures.`,
    ``,
    `D. Vocabulário`,
    `   5: Adequate, diverse, appropriate vocabulary for the topic.`,
    `   3: Adequate but limited vocabulary with occasional inadequacies.`,
    `   1: Limited, redundant, often inappropriate vocabulary.`,
    ``,
    `E. Ortografia`,
    `   5: Correct spelling or at most 1 error per 60 words.`,
    `   3: Some spelling errors (~4 per 60 words).`,
    `   1: Many spelling errors (more than 7 per 60 words).`,
    ``,
    `Important:`,
    `- Scores may be intermediate values (e.g. 2, 4) when between levels.`,
    `- Expected word count range: ${min}–${max} words. Student wrote ${wordCount} words.`,
    `- Do NOT apply the word count penalty yourself — it will be applied programmatically.`,
    `- Write all feedback in the same language as the student's interface (English unless detected otherwise).`,
    `- Be specific and constructive in each parameter's feedback.`,
    ``,
    `Return ONLY a valid JSON object with this exact shape:`,
    `{`,
    `  "parameters": [`,
    `    { "id": "A", "name": "Tema, tipologia, informação e coerência", "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "B", "name": "Estrutura e coesão",                      "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "C", "name": "Morfologia e sintaxe",                    "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "D", "name": "Vocabulário",                             "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" },`,
    `    { "id": "E", "name": "Ortografia",                              "score": <1-5>, "maxScore": 5, "feedback": "<specific feedback>" }`,
    `  ],`,
    `  "generalFeedback": "<overall constructive feedback paragraph>"`,
    `}`,
    ``,
    `Do NOT include any text outside the JSON object.`,
  ].join('\n');

  const raw = await callAskAI(token, prompt);

  if (!raw) throw new Error('[examTrainingService] Empty response from AI');

  const data = parseJSON(raw);

  if (!Array.isArray(data?.parameters) || data.parameters.length !== 5) {
    throw new Error('[examTrainingService] Unexpected response shape from evaluateWriting');
  }

  const rawScore   = data.parameters.reduce((sum, p) => sum + (p.score ?? 0), 0);
  const totalScore = Math.max(0, rawScore - wordCountPenalty);

  return {
    totalScore,
    maxScore: 25,
    rawScore,
    wordCount,
    wordCountPenalty,
    parameters:      data.parameters,
    generalFeedback: data.generalFeedback ?? '',
  };
}
