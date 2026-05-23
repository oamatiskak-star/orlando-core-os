import { supabaseVastgoedCore } from '../lib/supabase'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'

export type WebhookObservation = {
  events_received: Array<{
    event_type: string
    received_at: string
    checkout_session_id: string | null
    latency_from_session_ms: number | null
  }>
  expected_events_missing: string[]
  max_latency_ms: number | null
  total_events_seen: number
}

const EXPECTED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'invoice.paid',
]

/**
 * Polls the `vastgoed_core.checkout_events` table for events related to the given
 * Stripe Checkout session. Waits up to WEBHOOK_WAIT_MAX_MS for expected events.
 */
export async function observeWebhooks(
  sessionId: string | null,
  sessionCreatedAt: number | null,
  customerId: string | null,
): Promise<WebhookObservation> {
  const result: WebhookObservation = {
    events_received: [],
    expected_events_missing: [...EXPECTED_EVENTS],
    max_latency_ms: null,
    total_events_seen: 0,
  }

  if (!sessionId) {
    logger.warn('webhook observation skipped — no session id')
    return result
  }

  const deadline = Date.now() + env.WEBHOOK_WAIT_MAX_MS
  const pollInterval = 2_000

  while (Date.now() < deadline) {
    const { data, error } = await supabaseVastgoedCore
      .from('checkout_events')
      .select('event_type, checkout_session_id, created_at, payload')
      .or(`checkout_session_id.eq.${sessionId}${customerId ? `,payload->>customer.eq.${customerId}` : ''}`)
      .gte('created_at', new Date(((sessionCreatedAt ?? Math.floor(Date.now() / 1000)) - 60) * 1000).toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      logger.warn({ err: error.message }, 'webhook poll error')
    } else if (data && data.length > 0) {
      result.events_received = data.map(row => {
        const receivedTs = new Date(row.created_at).getTime()
        const sessionTs = (sessionCreatedAt ?? 0) * 1000
        const latency = sessionTs ? receivedTs - sessionTs : null
        return {
          event_type: row.event_type,
          received_at: row.created_at,
          checkout_session_id: row.checkout_session_id,
          latency_from_session_ms: latency,
        }
      })
      result.total_events_seen = data.length

      // Compute max latency
      const latencies = result.events_received
        .map(e => e.latency_from_session_ms)
        .filter((x): x is number => x !== null && x >= 0)
      result.max_latency_ms = latencies.length > 0 ? Math.max(...latencies) : null

      const seenTypes = new Set(result.events_received.map(e => e.event_type))
      result.expected_events_missing = EXPECTED_EVENTS.filter(e => !seenTypes.has(e))

      if (result.expected_events_missing.length === 0) {
        return result
      }
    }
    await new Promise(r => setTimeout(r, pollInterval))
  }

  return result
}
