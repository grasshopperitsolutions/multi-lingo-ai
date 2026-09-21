/**
 * recordingStore.js
 *
 * Keeps the **most recent** pronunciation take in this browser, so a reload,
 * a wrong turn, or a request that failed does not cost somebody the reading
 * they just did.
 *
 * IndexedDB rather than localStorage because the thing being kept is a Blob:
 * localStorage holds strings, and base64-ing a recording into it would inflate
 * it by a third and blow through the ~5MB quota on a long take.
 *
 * **It never leaves the device.** Nothing here syncs, uploads, or reaches
 * Firestore — the only copy that goes anywhere is the one attached inline to
 * the feedback request, which is written nowhere. That is the distinction the
 * privacy policy draws: §6 describes what *we* retain, and this is storage the
 * reader holds and can clear.
 *
 * **One record, replaced each time.** A history of takes is a pile of
 * recordings of somebody's voice sitting on their laptop, which is the
 * opposite of what this feature promises. Asking for a new passage or pressing
 * Clear removes it, and anything older than MAX_AGE_MS is dropped on read
 * rather than resurfacing days later.
 */

const DB_NAME = "mlai-voice";
const DB_VERSION = 1;
const STORE = "takes";
const KEY = "last";

/** A take older than this is stale enough that returning it would be a surprise. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Every call is wrapped: IndexedDB throws outright in a private window on some
 * browsers, and is disabled entirely by some privacy settings. Losing the
 * ability to restore a take is a small loss; taking the page down with it
 * would not be.
 */
function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function run(mode, work) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = work(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/**
 * Replace the stored take.
 *
 * The passage is stored beside the recording because a recording on its own is
 * useless — there would be nothing to compare it against or to read again.
 *
 * @param {{blob: Blob, mimeType: string, passage: object}} take
 * @returns {Promise<boolean>} false when the browser would not store it
 */
export async function saveTake({ blob, mimeType, passage }) {
  try {
    await run("readwrite", (store) =>
      store.put({ blob, mimeType, passage, createdAt: Date.now() }, KEY)
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * The stored take, or null — including when it is too old to be worth offering.
 *
 * @returns {Promise<{blob: Blob, mimeType: string, passage: object}|null>}
 */
export async function loadTake() {
  try {
    const take = await run("readonly", (store) => store.get(KEY));
    if (!take?.blob) return null;
    if (Date.now() - (take.createdAt ?? 0) > MAX_AGE_MS) {
      // Read is where expiry is enforced, because there is no background job
      // here and a stale recording must not outlive its welcome quietly.
      await clearTake();
      return null;
    }
    return { blob: take.blob, mimeType: take.mimeType, passage: take.passage };
  } catch {
    return null;
  }
}

/** Remove it. Called on Clear, and whenever a new passage is requested. */
export async function clearTake() {
  try {
    await run("readwrite", (store) => store.delete(KEY));
    return true;
  } catch {
    return false;
  }
}
