/* eslint-env serviceworker */
/* global importScripts, firebase */

/**
 * Firebase Cloud Messaging service worker.
 *
 * Deliberately push-only: it registers no fetch handler and caches nothing.
 * A caching service worker on a Vite SPA is the classic way to serve users a
 * stale build forever, and nothing here needs offline support — so this file
 * only ever handles background push and notification clicks.
 *
 * The compat SDK is used because a service worker can't consume the app's
 * ES-module bundle. Config arrives as query parameters from
 * registerServiceWorker() in src/services/notificationService.js, since this
 * script has no access to import.meta.env; these are public client values
 * that already ship in the JS bundle.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get('apiKey'),
  authDomain: params.get('authDomain'),
  projectId: params.get('projectId'),
  storageBucket: params.get('storageBucket'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

const messaging = firebase.messaging();

// Fired only when the app is in the background; a foreground message is
// delivered to onMessage() in the page instead.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { link: payload.data?.link ?? '/dashboard' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link ?? '/dashboard';

  // Focus an already-open tab rather than piling up new ones.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      return self.clients.openWindow(link);
    })
  );
});
