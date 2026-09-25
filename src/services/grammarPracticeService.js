/**
 * grammarPracticeService.js
 *
 * Grammar Practice: AI-written exercises served from a shared pool.
 *
 * Nothing is pre-filled. The pool starts empty and grows from the first
 * request: read what exists, generate only when the learner has seen
 * everything that matches, write it back so the next learner gets it free.
 *
 * Firestore schema:
 *
 *   grammarExercises/{exerciseId}               one exercise, at language level
 *     language: "pt"                             base language (query key)
 *     originDialect: "pt-PT"
 *     dialects: ["pt-PT"]                        dialects that have content
 *     portability: "unknown"                     decided when porting exists
 *     type, openAnswer, topicKey, family, focus, level, itemCount
 *     fingerprints: string[]                     for the duplicate check
 *     status: "ready" | "draft" | "blocked"
 *     source: "ai", verified: false, qualityScore: null, createdAt, updatedAt
 *
 *   grammarExercises/{id}/content/{dialect}     items + answer key
 *   grammarExercises/{id}/gloss/{dialect}__{lang}  what the learner reads in
 *                                                their own language (2-letter lang)
 *
 *   grammarTopics/{dialect}__{key}              topics the model names that are
 *     status: "practice"                         not known yet. getTopics() only
 *                                                reads "ready", so Structures
 *                                                never shows these.
 *
 * Everything here must survive collections that do not exist yet: an empty
 * query result means "nothing yet", a missing document is null, and queries
 * use equality filters only, so they never need a composite index.
 */

import { queryCollection, createDocument } from "./firestoreService";
import { askAI } from "./aiService";
import { getPrompt, renderTemplate } from "./promptService";
import { parseAIJSON } from "../utils/parseAIJSON";
import { availablePracticeTypes, isOpenAnswerType, DEFAULT_ITEM_COUNT } from "../config/grammarPracticeTypes";
import {
  sanitizeExercise,
  MIN_ITEMS,
  ITEM_GLOSS_FIELDS,
  EXERCISE_GLOSS_FIELDS,
} from "../utils/grammarExerciseValidators";
import { dropDuplicates, fingerprint } from "../utils/grammarDuplicates";
import { baseLanguage, getDataOrNull, newPoolId, shuffle } from "./practicePool";

// Kept importable from here: callers and tests already use it.
export { baseLanguage };

export const EXERCISES_COLLECTION = "grammarExercises";
export const TOPICS_COLLECTION = "grammarTopics";
export const PRACTICE_PROMPT_ID = "grammar-practice-prompt";
export const GLOSS_PROMPT_ID = "grammar-practice-gloss-prompt";
export const CHECK_PROMPT_ID = "grammar-practice-check-prompt";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const POOL_LIMIT = 100;
/** Below this many surviving items, generate once more before giving up. */
const RETRY_BELOW = 6;
const MAX_AVOID = 40;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Topic keys are made up by the model, so they are normalised here rather
 * than by asking the model to format them: lower case, ASCII, hyphens.
 */
export function normalizeTopicKey(key) {
  return String(key ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/**
 * Topic keys known for a dialect: the Structures topics plus the ones Grammar
 * Practice has recorded. An empty list is a normal answer — the picker then
 * offers only "Surprise me".
 *
 * @param {{ token: string, dialect: string }} params
 * @returns {Promise<Array<{ key: string, family: string, status: string }>>}
 */
export async function getKnownTopics({ token, dialect }) {
  if (!token || !dialect) return [];
  try {
    const result = await queryCollection(TOPICS_COLLECTION, { targetLang: dialect }, { limit: 500 }, token);
    const docs = result?.documents ?? [];
    return docs
      .filter((doc) => doc.key && (doc.status === "ready" || doc.status === "practice"))
      .map((doc) => ({ key: doc.key, family: doc.family ?? "", status: doc.status }))
      .sort((a, b) => a.key.localeCompare(b.key));
  } catch (err) {
    console.warn("[grammarPracticeService] could not read topics", err);
    return [];
  }
}

async function registerTopic({ token, dialect, key, family, level, known }) {
  if (!key || known.has(key)) return;
  try {
    await createDocument(
      TOPICS_COLLECTION,
      {
        key,
        family: family || "",
        targetLang: dialect,
        status: "practice",
        source: "ai",
        levels: [level],
        createdAt: new Date().toISOString(),
      },
      `${dialect}__${key}`,
      token
    );
  } catch (err) {
    // A topic that fails to register only costs the picker one entry.
    console.warn("[grammarPracticeService] could not register topic", key, err);
  }
}

// ---------------------------------------------------------------------------
// Gloss (the learner-language layer)
// ---------------------------------------------------------------------------

/** Split reader-language text off an exercise. */
export function splitGloss(exercise) {
  const gloss = { items: {} };
  const content = { ...exercise, items: [] };
  for (const field of EXERCISE_GLOSS_FIELDS) {
    if (exercise[field]) gloss[field] = exercise[field];
    delete content[field];
  }
  for (const item of exercise.items ?? []) {
    const entry = {};
    const kept = { ...item };
    for (const field of ITEM_GLOSS_FIELDS) {
      if (item[field]) entry[field] = item[field];
      delete kept[field];
    }
    if (Object.keys(entry).length) gloss.items[item.id] = entry;
    content.items.push(kept);
  }
  delete content.topicKey;
  delete content.family;
  delete content.focus;
  return { content, gloss };
}

/** Put the reader-language text back onto the items for display. */
export function mergeGloss(content, gloss) {
  const items = (content?.items ?? []).map((item) => ({ ...item, ...(gloss?.items?.[item.id] ?? {}) }));
  const merged = { ...content, items };
  for (const field of EXERCISE_GLOSS_FIELDS) {
    if (gloss?.[field]) merged[field] = gloss[field];
  }
  return merged;
}

const glossId = (dialect, locale) => `${dialect}__${baseLanguage(locale)}`;

/**
 * The gloss for a reader language, translated and cached on first use. Falls
 * back to whichever gloss exists rather than showing nothing — an explanation
 * in the wrong language beats no explanation.
 */
async function getGloss({ token, exerciseId, dialect, explanationLocale, targetLang }) {
  const collection = `${EXERCISES_COLLECTION}/${exerciseId}/gloss`;
  const wanted = await getDataOrNull(collection, glossId(dialect, explanationLocale), token);
  if (wanted) return wanted;

  let fallback = null;
  try {
    const any = await queryCollection(collection, {}, { limit: 1 }, token);
    fallback = any?.documents?.[0] ?? null;
  } catch {
    fallback = null;
  }
  if (!fallback) return { items: {} };

  try {
    const promptDoc = await getPrompt(GLOSS_PROMPT_ID);
    const fields = {};
    for (const field of EXERCISE_GLOSS_FIELDS) if (fallback[field]) fields[field] = fallback[field];
    fields.items = fallback.items ?? {};
    const prompt = renderTemplate(promptDoc.template, {
      targetLang,
      sourceLang: fallback.locale ?? "the source language",
      targetLocale: explanationLocale,
      fieldsJson: JSON.stringify(fields),
    });
    const data = await askAI(
      token,
      prompt,
      {
        provider: "gemini",
        model: promptDoc.model || GEMINI_MODEL,
        explorerModel: promptDoc.explorerModel,
        temperature: 0.2,
        jsonMode: true,
        ...(promptDoc.maxTokens ? { maxOutputTokens: promptDoc.maxTokens } : {}),
      },
      { skipConfirm: true }
    );
    const parsed = parseAIJSON(data?.text ?? "");
    if (!parsed || typeof parsed !== "object") return fallback;
    const gloss = {
      ...parsed,
      items: parsed.items && typeof parsed.items === "object" ? parsed.items : {},
      locale: explanationLocale,
    };
    try {
      await createDocument(collection, gloss, glossId(dialect, explanationLocale), token);
    } catch (err) {
      console.warn("[grammarPracticeService] could not cache gloss", err);
    }
    return gloss;
  } catch (err) {
    console.warn("[grammarPracticeService] gloss translation failed", err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * One strict schema per type: only that type's fields, all required.
 *
 * A single loose schema listing every field of every type (with only `id`
 * and `explanation` required) was tried first and fails in production: the
 * model drops the fields it is not forced to write — `answers` above all —
 * and fills the unused ones with junk, so every item fails validation.
 */
const STR = { type: "string" };
const LIST = { type: "array", items: { type: "string" } };
const FIELD_TYPES = {
  id: STR, groupId: STR, prompt: STR, source: STR, cue: STR, cueLabel: STR, constraint: STR,
  options: LIST, fragments: LIST, parts: LIST, answers: LIST, sampleAnswers: LIST,
  isCorrect: { type: "boolean" }, position: { type: "integer" }, explanation: STR,
  topicKey: STR, family: STR, focus: STR, focusLabel: STR, instructions: STR,
  operation: STR, labels: LIST, passage: STR, wordBank: LIST,
};
const ITEM_FIELDS = {
  "choose-option": ["id", "prompt", "options", "answers", "explanation"],
  "multi-select": ["id", "source", "options", "answers", "explanation"],
  "judge-correct": ["id", "prompt", "isCorrect", "answers", "explanation"],
  classify: ["id", "prompt", "answers", "explanation"],
  "word-order": ["id", "fragments", "answers", "explanation"],
  conjugate: ["id", "prompt", "cue", "cueLabel", "answers", "explanation"],
  "conjugate-contrast": ["id", "groupId", "prompt", "cue", "answers", "explanation"],
  "gap-by-cue": ["id", "prompt", "cueLabel", "answers", "explanation"],
  inflect: ["id", "prompt", "cueLabel", "answers", "explanation"],
  "fill-from-bank": ["id", "position", "answers", "explanation"],
  transform: ["id", "prompt", "answers", "explanation"],
  "build-sentence": ["id", "parts", "answers", "explanation"],
  translate: ["id", "source", "answers", "explanation"],
  "open-completion": ["id", "prompt", "constraint", "sampleAnswers", "explanation"],
};
const EXTRA_TOP_FIELDS = {
  classify: ["labels"],
  "fill-from-bank": ["passage", "wordBank"],
  transform: ["operation"],
};
const TOP_FIELDS = ["topicKey", "family", "focus", "focusLabel", "instructions"];

const objectOf = (fields, extra = {}) => ({
  type: "object",
  properties: { ...Object.fromEntries(fields.map((f) => [f, FIELD_TYPES[f]])), ...extra },
  required: [...fields, ...Object.keys(extra)],
});

/** @param {string} type */
export function schemaForType(type) {
  const itemFields = ITEM_FIELDS[type];
  if (!itemFields) return undefined;
  return objectOf([...TOP_FIELDS, ...(EXTRA_TOP_FIELDS[type] ?? [])], {
    items: { type: "array", items: objectOf(itemFields) },
  });
}

async function generateOnce({ token, promptDoc, type, variables }) {
  const variant = (promptDoc.variants ?? []).find((v) => v.key === type);
  if (!variant?.template) {
    throw new Error(`[grammarPracticeService] ${PRACTICE_PROMPT_ID} has no "${type}" variant`);
  }
  const prompt = renderTemplate(variant.template, variables);
  const data = await askAI(token, prompt, {
    provider: "gemini",
    model: promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    temperature: 0.6,
    jsonMode: true,
    responseSchema: schemaForType(type),
    ...(promptDoc.maxTokens ? { maxOutputTokens: promptDoc.maxTokens } : {}),
  });
  let parsed;
  try {
    parsed = parseAIJSON(data?.text ?? "");
  } catch (err) {
    // Truncated or runaway JSON counts as a failed attempt, not a crash.
    return { exercise: null, problems: [`unparseable response: ${err.message}`] };
  }
  return sanitizeExercise(type, parsed);
}

/**
 * Generate, validate and de-duplicate one exercise, retrying once when too
 * many items were dropped.
 */
async function generateExercise({ token, type, level, dialect, explanationLocale, topicKey, customTopic = "", knownTopics, cellDocs, interests }) {
  const promptDoc = await getPrompt(PRACTICE_PROMPT_ID);

  const sameType = cellDocs.filter((doc) => doc.type === type);
  const existingPrints = sameType.flatMap((doc) => doc.fingerprints ?? []);
  const topicCounts = new Map();
  sameType.forEach((doc) => topicCounts.set(doc.topicKey, (topicCounts.get(doc.topicKey) ?? 0) + 1));
  const commonTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => key)
    .filter(Boolean);

  const avoidList = existingPrints.map((print) => print.split(" | ")[0]).slice(-MAX_AVOID);

  const buildVariables = () => ({
    targetLang: dialect,
    explanationLang: explanationLocale,
    level,
    // A picked key, the learner's own words, or "open" for Surprise me.
    topic: topicKey || customTopic || "open",
    knownTopics: knownTopics.length ? knownTopics.join(", ") : "(none yet)",
    commonTopics: commonTopics.length ? commonTopics.join(", ") : "(none)",
    itemCount: String(DEFAULT_ITEM_COUNT),
    interests: interests || "(none)",
    avoid: avoidList.length ? avoidList.join("; ") : "(none)",
  });

  let best = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { exercise, problems } = await generateOnce({ token, promptDoc, type, variables: buildVariables() });
    if (problems.length) console.info("[grammarPracticeService] validation", problems);
    if (!exercise) continue;

    const { kept, dropped } = dropDuplicates(exercise.items, existingPrints);
    const candidate = { ...exercise, items: kept };
    if (!best || kept.length > best.items.length) best = candidate;
    if (kept.length >= RETRY_BELOW) break;
    dropped.forEach((item) => avoidList.push(fingerprint(item).split(" | ")[0]));
  }

  if (!best || best.items.length < MIN_ITEMS) {
    throw new Error("GRAMMAR_PRACTICE_GENERATION_FAILED");
  }
  // A learner who picked a topic gets that topic, whatever key the model used.
  // Typed-in words are not a key: the model names that topic itself, so the
  // exercise joins the pool under a key the next learner can pick.
  best.topicKey = normalizeTopicKey(topicKey || best.topicKey) || "general";
  return best;
}

/**
 * Write children first and the root last, so a failed write leaves an orphan
 * nobody can see instead of a root pointing at missing content. Writing is
 * best effort: the learner has already paid for the exercise, so a failure
 * here still serves it.
 *
 * @returns {Promise<string|null>} the exercise id, or null if not stored
 */
async function writeExercise({ token, exercise, type, level, dialect, explanationLocale }) {
  const id = newPoolId();
  const now = new Date().toISOString();
  const { content, gloss } = splitGloss(exercise);
  try {
    await createDocument(`${EXERCISES_COLLECTION}/${id}/content`, {
      ...content,
      dialect,
      adaptedFrom: null,
      createdAt: now,
    }, dialect, token);
    await createDocument(`${EXERCISES_COLLECTION}/${id}/gloss`, {
      ...gloss,
      locale: explanationLocale,
    }, glossId(dialect, explanationLocale), token);
    await createDocument(EXERCISES_COLLECTION, {
      language: baseLanguage(dialect),
      originDialect: dialect,
      dialects: [dialect],
      portability: "unknown",
      type,
      openAnswer: isOpenAnswerType(type),
      topicKey: exercise.topicKey,
      family: exercise.family || "",
      focus: exercise.focus || "",
      level,
      itemCount: exercise.items.length,
      fingerprints: exercise.items.map(fingerprint),
      status: "ready",
      source: "ai",
      verified: false,
      qualityScore: null,
      createdAt: now,
      updatedAt: now,
    }, id, token);
    return id;
  } catch (err) {
    console.warn("[grammarPracticeService] could not store exercise", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The next unseen exercise for this learner, or a fresh one.
 *
 * @param {object} params
 * @param {string} params.token
 * @param {string} params.dialect            - the learner's learningDialect
 * @param {string} params.explanationLocale  - the learner's interfaceLang
 * @param {string} params.level              - CEFR level
 * @param {string} [params.type]             - a type key, or empty for any
 * @param {string} [params.topicKey]         - a topic key, or empty for Surprise me
 * @param {string} [params.customTopic]      - free text from "Other"; always generates.
 *                                             Gated by the caller like custom requests.
 * @param {boolean} [params.canOpenAnswer]   - may this learner get open-answer types
 * @param {string[]} [params.seenIds]
 * @param {string} [params.interests]        - comma-separated labels
 * @returns {Promise<{ exerciseId: string|null, type: string, topicKey: string, level: string, source: 'db'|'ai', exercise: object }>}
 */
export async function getPracticeExercise({
  token,
  dialect,
  explanationLocale,
  level,
  type = "",
  topicKey = "",
  customTopic = "",
  canOpenAnswer = false,
  seenIds = [],
  interests = "",
}) {
  if (!token) throw new Error("[grammarPracticeService] token is required");
  if (!dialect) throw new Error("[grammarPracticeService] dialect is required");
  if (!level) throw new Error("[grammarPracticeService] level is required");

  const allowed = availablePracticeTypes({ canOpenAnswer });
  if (type && !allowed.includes(type)) throw new Error("GRAMMAR_PRACTICE_TYPE_LOCKED");
  const custom = String(customTopic ?? "").trim().slice(0, 200);
  const topic = custom ? "" : normalizeTopicKey(topicKey);
  const locale = explanationLocale || "en-US";

  const filters = { language: baseLanguage(dialect), level, status: "ready" };
  if (type) filters.type = type;
  if (topic) filters.topicKey = topic;

  // An empty collection — or one that does not exist yet — is an empty list.
  const result = await queryCollection(EXERCISES_COLLECTION, filters, { limit: POOL_LIMIT }, token);
  const cellDocs = (result?.documents ?? []).filter((doc) => allowed.includes(doc.type));

  const seen = new Set(seenIds);
  const candidates = shuffle(
    cellDocs.filter((doc) => !seen.has(doc.id) && (doc.dialects ?? []).includes(dialect))
  );

  // Words someone typed can never match a pooled exercise, so "Other" skips
  // straight to generating — which is why it is gated like custom requests.
  for (const doc of custom ? [] : candidates) {
    const content = await getDataOrNull(`${EXERCISES_COLLECTION}/${doc.id}/content`, dialect, token);
    if (!content?.items?.length) continue;
    const gloss = await getGloss({ token, exerciseId: doc.id, dialect, explanationLocale: locale, targetLang: dialect });
    return {
      exerciseId: doc.id,
      type: doc.type,
      topicKey: doc.topicKey,
      level: doc.level,
      source: "db",
      exercise: mergeGloss(content, gloss),
    };
  }

  const known = await getKnownTopics({ token, dialect });
  const knownKeys = known.map((t) => t.key);
  const generatedType = type || allowed[Math.floor(Math.random() * allowed.length)];

  const exercise = await generateExercise({
    token,
    type: generatedType,
    level,
    dialect,
    explanationLocale: locale,
    topicKey: topic,
    customTopic: custom,
    knownTopics: knownKeys,
    cellDocs,
    interests,
  });

  await registerTopic({
    token,
    dialect,
    key: exercise.topicKey,
    family: exercise.family,
    level,
    known: new Set(knownKeys),
  });

  const exerciseId = await writeExercise({ token, exercise, type: generatedType, level, dialect, explanationLocale: locale });
  const { content, gloss } = splitGloss(exercise);

  return {
    exerciseId,
    type: generatedType,
    topicKey: exercise.topicKey,
    level,
    source: "ai",
    exercise: mergeGloss(content, gloss),
  };
}

// ---------------------------------------------------------------------------
// Open answers (Maestro and up)
// ---------------------------------------------------------------------------

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    acceptable: { type: "boolean" },
    correctedAnswer: { type: "string" },
    explanation: { type: "string" },
  },
  required: ["acceptable", "correctedAnswer", "explanation"],
};

/** The item as the learner saw it, in one line for the check prompt. */
function describeItem(item) {
  if (item?.source) return item.source;
  if (Array.isArray(item?.parts)) return item.parts.join(" · ");
  return String(item?.prompt ?? "").replace(/\[\[|\]\]/g, "");
}

/** What the learner was asked to do, from the exercise and the item. */
function describeTask(exercise, item) {
  return [exercise?.instructions, exercise?.operation, item?.constraint].filter(Boolean).join(" — ");
}

/**
 * Mark one typed sentence with the model. Every open-answer item is marked
 * this way — the key is context for the model, never the judge — and nothing
 * is stored: these types are Maestro and up, whose AI calls are unlimited.
 *
 * @returns {Promise<{ acceptable: boolean, correctedAnswer: string, explanation: string }>}
 */
export async function checkOpenAnswer({
  token,
  dialect,
  explanationLocale,
  level,
  exercise,
  item,
  answer,
}) {
  if (!token) throw new Error("[grammarPracticeService] token is required");
  if (!String(answer ?? "").trim()) throw new Error("[grammarPracticeService] answer is required");

  const promptDoc = await getPrompt(CHECK_PROMPT_ID);
  const accepted = [...(item?.answers ?? []), ...(item?.sampleAnswers ?? [])];
  const prompt = renderTemplate(promptDoc.template, {
    targetLang: dialect,
    explanationLang: explanationLocale || "en-US",
    level,
    task: describeTask(exercise, item) || "(none)",
    item: describeItem(item) || "(none)",
    acceptedAnswers: accepted.length ? accepted.join(" | ") : "(none)",
    learnerAnswer: String(answer).trim(),
  });

  const data = await askAI(token, prompt, {
    provider: "gemini",
    model: promptDoc.model || GEMINI_MODEL,
    explorerModel: promptDoc.explorerModel,
    temperature: 0.2,
    jsonMode: true,
    responseSchema: CHECK_SCHEMA,
    ...(promptDoc.maxTokens ? { maxOutputTokens: promptDoc.maxTokens } : {}),
  });
  const parsed = parseAIJSON(data?.text ?? "");
  const verdict = {
    acceptable: parsed?.acceptable === true,
    correctedAnswer: String(parsed?.correctedAnswer ?? "").trim(),
    explanation: String(parsed?.explanation ?? "").trim(),
  };

  return verdict;
}
