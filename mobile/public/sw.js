/* Oruinwan in a phone's browser (the website's /m/): notifications through Web Push.
 * The server sends { title, body, data, tag } (server/src/features/push/push.service.js).
 * One notification per conversation or call (tag); a call's end closes its notification; while
 * the app is on screen, messages aren't shown (the app shows them live). Tapping opens the app
 * on what it's about (native/push.js reads the tap). The Android and iPhone apps don't use this. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const appWindows = async () => {
  const scope = new URL(self.registration.scope).pathname;
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return all.filter((c) => new URL(c.url).pathname.startsWith(scope));
};

self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { title: 'Oruinwan', body: event.data ? event.data.text() : '' };
  }
  const data = msg.data || {};
  event.waitUntil((async () => {
    if (data.type === 'call_cancel') {
      for (const n of await self.registration.getNotifications({ tag: msg.tag })) n.close();
      return;
    }
    const isCall = data.type === 'call';
    const windows = await appWindows();
    if (!isCall && windows.some((c) => c.visibilityState === 'visible')) return;
    await self.registration.showNotification(msg.title || 'Oruinwan', {
      body: msg.body || '',
      tag: msg.tag || undefined,
      renotify: Boolean(msg.tag),
      data,
      icon: './icon-192.png',
      badge: './icon-192.png',
      requireInteraction: isCall,
      vibrate: isCall ? [600, 400, 600, 400, 600] : [200],
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil((async () => {
    const [open] = await appWindows();
    if (open) {
      await open.focus();
      open.postMessage({ type: 'oru-push-tap', data });
      return;
    }
    await self.clients.openWindow(`${self.registration.scope}?push=${encodeURIComponent(JSON.stringify(data))}`);
  })());
});
