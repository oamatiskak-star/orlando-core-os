/* Orlando Core OS — Service Worker v4 */

const CACHE_NAME = 'orlando-core-os-v4'

// Alleen statische assets precachen — GEEN auth-protected routes
const PRECACHE = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Alleen same-origin requests afhandelen
  if (url.origin !== self.location.origin) return

  // API calls: altijd network, nooit cachen
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline', data: null }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Navigation requests: altijd network-first, nooit cache
  // iOS standalone mode vereist dit — geen cached redirects serveren
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request))
    return
  }

  // Statische assets: cache-first (alleen icons, manifest, fonts)
  const isStatic = url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.startsWith('/_next/static/')

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response
          }
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }

  // Alle andere requests: network
  event.respondWith(fetch(event.request))
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
