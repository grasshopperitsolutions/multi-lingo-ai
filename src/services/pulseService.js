/**
 * pulseService.js
 *
 * Loads what Admin › Pulse counts. Read-only, and only through the generic
 * Firestore proxy: the admin users list, the tier config, and whole
 * collections asked for with `select`, so each document arrives as the few
 * fields being counted — never a tale's text, a clip's audio or a message's
 * body.
 *
 * Collections are read whole and filtered by date in the browser. The proxy's
 * filters take JSON values, and a JSON string never compares equal to a
 * Firestore Timestamp, so a server-side `createdAt >=` filter would match
 * nothing. The plan's Phase 3 snapshot is what replaces this when it stops
 * being cheap.
 */

import { queryCollection } from "./firestoreService";
import { listAllUserProfiles } from "./userService";
import { getTiersConfig } from "./tiersConfigService";
import { getReports } from "./reportService";

/** Well above any collection today; the proxy's own cap is 100,000. */
const READ_LIMIT = 20_000;

/**
 * Every collection Pulse counts, with the only fields it reads. `required`
 * ones fail the whole page (Phase 1's numbers are the page); the rest fail
 * alone, so one unreadable collection costs one card.
 */
export const PULSE_SOURCES = {
  stories: { collection: "stories", select: ["createdAt", "targetLang", "level", "theme"], required: true },
  historyFacts: { collection: "historyFacts", select: ["createdAt", "targetLang"], required: true },
  examExercises: { collection: "examExercises", select: ["createdAt", "type", "level", "language"], required: true },
  languages: { collection: "appConfig/config/languages", select: ["createdAt", "code", "label"], required: true },
  pronunciationPassages: { collection: "pronunciationPassages", select: ["createdAt", "targetLang", "level"] },
  grammarTopics: { collection: "grammarTopics", select: ["createdAt", "status"] },
  grammarExercises: { collection: "grammarExercises", select: ["createdAt", "type", "level", "language"] },
  wordPool: { collection: "wordPool", select: ["createdAt", "topicIds", "status"] },
  wordLinkGamePool: { collection: "wordLinkGamePool", select: ["createdAt"] },
  wordLadderGamePool: { collection: "wordLadderGamePool", select: ["createdAt"] },
  ttsClips: { collection: "ttsClips", select: ["createdAt", "voice", "language", "bytes"] },
  locales: { collection: "appConfig/config/locales", select: ["createdAt"] },
  categories: { collection: "appConfig/config/categories", select: ["label"] },
  tutors: { collection: "tutors", select: ["createdAt", "published", "languages"] },
  tutorApplications: { collection: "appConfig/config/tutorApplications", select: ["createdAt", "read"] },
  contactSubmissions: { collection: "contactSubmissions", select: ["createdAt"] },
  mailQueue: { collection: "mailQueue", select: ["createdAt", "sentAt", "status"] },
  // Phase 3, written by the API (lib/pulse.ts, lib/pulse-snapshot.ts): small
  // documents of counts, one per day or week, read whole.
  pulseCounters: { collection: "appConfig/pulse/counters" },
  pulseDays: { collection: "appConfig/pulse/days" },
  pulseWeeks: { collection: "appConfig/pulse/weeks" },
};

async function readCollection({ collection, select }, token) {
  const result = await queryCollection(collection, {}, { limit: READ_LIMIT, select }, token);
  return result?.documents ?? [];
}

/**
 * @param {string} token - Firebase ID token of an admin.
 * @returns {Promise<{ users: object[], tiersConfig: object, reports: object[],
 *   errors: Record<string, string> } & Record<string, object[]>>}
 *   One array per PULSE_SOURCES key; an optional source that failed is `[]`
 *   with its message in `errors`.
 */
export async function loadPulseData(token) {
  const entries = Object.entries(PULSE_SOURCES);
  const [users, tiersConfig, reports, settled] = await Promise.all([
    listAllUserProfiles(token),
    getTiersConfig(token),
    getReports(),
    Promise.allSettled(entries.map(([, source]) => readCollection(source, token))),
  ]);

  const data = { users, tiersConfig, reports, errors: {} };
  settled.forEach((outcome, i) => {
    const [key, source] = entries[i];
    if (outcome.status === "fulfilled") {
      data[key] = outcome.value;
    } else if (source.required) {
      throw outcome.reason;
    } else {
      data[key] = [];
      data.errors[key] = outcome.reason?.message ?? String(outcome.reason);
    }
  });
  return data;
}
