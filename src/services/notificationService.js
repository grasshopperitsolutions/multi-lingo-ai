/**
 * notificationService.js
 *
 * Everything that talks to the backend's /api/email endpoint, plus the
 * browser-side half of web push (permission, service worker, FCM token).
 *
 * Push tokens are stored on the user's own profile document via
 * updateUserProfile() rather than a dedicated endpoint — they're
 * self-owned data, exactly like `theme` or `interfaceLang`, so the existing
 * PUT /api/firestore path already covers them.
 */

import { apiFetch } from './apiClient';
import { getTokenOrAnonymous } from './firestoreService';
import { updateUserProfile } from './userService';
import { getMessagingIfSupported } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

/**
 * Submit the public contact form.
 *
 * Uses getTokenOrAnonymous() so a signed-out visitor can still send: the
 * backend requires *some* verified session purely so the endpoint can't be
 * used as an open mail relay, and anonymous sessions satisfy that.
 *
 * @param {{name: string, email: string, phone?: string, subject: string, message: string}} formData
 * @returns {Promise<void>}
 */
export const sendContactMessage = async (formData) => {
  const token = await getTokenOrAnonymous();
  await apiFetch(
    '/api/email',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { action: 'contact', ...formData },
    },
    'Failed to send message'
  );
};

// ---------------------------------------------------------------------------
// Web push
// ---------------------------------------------------------------------------

/** True when this browser could do web push at all (independent of permission). */
export const isPushAvailable = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator &&
  !!VAPID_KEY;

/** The browser's current permission: 'granted' | 'denied' | 'default' | 'unsupported'. */
export const getPushPermission = () =>
  isPushAvailable() ? Notification.permission : 'unsupported';

/**
 * Registers the FCM service worker.
 *
 * The Firebase config is passed as query parameters because a service
 * worker is a separate top-level script — it can't read import.meta.env or
 * import from the bundle. These values are public client config (they're
 * already in the JS bundle), so there's nothing secret to leak here.
 */
const registerServiceWorker = async () => {
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params}`);
};

/**
 * Ask for notification permission and register this browser for push.
 *
 * Tokens are per-browser, so this appends to the stored list rather than
 * replacing it — a user with a laptop and a phone keeps both.
 *
 * @param {string} token - Firebase ID token
 * @param {string} uid
 * @param {string[]} existingTokens - user.fcmTokens as currently known
 * @returns {Promise<{ status: 'granted'|'denied'|'unsupported', fcmTokens: string[] }>}
 */
export const enablePushNotifications = async (token, uid, existingTokens = []) => {
  if (!isPushAvailable()) return { status: 'unsupported', fcmTokens: existingTokens };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: permission === 'denied' ? 'denied' : 'unsupported', fcmTokens: existingTokens };
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) return { status: 'unsupported', fcmTokens: existingTokens };

  // Imported here rather than at module scope so the messaging chunk is only
  // fetched when a user actually turns notifications on.
  const { getToken } = await import('firebase/messaging');
  const registration = await registerServiceWorker();
  const fcmToken = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!fcmToken) return { status: 'unsupported', fcmTokens: existingTokens };

  // getToken() returns the same value for a browser that's already
  // registered, so guard against storing a duplicate.
  const fcmTokens = existingTokens.includes(fcmToken)
    ? existingTokens
    : [...existingTokens, fcmToken];

  if (fcmTokens !== existingTokens) {
    await updateUserProfile(token, uid, { fcmTokens });
  }

  return { status: 'granted', fcmTokens };
};

/**
 * Deregister this browser. Other devices the user registered stay subscribed
 * — only the token belonging to this browser is removed.
 *
 * @returns {Promise<string[]>} The remaining token list.
 */
export const disablePushNotifications = async (token, uid, existingTokens = []) => {
  let remaining = existingTokens;

  try {
    const messaging = await getMessagingIfSupported();
    if (messaging && Notification.permission === 'granted') {
      const { getToken, deleteToken } = await import('firebase/messaging');
      const registration = await registerServiceWorker();
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration,
      });
      if (fcmToken) {
        remaining = existingTokens.filter((t) => t !== fcmToken);
        await deleteToken(messaging);
      }
    }
  } catch (err) {
    // Best-effort: if the token can't be resolved we still clear the
    // preference below, and the backend prunes dead tokens on its next send.
    console.warn('[notificationService] Could not revoke the FCM token:', err.message);
  }

  if (remaining !== existingTokens) {
    await updateUserProfile(token, uid, { fcmTokens: remaining });
  }
  return remaining;
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/**
 * Send an admin-authored announcement. Admin-only — enforced server-side by
 * requireAdmin(), not by whether the UI rendered the composer.
 *
 * @param {string} token - Firebase ID token
 * @param {object} payload
 * @param {string} payload.subject
 * @param {string} payload.body
 * @param {'all'|'tier'|'user'} payload.mode
 * @param {{email: boolean, push: boolean}} payload.channels
 * @param {string} [payload.tier] - required when mode is 'tier'
 * @param {string} [payload.uid]  - required when mode is 'user'
 * @param {string} [payload.confirm] - must be 'ALL' when mode is 'all'
 * @returns {Promise<{total: number, emailSent: number, emailSkipped: number, pushSent: number, pushSkipped: number}>}
 */
export const sendBroadcast = async (token, payload) =>
  apiFetch(
    '/api/email',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { action: 'broadcast', ...payload },
    },
    'Failed to send notification'
  );
