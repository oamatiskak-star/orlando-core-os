/* Orlando Core OS — Service Worker v5 */
/* Geen fetch interceptie — iOS PWA standalone fix */

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', () => self.skipWaiting())

// ── Activate — ruim alle oude caches op ──────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let payload = {
    title: 'Orlando Core OS',
    body: 'Nieuwe notificatie',
    url: '/mobile/notifications',
    type: 'info',
  }

  try {
    Object.assign(payload, event.data.json())
  } catch {
    payload.body = event.data.text() || payload.body
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.type,
      renotify: true,
      data: { url: payload.url ?? '/mobile/notifications' },
      vibrate: [200, 100, 200],
    })
  )
})

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url ?? '/mobile/notifications'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        const existing = windowClients.find(w =>
          w.url === targetUrl || w.url.includes('/mobile')
        )
        if (existing) return existing.focus()
        return clients.openWindow(targetUrl)
      })
  )
})
