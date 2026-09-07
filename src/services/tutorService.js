import {
  getDocument,
  createDocument,
  queryCollection,
  updateDocument,
  deleteDocument,
  getTokenOrAnonymous,
} from "./firestoreService";
import { auth } from "../firebase";
import { isLinkValidated } from "./tutorUrlValidation";

/**
 * The public tutor directory.
 *
 * Profiles live in a top-level `tutors` collection keyed by uid, NOT in a map
 * on the user document. That is forced by the authorization model rather than
 * chosen: a non-admin cannot query the `users` collection or read another
 * user's `users/{uid}` document at all (authorizeUsersScopedRead in the API
 * repo), so a directory sourced from user documents could never be displayed.
 *
 * `tutors` is declared `{ read: 'public', write: 'own-doc-id', writeTiers:
 * ['maestro','vip','admin'] }` in the API's lib/collection-policies.ts. The
 * uid lock and the tier gate are both enforced server-side — the tier check
 * in this file is only there so the UI can explain itself, and is not what
 * keeps anyone out.
 */

const TUTORS_COLLECTION = "tutors";
const APPLICATIONS_COLLECTION = "appConfig/config/tutorApplications";

/** Tiers permitted to publish a profile. Must match `writeTiers` in the API. */
export const TUTOR_TIERS = ["maestro", "vip", "admin"];

/** Whether a tier may publish. Advisory — the server decides. */
export function canBeTutor(tier) {
  return TUTOR_TIERS.includes(tier);
}

/**
 * Firestore timestamps arrive from the proxy as { _seconds, _nanoseconds },
 * not as a Date or an ISO string. Same helper as reportService — normalizing
 * at the edge keeps the shape out of the components.
 */
function timestampToIso(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value._seconds === "number") {
    return new Date(value._seconds * 1000).toISOString();
  }
  return null;
}

function normalizeTutor(doc) {
  return {
    ...doc,
    uid: doc.id,
    links: Array.isArray(doc.links) ? doc.links : [],
    languages: Array.isArray(doc.languages) ? doc.languages : [],
    createdAt: timestampToIso(doc.createdAt),
    updatedAt: timestampToIso(doc.updatedAt),
  };
}

/**
 * Every published profile.
 *
 * Guests included — the collection is `public` read, and the directory is the
 * whole point of it. Filtering on `published` happens in code rather than as a
 * Firestore filter so a profile missing the field entirely is not silently
 * dropped from the list.
 */
export async function listTutors() {
  const token = await getTokenOrAnonymous();
  // queryCollection resolves the API envelope to
  // { documents, collection, hasMore, lastDocumentId } — not a bare array.
  const result = await queryCollection(TUTORS_COLLECTION, {}, {}, token);
  return (result?.documents ?? [])
    .map(normalizeTutor)
    .filter((tutor) => tutor.published !== false);
}

/** One profile, or null when the user has never created one. */
export async function getTutorProfile(uid) {
  if (!uid) return null;
  const token = await getTokenOrAnonymous();
  try {
    // getDocument resolves to { id, data, collection }; the body is `data`.
    const doc = await getDocument(TUTORS_COLLECTION, uid, token);
    if (!doc?.data) return null;
    return normalizeTutor({ ...doc.data, id: uid });
  } catch {
    // A missing document is the ordinary case for anyone who hasn't
    // published yet, and is not worth surfacing as an error.
    return null;
  }
}

/**
 * Creates or updates the signed-in user's own profile.
 *
 * The document id is always the caller's uid — the server refuses anything
 * else, so passing a different one here would only produce a 403.
 *
 * Every link must carry a current validation. This is re-checked here rather
 * than trusted from the form so a stale component state cannot save an
 * unvalidated URL onto a public page.
 */
export async function saveTutorProfile(profile) {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in to publish a tutor profile");

  const links = (profile.links ?? []).filter((link) => link.url?.trim());
  const unvalidated = links.filter((link) => !isLinkValidated(link));
  if (unvalidated.length > 0) {
    throw new Error("Every link must be validated before the profile can be saved");
  }

  const token = await user.getIdToken();

  const payload = {
    // Taken from the account, never from the form. A tutor is a user, so
    // there is one name: changing it means changing the account display name,
    // which syncTutorDisplayName() below mirrors across. Denormalized because
    // the public directory cannot read `users` to look it up.
    displayName: user.displayName?.trim() ?? "",
    description: profile.description?.trim() ?? "",
    photoURL: profile.photoURL?.trim() || null,
    languages: profile.languages ?? [],
    // Denormalized from the account so the public page needs no user lookup —
    // which it could not do anyway, since `users` is not publicly readable.
    email: user.email ?? null,
    phone: profile.phone?.trim() || null,
    whatsapp: Boolean(profile.phone?.trim()) && Boolean(profile.whatsapp),
    links: links.map((link) => ({
      url: link.url.trim(),
      label: link.label.trim(),
      platform: link.platform ?? null,
      validatedBy: link.validatedBy ?? null,
      validatedAt: link.validatedAt ?? null,
      validatedUrl: link.validatedUrl ?? link.url.trim(),
    })),
    published: profile.published !== false,
  };

  // createDocument POSTs, which merges onto an existing document rather than
  // replacing it, so this is create-or-update in one call. No createdAt here:
  // the proxy stamps its own and would overwrite anything sent.
  await createDocument(TUTORS_COLLECTION, payload, user.uid, token);
  return payload;
}

/**
 * Mirrors an account display-name change onto the tutor profile.
 *
 * The name is denormalized onto the tutor document because the public
 * directory has no way to read `users`. That makes this the one field that
 * can drift, so the settings save path calls this straight after updating the
 * account name.
 *
 * A no-op when the user has no profile, and never throws: failing to mirror a
 * name must not fail the settings save that triggered it.
 */
export async function syncTutorDisplayName(uid, displayName) {
  if (!uid || !displayName?.trim()) return;
  try {
    const existing = await getTutorProfile(uid);
    if (!existing) return;
    if (existing.displayName === displayName.trim()) return;

    const token = await auth.currentUser.getIdToken();
    await updateDocument(TUTORS_COLLECTION, uid, { displayName: displayName.trim() }, token);
  } catch (err) {
    console.warn(`[tutorService] Could not mirror the display name onto the tutor profile: ${err.message}`);
  }
}

/** Removes the signed-in user's profile from the directory. */
export async function unpublishTutorProfile() {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in");
  const token = await user.getIdToken();
  await updateDocument(TUTORS_COLLECTION, user.uid, { published: false }, token);
}

// ─────────────────────────────────────────────────────────────────────────────
// Applications
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies to be listed as a tutor.
 *
 * Same shape as a report: the applicant files their own document, and only an
 * admin can read them back. There is no `approved` field — approval means an
 * admin granting the applicant the `vip` tier in the Users panel, which is
 * what the server-side tier gate on `tutors` actually checks.
 */
export async function submitTutorApplication({ instagram, postUrl, message }) {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in to apply");

  const token = await user.getIdToken();

  await createDocument(
    APPLICATIONS_COLLECTION,
    {
      instagram: instagram?.trim() ?? "",
      postUrl: postUrl?.trim() ?? "",
      message: message?.trim() ?? "",
      // Denormalized so the admin list needs no extra lookups, and so the
      // application survives the applicant deleting their account.
      applicantUid: user.uid,
      applicantEmail: user.email ?? null,
      applicantName: user.displayName ?? null,
      read: false,
    },
    undefined,
    token,
  );
}

/** Admin: every application, newest first. */
export async function listTutorApplications() {
  const token = await auth.currentUser.getIdToken();
  const result = await queryCollection(APPLICATIONS_COLLECTION, {}, {}, token);
  return (result?.documents ?? [])
    .map((doc) => ({ ...doc, createdAt: timestampToIso(doc.createdAt) }))
    // Sorted in code, not with a Firestore orderBy: a document missing the
    // sort field would be dropped from the query entirely.
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

/** Admin: mark an application read or unread. */
export async function setApplicationRead(id, read) {
  const token = await auth.currentUser.getIdToken();
  await updateDocument(APPLICATIONS_COLLECTION, id, { read }, token);
}

/** Admin: delete an application. */
export async function removeApplication(id) {
  const token = await auth.currentUser.getIdToken();
  await deleteDocument(APPLICATIONS_COLLECTION, id, token);
}
