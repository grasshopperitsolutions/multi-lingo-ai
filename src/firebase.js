import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Guard against SSR/SSG environments where env vars are absent
let app = null;
let auth = null;

if (firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  console.warn('[firebase] No API key found — skipping init (SSG build mode)');
}

/**
 * Firebase Cloud Messaging handle, or null where push isn't available.
 *
 * Lazy and guarded on purpose: getMessaging() throws outright in a browser
 * with no Push API (Safari before 16.4, any private window that blocks
 * service workers), and isSupported() is the only reliable way to ask. It's
 * never called during app boot -- only when the user actually turns web
 * notifications on -- so a browser that can't do push pays nothing for it.
 *
 * @returns {Promise<import('firebase/messaging').Messaging | null>}
 */
export const getMessagingIfSupported = async () => {
  if (!app) return null;
  try {
    return (await isSupported()) ? getMessaging(app) : null;
  } catch (err) {
    console.warn('[firebase] Messaging unavailable:', err.message);
    return null;
  }
};

export { auth };
export default app;
