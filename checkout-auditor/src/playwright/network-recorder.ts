import type { Page, Request, Response } from 'playwright'

export type NetworkEvent = {
  method: string
  url: string
  status: number | null
  resource_type: string
  request_headers: Record<string, string>
  response_headers: Record<string, string>
  duration_ms: number | null
  response_size_bytes: number | null
  started_at: string
}

/**
 * Attaches a lightweight HAR-style recorder to a Page. Filters out large binary assets.
 * Returns getter() that snapshots accumulated events.
 */
export function attachNetworkRecorder(page: Page): { getEvents: () => NetworkEvent[]; stop: () => void } {
  const events: NetworkEvent[] = []
  const startTimes = new WeakMap<Request, number>()

  const onRequest = (request: Request) => {
    startTimes.set(request, Date.now())
  }
  const onResponse = async (response: Response) => {
    const request = response.request()
    const url = request.url()
    if (/\.(png|jpg|jpeg|gif|svg|woff2?|css|map)(\?|$)/i.test(url)) return
    if (url.startsWith('data:')) return

    const startedAt = startTimes.get(request) ?? Date.now()
    const durationMs = Date.now() - startedAt
    let sizeBytes: number | null = null
    try {
      const body = await response.body().catch(() => null)
      sizeBytes = body ? body.byteLength : null
    } catch { /* ignore */ }

    events.push({
      method: request.method(),
      url,
      status: response.status(),
      resource_type: request.resourceType(),
      request_headers: filterHeaders(request.headers()),
      response_headers: filterHeaders(response.headers()),
      duration_ms: durationMs,
      response_size_bytes: sizeBytes,
      started_at: new Date(startedAt).toISOString(),
    })
  }

  page.on('request', onRequest)
  page.on('response', onResponse)

  return {
    getEvents: () => events.slice(),
    stop: () => {
      page.off('request', onRequest)
      page.off('response', onResponse)
    },
  }
}

function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    const lk = k.toLowerCase()
    if (lk === 'authorization' || lk === 'cookie' || lk === 'set-cookie' || lk.startsWith('x-stripe-')) {
      filtered[k] = '<redacted>'
    } else {
      filtered[k] = v
    }
  }
  return filtered
}
