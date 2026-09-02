/**
 * reportService.js
 *
 * User reports (bugs, wrong translations, inappropriate content) are stored
 * in Firestore at `appConfig/config/reports` and read from the Admin page.
 *
 * This previously opened a pre-filled WhatsApp chat, which meant a report
 * only existed if the user remembered to press Send inside WhatsApp, left no
 * record anywhere, and could not be tracked or triaged.
 *
 * Writes go through the shared proxy like every other Firestore access — see
 * the collection policy for `appConfig/config/reports` in the API repo
 * (`lib/collection-policies.ts`): any signed-in user may file one, only an
 * admin may read them back.
 */

import { createDocument, queryCollection, updateDocument, deleteDocument, getTokenOrAnonymous } from './firestoreService';
import { auth } from '../firebase';

const REPORTS_COLLECTION = 'appConfig/config/reports';

/**
 * File a report.
 *
 * @param {Object} params
 * @param {string} params.category  - One of the ReportModal categories
 * @param {string} params.message   - User-written description
 * @param {string} [params.context] - Page/component the report came from
 * @returns {Promise<void>}
 */
export async function submitReport({ category, message, context }) {
  // Anonymous sessions are allowed: a guest hitting a broken public page
  // should still be able to tell us about it.
  const token = await getTokenOrAnonymous();
  const user = auth?.currentUser;

  await createDocument(
    REPORTS_COLLECTION,
    {
      category,
      message: message.trim(),
      context: context || null,
      // Denormalized so the Admin list needs no extra lookups, and so the
      // report survives the reporter deleting their account.
      reporterUid: user?.uid || null,
      reporterEmail: user?.email || null,
      reporterName: user?.displayName || null,
      // Drives the unread count in the nightly digest email.
      read: false,
      // No createdAt here on purpose: POST /api/firestore stamps its own
      // server timestamp and would overwrite anything we sent.
    },
    undefined, // auto-generated id
    token
  );
}

/**
 * Firestore timestamps arrive from the proxy as { _seconds, _nanoseconds },
 * not as a Date or an ISO string. Normalizing here keeps that detail out of
 * the component, which would otherwise render "[object Object]".
 *
 * @param {unknown} value
 * @returns {string|null} ISO string, or null when there is nothing usable.
 */
function timestampToIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const seconds = value._seconds ?? value.seconds;
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Every report, newest first. Admin-only — the collection policy rejects a
 * non-admin read, so this throws for anyone else.
 *
 * @returns {Promise<Array<object>>}
 */
export async function getReports() {
  const token = await auth.currentUser.getIdToken();
  const result = await queryCollection(REPORTS_COLLECTION, {}, {}, token);

  return (result?.documents ?? [])
    .map((doc) => ({ ...doc, createdAt: timestampToIso(doc.createdAt) }))
    // Sorted in code rather than with a Firestore orderBy: a document missing
    // createdAt would be dropped from an ordered query entirely.
    .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

/**
 * Flip a report's read flag. Admin-only.
 *
 * @param {string} id
 * @param {boolean} read
 */
export async function setReportRead(id, read) {
  const token = await auth.currentUser.getIdToken();
  await updateDocument(REPORTS_COLLECTION, id, { read }, token);
}

/**
 * Permanently delete a report. Admin-only.
 *
 * @param {string} id
 */
export async function removeReport(id) {
  const token = await auth.currentUser.getIdToken();
  await deleteDocument(REPORTS_COLLECTION, id, token);
}
