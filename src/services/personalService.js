/**
 * personalService.js
 *
 * Everything a user writes for themselves: notes, the phrases they are
 * collecting, mistakes worth remembering, questions for their next lesson,
 * and a small settings document holding the lesson counter and their goal.
 *
 * ## Where it lives
 *
 * `users/{uid}/<kind>` subcollections. This is the first feature in the
 * frontend to use them, but the backend has supported them all along: reads,
 * queries, PUT, PATCH and DELETE are all owner-gated by
 * `usersSubcollectionOwner` in the API's firestore-helpers, and account
 * deletion already recurses into them (`deleteSubCollections`), so nothing
 * here needs a cleanup path of its own.
 *
 * One subcollection per kind rather than one collection with a `kind` field:
 * the queries need no filter and therefore no composite index, and the
 * server's 200-document page cap applies per kind instead of across all four.
 *
 * ## Three rules that are easy to get wrong
 *
 * 1. **Never send `createdAt`.** The proxy stamps `createdBy`, `createdAt` and
 *    `updatedAt` on POST; a client value is overwritten anyway.
 * 2. **Never use `orderBy`.** Firestore drops documents missing the ordered
 *    field entirely, so one document written before a field existed would
 *    vanish from the list rather than sort oddly. Sorting happens in code,
 *    exactly as reportService does it.
 * 3. **The settings document is written with POST-and-an-id, not PUT.** PUT
 *    and PATCH both 404 when a document does not exist, and it will not exist
 *    on a user's first visit. POST with an explicit id merges at the root,
 *    which makes it a safe upsert that preserves the fields it is not writing.
 */

import {
  createDocument,
  queryCollection,
  patchDocument,
  deleteDocument,
  getDocument,
} from "./firestoreService";

/** The subcollection each kind lives in, under `users/{uid}`. */
export const PERSONAL_KINDS = {
  NOTE: "personalNotes",
  PHRASE: "personalPhrases",
  MISTAKE: "personalMistakes",
  QUESTION: "personalQuestions",
};

const SETTINGS_COLLECTION = "personalSettings";
const SETTINGS_DOC_ID = "main";

/** The server caps a page at 200 however large a limit is asked for. */
export const PERSONAL_PAGE_LIMIT = 200;

function collectionFor(uid, kind) {
  if (!uid) throw new Error("[personalService] uid is required");
  if (!Object.values(PERSONAL_KINDS).includes(kind)) {
    throw new Error(`[personalService] Unknown kind: ${kind}`);
  }
  return `users/${uid}/${kind}`;
}

/** Firestore timestamps arrive as {_seconds}; the UI wants something sortable. */
function timestampToIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  const seconds = value._seconds ?? value.seconds;
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Every item of one kind, newest first.
 *
 * @param {{token: string, uid: string, kind: string}} params
 * @returns {Promise<{items: object[], atLimit: boolean}>}
 */
export async function listPersonalItems({ token, uid, kind }) {
  const result = await queryCollection(
    collectionFor(uid, kind),
    {},
    { limit: PERSONAL_PAGE_LIMIT },
    token,
  );

  const documents = result?.documents ?? [];
  const items = documents
    .map((doc) => ({
      ...doc,
      createdAt: timestampToIso(doc.createdAt),
      updatedAt: timestampToIso(doc.updatedAt),
    }))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  // Worth telling the user rather than silently showing a truncated list.
  return { items, atLimit: documents.length >= PERSONAL_PAGE_LIMIT };
}

/**
 * Add one item. The server stamps the timestamps.
 *
 * @returns {Promise<object>} the created document, id included
 */
export async function addPersonalItem({ token, uid, kind, data }) {
  const created = await createDocument(collectionFor(uid, kind), data, undefined, token);
  return { id: created?.id, ...data };
}

/** Merge fields into one item. */
export async function updatePersonalItem({ token, uid, kind, id, data }) {
  if (!id) throw new Error("[personalService] id is required");
  return patchDocument(collectionFor(uid, kind), id, data, token);
}

/** Remove one item for good. */
export async function removePersonalItem({ token, uid, kind, id }) {
  if (!id) throw new Error("[personalService] id is required");
  return deleteDocument(collectionFor(uid, kind), id, token);
}

/**
 * The lesson counter and the goal.
 *
 * Returns defaults rather than null when nothing has been saved yet, so the
 * pages never have to special-case a first visit.
 *
 * @returns {Promise<{lessonsRemaining: number, goalLabel: string, goalDate: string, weeklyTarget: number}>}
 */
export async function getPersonalSettings({ token, uid }) {
  if (!uid) throw new Error("[personalService] uid is required");

  const doc = await getDocument(`users/${uid}/${SETTINGS_COLLECTION}`, SETTINGS_DOC_ID, token);
  const data = doc?.data ?? {};

  return {
    lessonsRemaining: Number.isFinite(data.lessonsRemaining) ? data.lessonsRemaining : 0,
    goalLabel: data.goalLabel ?? "",
    goalDate: data.goalDate ?? "",
    weeklyTarget: Number.isFinite(data.weeklyTarget) ? data.weeklyTarget : 0,
  };
}

/**
 * Save part of the settings document, creating it if this is the first time.
 *
 * POST with an explicit id rather than PUT/PATCH: those 404 on a document that
 * does not exist yet, and POST merges at the root, so a partial patch keeps
 * the fields it does not mention.
 *
 * @param {{token: string, uid: string, patch: object}} params
 */
export async function savePersonalSettings({ token, uid, patch }) {
  if (!uid) throw new Error("[personalService] uid is required");
  return createDocument(
    `users/${uid}/${SETTINGS_COLLECTION}`,
    patch,
    SETTINGS_DOC_ID,
    token,
  );
}
