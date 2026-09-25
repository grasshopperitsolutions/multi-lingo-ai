/**
 * practicePool.js
 *
 * Helpers shared by the AI-written practice pools — Grammar Practice
 * (grammarExercises) and Exam Training (examExercises). Both use the same
 * shape: one exercise per document at *language* level, with its content per
 * *dialect* underneath, so an exercise can later be adapted across the
 * dialects of a language instead of written again. See
 * plans/multi-dialect-practice.md.
 *
 * Everything here has to survive a pool that does not exist yet: a missing
 * document is null, never an error.
 */

import { getDocument } from "./firestoreService";

/** "pt-PT" → "pt". The pool query key; dialects are filtered in code. */
export function baseLanguage(dialect) {
  return String(dialect ?? "").split("-")[0].toLowerCase();
}

/**
 * getDocument resolves to `{ id, data }`, or null on a 404. Hand back the
 * fields, and treat any failure as "not there", since a pool read that throws
 * would otherwise cost the learner the whole request.
 */
export async function getDataOrNull(collection, id, token) {
  try {
    const doc = await getDocument(collection, id, token);
    return doc?.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Pool ids are made on the client so the content can be written before the
 * root document that points at it — a failed write then leaves an orphan
 * nobody can see rather than a root with nothing under it.
 */
export function newPoolId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Fisher–Yates, so two learners at the same level don't walk the pool in the same order. */
export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
