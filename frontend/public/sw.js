/* Orlando Core OS — Service Worker v1 */

const CACHE_NAME = 'orlando-core-os-v1'

const PRECACHE = [
  '/mobile',
  '/mobile/youtube',
  '/mobile/workflows',
  '/mobile/notifications',
  '/mobile/settings',
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

  // API calls: network-first, offline fallback
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

  // Navigation requests: network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/mobile').then(r => r ?? fetch(event.request))
      )
    )
    return
  }

  // Static assets: cache-first
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

  const iconMap = {
    upload_failed: '/icons/icon-192.png',
    worker_offline: '/icons/icon-192.png',
    workflow_failed: '/icons/icon-192.png',
    scraper_error: '/icons/icon-192.png',
    task_done: '/icons/icon-192.png',
    info: '/icons/icon-192.png',
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: iconMap[payload.type] ?? '/icons/icon-192.png',
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

// ── Background sync (future) ──────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(Promise.resolve())
  }
})
