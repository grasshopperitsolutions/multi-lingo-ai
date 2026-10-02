/**
 * getImageService.js
 *
 * The picture games' side of "one picture per word".
 *
 * A picture belongs to a CONCEPT (`wordPool/{conceptId}`), not to a word in one
 * language: a cake is a cake in every language, so one picture serves every
 * learner and every game, and the first player to need it pays for it once.
 * This is the same pattern as conceptIconService, with one difference that
 * matters: the picture is **drawn on the server**, never built here.
 *
 * What lives where
 * ----------------
 *   conceptPictures/{conceptId}   status, url, width, height, reports…
 *                                 readable by any signed-in account, written
 *                                 only by the API (nobody can plant a picture).
 *   pictureScenes/{id}            a several-things-in-one picture, same terms.
 *
 * This file only ever READS those collections directly. Drawing, reporting and
 * scenes all go through `/api/ask-ai` as its `picture` mode: the request names a
 * concept id and nothing else, so the browser cannot choose what is drawn (see
 * lib/pictures.ts in the API repo for why that matters).
 *
 * Cost model
 * ----------
 * Pictures do not spend the daily AI allowance, so every call here passes
 * `skipConfirm`: a confirmation modal asking about decoration would be worse
 * than the decoration. What bounds the spend is on the server (one picture per
 * word ever, a per-account cap, never for guests), and the cap is the one
 * thing worth stopping for here: past it, asking again is pointless.
 *
 * Nothing in this file throws on a missing picture. A game with no picture for
 * a word simply does not use that word.
 */

import { askAI } from "./aiService";
import { queryCollection } from "./firestoreService";
import { getPrompt, renderTemplate } from "./promptService";
import { parseAIJSON } from "../utils/parseAIJSON";
import { normalizeForMatch } from "../utils/pictureRound";

export const PICTURES_COLLECTION = "conceptPictures";
export const SCENES_COLLECTION = "pictureScenes";

/** Drawing takes seconds (a model call, a resize and an upload); askAI's default 25s is too tight. */
const PICTURE_TIMEOUT_MS = 90_000;

/** The pool is a few hundred small documents, read whole and filtered in code. */
const POOL_LIMIT = 100_000;

/** The prompt document each request is labelled with, for Admin › Pulse. A label only. */
const PICTURE_FEATURE = "concept-picture-prompt";
const SCENE_FEATURE = "picture-scene-prompt";

// ── Our own bucket, and nothing else ────────────────────────────────────────

/**
 * Where our pictures are served from: the public origin of the Firebase bucket.
 * Null when the bucket is not configured, in which case nothing passes.
 */
function bucketOrigin() {
  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  return bucket ? `https://storage.googleapis.com/${bucket}/` : null;
}

/**
 * Whether a URL is one of our own pictures.
 *
 * A second guard, not the first: only the server writes these documents. But a
 * `url` is rendered into an `<img src>` for every player, so the browser checks
 * it points at our bucket's picture folder before it draws it, rather than
 * trusting that nothing upstream ever went wrong. Fails closed: with no bucket
 * configured, nothing is shown.
 *
 * @param {unknown} url
 * @param {"concept"|"scene"} [kind]
 * @returns {boolean}
 */
export function isOwnPictureUrl(url, kind = "concept") {
  const origin = bucketOrigin();
  if (!origin || typeof url !== "string") return false;
  const folder = kind === "scene" ? SCENES_COLLECTION : PICTURES_COLLECTION;
  return url.startsWith(`${origin}${folder}/`);
}

// ── A short memory, so one round of a game does not read the pool six times ─

const CACHE_TTL_MS = 60_000;
const cache = new Map();

function remember(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = load();
  cache.set(key, { at: Date.now(), promise });
  // A failed read must not be remembered: the next game should try again.
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

/** Forget everything read so far (a picture was just drawn, or a test starts). */
export function clearPictureCache() {
  cache.clear();
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * Every picture document, whatever its status, keyed by concept id.
 *
 * Whole documents are small, but `select` keeps the five fields the games use.
 * Status matters beyond `ready`: a word the server decided cannot be drawn
 * (`skipped`) or that the model declined (`failed`) is not a candidate for
 * asking again, and only this index says so.
 *
 * @param {string} token
 * @returns {Promise<Map<string, {status: string, url?: string, width?: number, height?: number, reports?: number}>>}
 */
export function getPictureIndex(token) {
  return remember(`index:${token ? "t" : "none"}`, async () => {
    const result = await queryCollection(
      PICTURES_COLLECTION,
      {},
      { select: ["status", "url", "width", "height", "reports"], limit: POOL_LIMIT },
      token,
    );
    return new Map((result?.documents ?? []).map((doc) => [doc.id, doc]));
  });
}

/**
 * The pictures that are ready to show, keyed by concept id.
 *
 * @param {string} token
 * @returns {Promise<Map<string, {url: string, width?: number, height?: number}>>}
 */
export async function getReadyPictures(token) {
  const index = await getPictureIndex(token);
  const ready = new Map();
  for (const [conceptId, doc] of index) {
    if (doc.status === "ready" && isOwnPictureUrl(doc.url)) {
      ready.set(conceptId, { url: doc.url, width: doc.width, height: doc.height });
    }
  }
  return ready;
}

/**
 * The pictures that exist for these concepts, keyed by concept id. A concept
 * with no picture is simply absent from the Map.
 *
 * One read of the whole (small) collection answers any number of ids, which is
 * what "batched" means here: asking per concept would be a request each.
 *
 * @param {string[]} conceptIds
 * @param {string} token
 * @returns {Promise<Map<string, {url: string, width?: number, height?: number}>>}
 */
export async function getConceptPictures(conceptIds, token) {
  const ready = await getReadyPictures(token);
  const wanted = new Map();
  for (const conceptId of conceptIds ?? []) {
    if (ready.has(conceptId)) wanted.set(conceptId, ready.get(conceptId));
  }
  return wanted;
}

/**
 * @typedef {Object} PictureConcept
 * @property {string}   id
 * @property {string}   sourceWord   English label, e.g. "cat". Never shown to a learner.
 * @property {string|null} senseKey
 * @property {string[]} topicIds
 * @property {string}   url          The picture, on our own bucket.
 * @property {number}   [width]
 * @property {number}   [height]
 */

/**
 * The words the picture games draw from: ready concepts, joined with their
 * pictures.
 *
 * `pictured` have a picture and can be played. `unpictured` are ready concepts
 * the server has never been asked about, which is what a thin pool fills
 * itself from. A concept the server skipped, or whose picture the model
 * declined, is in neither list.
 *
 * @param {string} token
 * @returns {Promise<{ pictured: PictureConcept[], unpictured: Array<{id: string, sourceWord: string, topicIds: string[], pos: string|null}> }>}
 */
export async function getPicturePool(token) {
  const [index, concepts] = await Promise.all([
    getPictureIndex(token),
    remember("concepts", async () => {
      const result = await queryCollection(
        "wordPool",
        { status: "ready" },
        { select: ["sourceWord", "senseKey", "pos", "topicIds", "normalizedKey"], limit: POOL_LIMIT },
        token,
      );
      return result?.documents ?? [];
    }),
  ]);

  const pictured = [];
  const unpictured = [];

  for (const concept of concepts) {
    const topicIds = Array.isArray(concept.topicIds) ? concept.topicIds : [];
    const picture = index.get(concept.id);

    if (!picture) {
      if (concept.sourceWord) {
        unpictured.push({
          id: concept.id,
          sourceWord: concept.sourceWord,
          topicIds,
          pos: concept.pos ?? null,
        });
      }
      continue;
    }

    if (picture.status === "ready" && isOwnPictureUrl(picture.url)) {
      pictured.push({
        id: concept.id,
        sourceWord: concept.sourceWord ?? "",
        senseKey: concept.senseKey ?? null,
        topicIds,
        url: picture.url,
        width: picture.width,
        height: picture.height,
      });
    }
  }

  return { pictured, unpictured };
}

// ── Asking the server to draw ───────────────────────────────────────────────

/**
 * Ask for one word's picture. Resolves to what the server answered, and never
 * rejects: a game must not stop because a decoration could not be made.
 *
 * `code` is the server's reason for a refusal: `PICTURE_CAP` (the account's
 * daily cap) or `PICTURE_GUEST`. Either means asking for more is pointless.
 *
 * @param {string} conceptId
 * @param {string} token
 * @returns {Promise<{status: "ready"|"pending"|"skipped"|"failed"|"error", url: string|null, code?: string}>}
 */
export async function requestPicture(conceptId, token) {
  if (!conceptId || !token) return { status: "error", url: null };

  try {
    const data = await askAI(
      token,
      "",
      { provider: "gemini", feature: PICTURE_FEATURE, picture: { conceptId } },
      { skipConfirm: true, timeout: PICTURE_TIMEOUT_MS },
    );
    const picture = data?.picture;
    if (picture?.status === "ready" && isOwnPictureUrl(picture.url)) {
      clearPictureCache();
      return { status: "ready", url: picture.url };
    }
    return { status: picture?.status ?? "error", url: null };
  } catch (err) {
    console.warn(`[getImageService] picture for "${conceptId}" failed:`, err.message);
    return { status: "error", url: null, code: err.code };
  }
}

/**
 * The same, as the plan names it: a URL or null, never an error.
 *
 * @param {string} conceptId
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function requestConceptPicture(conceptId, token) {
  return (await requestPicture(conceptId, token)).url;
}

/**
 * Ask for pictures one at a time, the way icons are asked for, so a thin pool
 * grows in the background while the game starts with what exists.
 *
 * Sequential on purpose: each is a model call, and several at once would
 * compete with whatever the player does next. Stops at the first refusal that
 * means "no more" (the daily cap, a guest), and when the caller goes away.
 *
 * @param {string[]} conceptIds
 * @param {{
 *   token: string,
 *   onPicture?: (conceptId: string, url: string) => void,
 *   max?: number,
 *   isCancelled?: () => boolean,
 * }} options
 * @returns {Promise<number>} how many pictures were drawn or found
 */
export async function fillPictures(conceptIds, { token, onPicture, max = 4, isCancelled = () => false } = {}) {
  let got = 0;
  let asked = 0;

  for (const conceptId of conceptIds ?? []) {
    if (asked >= max || isCancelled()) break;
    asked += 1;

    const result = await requestPicture(conceptId, token);
    if (isCancelled()) break;

    if (result.status === "ready") {
      got += 1;
      onPicture?.(conceptId, result.url);
    } else if (result.code === "PICTURE_CAP" || result.code === "PICTURE_GUEST") {
      break;
    }
  }

  return got;
}

/**
 * "This picture does not match its word." Counted once per account, on the
 * server. Resolves to whether it was counted; never rejects.
 *
 * @param {string} conceptId
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function reportPicture(conceptId, token) {
  if (!conceptId || !token) return false;
  try {
    const data = await askAI(
      token,
      "",
      { provider: "gemini", feature: PICTURE_FEATURE, picture: { action: "report", conceptId } },
      { skipConfirm: true },
    );
    clearPictureCache();
    return data?.picture?.reported === true;
  } catch (err) {
    console.warn(`[getImageService] report for "${conceptId}" failed:`, err.message);
    return false;
  }
}

/**
 * Admin: draw a word's picture again. Returns the new URL, or null.
 *
 * @param {string} conceptId
 * @param {string} token
 * @returns {Promise<string|null>}
 */
export async function regeneratePicture(conceptId, token) {
  if (!conceptId || !token) return null;
  try {
    const data = await askAI(
      token,
      "",
      { provider: "gemini", feature: PICTURE_FEATURE, picture: { action: "regenerate", conceptId } },
      { skipConfirm: true, timeout: PICTURE_TIMEOUT_MS },
    );
    clearPictureCache();
    const picture = data?.picture;
    return picture?.status === "ready" && isOwnPictureUrl(picture.url) ? picture.url : null;
  } catch (err) {
    console.warn(`[getImageService] regenerate for "${conceptId}" failed:`, err.message);
    return null;
  }
}

// ── Scenes ──────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PictureScene
 * @property {string}   id
 * @property {string}   url
 * @property {string[]} conceptIds
 * @property {string[]} sourceWords
 * @property {string|null} topicId
 */

/**
 * Every scene that is ready, newest first. Sorted in code: Firestore's
 * `orderBy` silently drops a document missing the field.
 *
 * @param {string} token
 * @returns {Promise<PictureScene[]>}
 */
export async function getScenes(token) {
  const result = await remember("scenes", () =>
    queryCollection(
      SCENES_COLLECTION,
      { status: "ready" },
      { select: ["url", "conceptIds", "sourceWords", "topicId", "createdAt"], limit: POOL_LIMIT },
      token,
    ),
  );

  return (result?.documents ?? [])
    .filter((doc) => isOwnPictureUrl(doc.url, "scene") && Array.isArray(doc.conceptIds))
    .map((doc) => ({
      id: doc.id,
      url: doc.url,
      conceptIds: doc.conceptIds,
      sourceWords: Array.isArray(doc.sourceWords) ? doc.sourceWords : [],
      topicId: doc.topicId ?? null,
      createdAt: doc.createdAt ?? null,
    }))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")) || a.id.localeCompare(b.id));
}

/**
 * The next scene this player has not seen, preferring ones on their interests.
 * Null when they have seen them all (or there are none yet).
 *
 * @param {{ token: string, seenIds?: string[], preferTopicIds?: string[] }} options
 * @returns {Promise<PictureScene|null>}
 */
export async function getNextScene({ token, seenIds = [], preferTopicIds = [] }) {
  const scenes = await getScenes(token);
  return chooseScene(scenes, { seenIds, preferTopicIds });
}

/**
 * The scenes this player has not seen, in the order to try them: a scene on one
 * of their interests first, then the newest. Empty when they have seen them
 * all (or there are none yet).
 *
 * The pure half of getNextScene, so the rule is testable without a network.
 *
 * @param {PictureScene[]} scenes
 * @param {{ seenIds?: string[], preferTopicIds?: string[] }} [options]
 * @returns {PictureScene[]}
 */
export function rankScenes(scenes, { seenIds = [], preferTopicIds = [] } = {}) {
  const seen = new Set(seenIds);
  const wanted = new Set(preferTopicIds);
  const unseen = (scenes ?? []).filter((scene) => !seen.has(scene.id));
  const onInterest = (scene) => Boolean(scene.topicId && wanted.has(scene.topicId));
  // Stable: equal ranks keep getScenes' newest-first order.
  return [...unseen].sort((a, b) => Number(onInterest(b)) - Number(onInterest(a)));
}

/**
 * The first of rankScenes, or null.
 *
 * @param {PictureScene[]} scenes
 * @param {{ seenIds?: string[], preferTopicIds?: string[] }} [options]
 * @returns {PictureScene|null}
 */
export function chooseScene(scenes, options) {
  return rankScenes(scenes, options)[0] ?? null;
}

/**
 * Ask the server for a new scene from 4–6 pictured words. Unlimited tiers only
 * (Maestro), ten a day; the server decides, and says why when it refuses.
 *
 * Rejects, unlike the word picture: the page has to tell the player *why* there
 * is no new scene. `err.code` is `SCENE_TIER` or `PICTURE_CAP`.
 *
 * @param {string[]} conceptIds
 * @param {string} token
 * @returns {Promise<PictureScene>}
 */
export async function requestScene(conceptIds, token) {
  const data = await askAI(
    token,
    "",
    { provider: "gemini", feature: SCENE_FEATURE, picture: { action: "scene", conceptIds } },
    { skipConfirm: true, timeout: PICTURE_TIMEOUT_MS },
  );
  const scene = data?.picture;
  if (!scene?.sceneId || !isOwnPictureUrl(scene.url, "scene")) {
    throw new Error("[getImageService] the server returned no scene");
  }
  clearPictureCache();
  return {
    id: scene.sceneId,
    url: scene.url,
    conceptIds: scene.conceptIds ?? conceptIds,
    sourceWords: [],
    topicId: scene.topicId ?? null,
    createdAt: null,
  };
}

// ── Describing a scene ──────────────────────────────────────────────────────

/** Longest description sent to the model. A learner's few sentences are far below it. */
export const MAX_DESCRIPTION_LENGTH = 600;

/**
 * @typedef {Object} DescribeFeedback
 * @property {string} feedback
 * @property {Array<{original: string, corrected: string, explanation: string}>} corrections
 * @property {Array<{word: string, question: string}>} tryNext
 */

/**
 * Feedback on what a learner wrote about a scene.
 *
 * **Which words were found is decided before this is called, in code**
 * (utils/pictureRound.findWordsInText), and handed to the model as a fact. A
 * "found 4 of 6" that a model guessed at is the one thing about this feature
 * that must not be wrong. The model comments on phrasing and on anything else
 * the learner described, and phrases the next words to look for.
 *
 * It is an ordinary AI call: counted against the daily allowance, and it asks
 * first, like every other. The scene itself is attached **on the server** from
 * `sceneId`, so the picture never travels through the browser.
 *
 * `tryNext` is checked against the missed words before it is returned: the
 * model phrases them, but cannot add one.
 *
 * @param {{
 *   token: string,
 *   sceneId: string,
 *   description: string,
 *   level: string,
 *   targetLanguage: string,
 *   nativeLanguage: string,
 *   found: Array<{word: string}>,
 *   missed: Array<{word: string}>,
 * }} params
 * @returns {Promise<DescribeFeedback>}
 */
export async function requestDescribeFeedback({
  token,
  sceneId,
  description,
  level,
  targetLanguage,
  nativeLanguage,
  found,
  missed,
}) {
  const promptDoc = await getPrompt("picture-describe-feedback-prompt");

  // Every variable is a value and always defined, never a sentence.
  const list = (words) => (words.length ? words.map((entry) => entry.word).join(", ") : "none");
  const prompt = renderTemplate(promptDoc.template, {
    targetLanguage,
    nativeLanguage,
    level,
    description: String(description ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH),
    foundWords: list(found),
    missedWords: list(missed),
  });

  const providerParams = {
    provider: "gemini",
    model: promptDoc.model || "gemini-3.5-flash",
    explorerModel: promptDoc.explorerModel,
    // Which prompt this is, for the Pulse counters. A label only.
    feature: promptDoc.id,
    sceneId,
    temperature: 0.4,
    jsonMode: true,
    responseSchema: {
      type: "object",
      properties: {
        feedback: { type: "string" },
        corrections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              original: { type: "string" },
              corrected: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["original", "corrected", "explanation"],
          },
        },
        tryNext: {
          type: "array",
          items: {
            type: "object",
            properties: { word: { type: "string" }, question: { type: "string" } },
            required: ["word", "question"],
          },
        },
      },
      required: ["feedback", "corrections", "tryNext"],
    },
  };
  if (promptDoc.maxTokens) providerParams.maxOutputTokens = promptDoc.maxTokens;

  const data = await askAI(token, prompt, providerParams, { timeout: 60_000 });
  const parsed = parseAIJSON(data?.text ?? "");

  const missedByKey = new Map(missed.map((entry) => [normalizeForMatch(entry.word), entry.word]));
  const tryNext = (Array.isArray(parsed?.tryNext) ? parsed.tryNext : [])
    .filter((entry) => missedByKey.has(normalizeForMatch(entry?.word)) && String(entry?.question ?? "").trim())
    .slice(0, 2)
    .map((entry) => ({
      word: missedByKey.get(normalizeForMatch(entry.word)),
      question: String(entry.question).trim(),
    }));

  return {
    feedback: String(parsed?.feedback ?? "").trim(),
    corrections: (Array.isArray(parsed?.corrections) ? parsed.corrections : [])
      .filter((entry) => String(entry?.original ?? "").trim() && String(entry?.corrected ?? "").trim())
      .slice(0, 5)
      .map((entry) => ({
        original: String(entry.original).trim(),
        corrected: String(entry.corrected).trim(),
        explanation: String(entry.explanation ?? "").trim(),
      })),
    tryNext,
  };
}
