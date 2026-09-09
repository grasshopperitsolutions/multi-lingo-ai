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
    // From the account, like the name and the email. It used to come from a
    // URL field in the form whose *placeholder* was the account picture, so a
    // tutor who left it alone published photoURL: null and their card showed
    // no image. One identity, one picture, changed in one place.
    photoURL: user.photoURL ?? null,
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
 * Creates the minimal hidden profile "Become a tutor" writes.
 *
 * Nothing here is a guess the tutor has to correct later: name, picture and
 * email come from the account exactly as saveTutorProfile takes them, so the
 * document this creates and the document a first real save would produce
 * agree field-for-field. Only `description` and `languages` start empty —
 * the two things only the tutor can supply — and `published` starts false,
 * because a directory listing with an empty description is not something
 * anyone should see yet.
 *
 * This is the one place a tutor document is created without the caller
 * having filled in a description first; every other write path (saveTutor-
 * Profile) requires one. That is deliberate: existing is not the same as
 * listed, and the whole point of a draft is to let it be neither complete
 * nor public for a while.
 */
export async function createTutorDraft() {
  const user = auth?.currentUser;
  if (!user) throw new Error("You must be signed in to become a tutor");

  const token = await user.getIdToken();

  const payload = {
    displayName: user.displayName?.trim() ?? "",
    description: "",
    photoURL: user.photoURL ?? null,
    languages: [],
    email: user.email ?? null,
    phone: null,
    whatsapp: false,
    links: [],
    published: false,
  };

  // Same call saveTutorProfile makes — create-or-update via a POST keyed to
  // the caller's own uid. The server's own-doc-id + tier policy is what
  // actually decides whether this succeeds; an ineligible tier gets a 403
  // here exactly as it would from saveTutorProfile.
  await createDocument(TUTORS_COLLECTION, payload, user.uid, token);
  return payload;
}

/**
 * Mirrors an account identity change onto the tutor profile.
 *
 * The name is denormalized onto the tutor document because the public
 * directory has no way to read `users`. That makes this the one field that
 * can drift, so the settings save path calls this straight after updating the
 * account name.
 *
 * The picture rides along for the same reason: the directory cannot read
 * `users`, so the card renders a copy, and a tutor who changes their avatar in
 * Settings would otherwise keep the old one in the directory forever.
 *
 * A no-op when the user has no profile, and never throws: failing to mirror an
 * identity must not fail the settings save that triggered it.
 *
 * @param {string} uid
 * @param {string} displayName
 * @param {string|null} [photoURL] - pass undefined to leave the stored one alone
 */
export async function syncTutorIdentity(uid, displayName, photoURL) {
  if (!uid || !displayName?.trim()) return;
  try {
    const existing = await getTutorProfile(uid);
    if (!existing) return;

    const patch = {};
    if (existing.displayName !== displayName.trim()) patch.displayName = displayName.trim();
    if (photoURL !== undefined && existing.photoURL !== photoURL) patch.photoURL = photoURL ?? null;

    // Nothing drifted — skip the write rather than touching updatedAt for no
    // reason on every settings save.
    if (Object.keys(patch).length === 0) return;

    const token = await auth.currentUser.getIdToken();
    await updateDocument(TUTORS_COLLECTION, uid, patch, token);
  } catch (err) {
    console.warn(`[tutorService] Could not mirror the account identity onto the tutor profile: ${err.message}`);
  }
}

/**
 * @deprecated Use syncTutorIdentity, which also mirrors the picture.
 * Kept so an older call site cannot silently stop mirroring the name.
 */
export const syncTutorDisplayName = (uid, displayName) => syncTutorIdentity(uid, displayName);

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
